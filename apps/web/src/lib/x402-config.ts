import { X402_EIP712_TYPES, getX402EIP712Domain } from '@soulforge/shared';

export function getClientX402Config() {
  const chainId = 338;
  const network = 'cronos-testnet';
  const eip712Name = process.env.NEXT_PUBLIC_X402_EIP712_NAME || 'x402';
  const eip712Version = process.env.NEXT_PUBLIC_X402_EIP712_VERSION || '1';

  return {
    network,
    chainId,
    eip712Name,
    eip712Version,
    domain: getX402EIP712Domain({ chainId, eip712Name, eip712Version }),
    types: X402_EIP712_TYPES,
  };
}
