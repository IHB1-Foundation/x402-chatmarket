export const X402_EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export interface X402PaymentConfig {
  network: string;
  chainId: number;
  assetContract: string;
  assetDecimals: number;
  eip712Name: string;
  eip712Version: string;
  facilitatorBaseUrl?: string;
  mockMode: boolean;
}

export function getX402EIP712Domain(
  config: Pick<X402PaymentConfig, 'eip712Name' | 'eip712Version' | 'chainId'> & {
    verifyingContract?: `0x${string}`;
  }
) {
  return {
    name: config.eip712Name,
    version: config.eip712Version,
    chainId: config.chainId,
    verifyingContract: config.verifyingContract,
  } as const;
}
