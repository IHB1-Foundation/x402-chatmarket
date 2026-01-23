import { getConfig } from '../config.js';
import {
  TransactionReceiptNotFoundError,
  createPublicClient,
  decodeEventLog,
  http,
  isHex,
  parseAbiItem,
  type Hex,
} from 'viem';
import { cronos, cronosTestnet } from 'viem/chains';

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

type SupportedNetwork = 'cronos-testnet' | 'cronos-mainnet';

function normalizeNetwork(network: string): SupportedNetwork {
  const normalized = network.trim().toLowerCase();
  if (normalized === 'cronos-testnet') return 'cronos-testnet';
  if (normalized === 'cronos-mainnet' || normalized === 'cronos') return 'cronos-mainnet';
  throw new Error(`Unsupported network: ${network}`);
}

function getChain(network: SupportedNetwork) {
  return network === 'cronos-testnet' ? cronosTestnet : cronos;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function isTxHash(value: string): value is Hex {
  return isHex(value) && /^0x[a-fA-F0-9]{64}$/.test(value);
}

type VerifyPaymentTxResult =
  | {
      status: 'confirmed';
      txHash: string;
      network: SupportedNetwork;
      blockNumber: string;
      blockTimestamp: string; // ISO
      from: string;
      to: string;
      value: string;
    }
  | {
      status: 'not_found' | 'reverted' | 'mismatch' | 'unsupported_network' | 'error';
      txHash: string;
      network: string;
      error?: string;
    };

type CacheEntry = { value: VerifyPaymentTxResult; expiresAt: number };
const txVerifyCache = new Map<string, CacheEntry>();

function getCached(key: string): VerifyPaymentTxResult | null {
  const hit = txVerifyCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    txVerifyCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key: string, value: VerifyPaymentTxResult): void {
  const ttlMs =
    value.status === 'confirmed'
      ? 24 * 60 * 60 * 1000
      : value.status === 'not_found'
        ? 20 * 1000
        : 5 * 60 * 1000;
  txVerifyCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const clientCache = new Map<string, ReturnType<typeof createPublicClient>>();
const blockTimestampCache = new Map<string, string>();

function getPublicClientForNetwork(network: SupportedNetwork) {
  const config = getConfig();
  const chain = getChain(network);

  const rpcUrl = config.X402_RPC_URL || chain.rpcUrls.default.http[0];
  const cacheKey = `${network}:${rpcUrl}`;

  const existing = clientCache.get(cacheKey);
  if (existing) return existing;

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  clientCache.set(cacheKey, client);
  return client;
}

export type TokenTransfer = {
  txHash: string;
  network: SupportedNetwork;
  assetContract: string;
  blockNumber: string;
  blockTimestamp: string; // ISO
  logIndex: number;
  from: string;
  to: string;
  value: string;
};

async function findBlockNumberByTimestamp(params: {
  client: ReturnType<typeof createPublicClient>;
  targetTimestampSec: bigint;
}): Promise<bigint> {
  let low = 0n;
  let high = await params.client.getBlockNumber();

  while (low < high) {
    const mid = (low + high) / 2n;
    const block = await params.client.getBlock({ blockNumber: mid });
    if (block.timestamp < params.targetTimestampSec) {
      low = mid + 1n;
    } else {
      high = mid;
    }
  }

  return low;
}

async function getBlockTimestampIso(params: {
  client: ReturnType<typeof createPublicClient>;
  network: SupportedNetwork;
  blockNumber: bigint;
}): Promise<string> {
  const key = `${params.network}:${params.blockNumber.toString()}`;
  const cached = blockTimestampCache.get(key);
  if (cached) return cached;

  const block = await params.client.getBlock({ blockNumber: params.blockNumber });
  const iso = new Date(Number(block.timestamp) * 1000).toISOString();
  blockTimestampCache.set(key, iso);
  return iso;
}

async function getLogsChunked<TLog>(params: {
  client: ReturnType<typeof createPublicClient>;
  getLogs: (fromBlock: bigint, toBlock: bigint) => Promise<TLog[]>;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<TLog[]> {
  const logs: TLog[] = [];
  let cursor = params.fromBlock;
  let step = 100_000n;

  while (cursor <= params.toBlock) {
    const end = cursor + step - 1n > params.toBlock ? params.toBlock : cursor + step - 1n;
    try {
      const chunk = await params.getLogs(cursor, end);
      logs.push(...chunk);
      cursor = end + 1n;
    } catch (err) {
      if (step <= 5_000n) throw err;
      step = step / 2n;
    }
  }

  return logs;
}

export async function listTokenTransfersToAddresses(params: {
  network: string;
  assetContract: string;
  toAddresses: string[];
  fromTimestampMs: number;
}): Promise<{ transfers: TokenTransfer[]; meta: { fromBlock: string; toBlock: string } }> {
  let network: SupportedNetwork;
  try {
    network = normalizeNetwork(params.network);
  } catch (err) {
    return {
      transfers: [],
      meta: { fromBlock: '0', toBlock: '0' },
    };
  }

  if (params.toAddresses.length === 0) {
    return { transfers: [], meta: { fromBlock: '0', toBlock: '0' } };
  }

  const client = getPublicClientForNetwork(network);
  const assetContract = normalizeAddress(params.assetContract) as `0x${string}`;
  const toAddresses = params.toAddresses.map((a) => normalizeAddress(a) as `0x${string}`);

  const toBlock = await client.getBlockNumber();
  const targetTimestampSec = BigInt(Math.floor(params.fromTimestampMs / 1000));
  const fromBlock = await findBlockNumberByTimestamp({ client, targetTimestampSec });

  const logs = await getLogsChunked({
    client,
    fromBlock,
    toBlock,
    getLogs: (from, to) =>
      client.getLogs({
        address: assetContract,
        event: transferEvent,
        args: { to: toAddresses },
        fromBlock: from,
        toBlock: to,
      }),
  });

  const transfers = await mapWithConcurrency(logs, 10, async (log) => {
    const ts = await getBlockTimestampIso({ client, network, blockNumber: log.blockNumber });
    return {
      txHash: log.transactionHash,
      network,
      assetContract,
      blockNumber: log.blockNumber.toString(),
      blockTimestamp: ts,
      logIndex: log.logIndex,
      from: normalizeAddress(log.args.from!),
      to: normalizeAddress(log.args.to!),
      value: log.args.value!.toString(),
    } satisfies TokenTransfer;
  });

  transfers.sort((a, b) => (a.blockTimestamp < b.blockTimestamp ? 1 : a.blockTimestamp > b.blockTimestamp ? -1 : 0));

  return {
    transfers,
    meta: { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
  };
}

export async function verifyPaymentTxOnchain(params: {
  txHash: string;
  network: string;
  assetContract: string;
  expectedTo: string;
  expectedValue: string;
  expectedFrom?: string;
}): Promise<VerifyPaymentTxResult> {
  const cacheKey = [
    params.network,
    params.assetContract,
    params.txHash,
    params.expectedTo,
    params.expectedValue,
    params.expectedFrom || '',
  ].join(':');

  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!isTxHash(params.txHash)) {
    const result: VerifyPaymentTxResult = {
      status: 'error',
      txHash: params.txHash,
      network: params.network,
      error: 'Invalid txHash format',
    };
    setCached(cacheKey, result);
    return result;
  }

  let network: SupportedNetwork;
  try {
    network = normalizeNetwork(params.network);
  } catch (err) {
    const result: VerifyPaymentTxResult = {
      status: 'unsupported_network',
      txHash: params.txHash,
      network: params.network,
      error: err instanceof Error ? err.message : String(err),
    };
    setCached(cacheKey, result);
    return result;
  }

  const client = getPublicClientForNetwork(network);
  const asset = normalizeAddress(params.assetContract);
  const expectedTo = normalizeAddress(params.expectedTo);
  const expectedFrom = params.expectedFrom ? normalizeAddress(params.expectedFrom) : undefined;
  const expectedValue = BigInt(params.expectedValue);

  try {
    const receipt = await client.getTransactionReceipt({ hash: params.txHash as Hex });

    if (receipt.status === 'reverted') {
      const result: VerifyPaymentTxResult = {
        status: 'reverted',
        txHash: params.txHash,
        network,
        error: 'Transaction reverted',
      };
      setCached(cacheKey, result);
      return result;
    }

    let matched: { from: string; to: string; value: bigint } | null = null;
    for (const log of receipt.logs) {
      if (!log.address || normalizeAddress(log.address) !== asset) continue;
      try {
        const decoded = decodeEventLog({
          abi: [transferEvent],
          data: log.data,
          topics: log.topics,
        }) as unknown as {
          eventName: 'Transfer';
          args: { from: string; to: string; value: bigint };
        };

        if (decoded.eventName !== 'Transfer') continue;

        const from = normalizeAddress(decoded.args.from);
        const to = normalizeAddress(decoded.args.to);
        const value = decoded.args.value;

        if (to !== expectedTo) continue;
        if (value !== expectedValue) continue;
        if (expectedFrom && from !== expectedFrom) continue;

        matched = { from, to, value };
        break;
      } catch {
        // Ignore unrelated/undecodable logs.
      }
    }

    if (!matched) {
      const result: VerifyPaymentTxResult = {
        status: 'mismatch',
        txHash: params.txHash,
        network,
        error: 'No matching Transfer event found in receipt logs',
      };
      setCached(cacheKey, result);
      return result;
    }

    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const blockTimestampMs = Number(block.timestamp) * 1000;

    const result: VerifyPaymentTxResult = {
      status: 'confirmed',
      txHash: params.txHash,
      network,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp: new Date(blockTimestampMs).toISOString(),
      from: matched.from,
      to: matched.to,
      value: matched.value.toString(),
    };
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    if (err instanceof TransactionReceiptNotFoundError) {
      const result: VerifyPaymentTxResult = {
        status: 'not_found',
        txHash: params.txHash,
        network,
        error: 'Transaction receipt not found',
      };
      setCached(cacheKey, result);
      return result;
    }

    const result: VerifyPaymentTxResult = {
      status: 'error',
      txHash: params.txHash,
      network,
      error: err instanceof Error ? err.message : String(err),
    };
    setCached(cacheKey, result);
    return result;
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
}
