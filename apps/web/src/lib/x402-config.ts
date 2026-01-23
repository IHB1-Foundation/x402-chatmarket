import { X402_EIP712_TYPES, getX402EIP712Domain } from '@soulforge/shared';

export function getClientX402Config() {
  const chainId = Number(process.env.NEXT_PUBLIC_X402_CHAIN_ID || 338);
  const network = process.env.NEXT_PUBLIC_X402_NETWORK || 'cronos-testnet';
  const eip712Name = process.env.NEXT_PUBLIC_X402_EIP712_NAME || 'Bridged USDC (Stargate)';
  const eip712Version = process.env.NEXT_PUBLIC_X402_EIP712_VERSION || '1';

  return {
    network,
    chainId,
    eip712Name,
    eip712Version,
    domainBase: getX402EIP712Domain({ chainId, eip712Name, eip712Version }),
    types: X402_EIP712_TYPES,
  };
}
