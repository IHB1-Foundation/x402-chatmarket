import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { signTypedData } from 'viem/accounts';
import { getPool } from '../lib/db.js';
import { getConfig } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from config, with validation
 */
function getEncryptionKey(): Buffer {
  const config = getConfig();
  const keyStr = config.AGENT_WALLET_ENCRYPTION_KEY;

  if (!keyStr) {
    throw new Error('AGENT_WALLET_ENCRYPTION_KEY not configured');
  }

  // Key should be 32 bytes (256 bits) for AES-256
  // Accept base64 encoded key
  const key = Buffer.from(keyStr, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `AGENT_WALLET_ENCRYPTION_KEY must be 32 bytes (got ${key.length}). ` +
        'Generate with: openssl rand -base64 32'
    );
  }

  return key;
}

/**
 * Encrypt a private key using AES-256-GCM
 * Returns base64 encoded string: iv + authTag + ciphertext
 */
export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate: iv (12 bytes) + authTag (16 bytes) + ciphertext
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a private key from encrypted format
 */
export function decryptPrivateKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedData, 'base64');

  // Extract components
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export interface AgentWallet {
  id: string;
  moduleId: string;
  walletAddress: string;
  keyVersion: number;
  createdAt: Date;
}

/**
 * Generate a new agent wallet for a module
 * Returns the wallet address (private key is encrypted in DB)
 */
export async function createAgentWallet(moduleId: string): Promise<AgentWallet> {
  const pool = getPool();

  // Generate new private key and derive address
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletAddress = account.address;

  // Encrypt the private key
  const encryptedKey = encryptPrivateKey(privateKey);

  // Store in database
  const result = await pool.query(
    `INSERT INTO agent_wallets (module_id, wallet_address, encrypted_private_key, key_version)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (module_id) DO UPDATE SET
       wallet_address = EXCLUDED.wallet_address,
       encrypted_private_key = EXCLUDED.encrypted_private_key,
       key_version = agent_wallets.key_version + 1
     RETURNING id, module_id, wallet_address, key_version, created_at`,
    [moduleId, walletAddress, encryptedKey]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    moduleId: row.module_id,
    walletAddress: row.wallet_address,
    keyVersion: row.key_version,
    createdAt: row.created_at,
  };
}

/**
 * Get agent wallet for a module (without private key)
 */
export async function getAgentWallet(moduleId: string): Promise<AgentWallet | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, module_id, wallet_address, key_version, created_at
     FROM agent_wallets WHERE module_id = $1`,
    [moduleId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    moduleId: row.module_id,
    walletAddress: row.wallet_address,
    keyVersion: row.key_version,
    createdAt: row.created_at,
  };
}

/**
 * Sign a typed data message using the agent wallet
 * Used for x402 payment authorization
 */
export async function signWithAgentWallet(
  moduleId: string,
  typedData: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract?: `0x${string}`;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }
): Promise<{ signature: `0x${string}`; walletAddress: `0x${string}` }> {
  const pool = getPool();

  // Fetch encrypted private key
  const result = await pool.query(
    `SELECT wallet_address, encrypted_private_key
     FROM agent_wallets WHERE module_id = $1`,
    [moduleId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No agent wallet found for module ${moduleId}`);
  }

  const { wallet_address, encrypted_private_key } = result.rows[0];

  // Decrypt private key
  const privateKey = decryptPrivateKey(encrypted_private_key) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  // Sign the typed data
  const signature = await signTypedData({
    privateKey,
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  });

  return {
    signature,
    walletAddress: wallet_address as `0x${string}`,
  };
}

/**
 * Build x402 payment header for agent wallet
 */
export async function buildAgentPaymentHeader(params: {
  moduleId: string;
  payTo: string;
  value: string;
  network: string;
  asset: string;
}): Promise<string> {
  const { moduleId, payTo, value } = params;
  const config = getConfig();

  // Get agent wallet
  const wallet = await getAgentWallet(moduleId);
  if (!wallet) {
    throw new Error(`No agent wallet found for module ${moduleId}`);
  }

  const chainId = config.X402_CHAIN_ID ?? 338; // cronos-testnet default
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const nonce = `0x${randomBytes(32).toString('hex')}` as `0x${string}`;

  const domain = {
    name: config.X402_EIP712_NAME,
    version: config.X402_EIP712_VERSION,
    chainId,
    verifyingContract: params.asset as `0x${string}`,
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  const message = {
    from: wallet.walletAddress,
    to: payTo,
    value: BigInt(value),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce,
  };

  const { signature } = await signWithAgentWallet(moduleId, {
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: params.network,
    payload: {
      from: wallet.walletAddress,
      to: payTo,
      value,
      validAfter,
      validBefore,
      nonce,
      signature,
      asset: params.asset,
    },
  };

  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}
