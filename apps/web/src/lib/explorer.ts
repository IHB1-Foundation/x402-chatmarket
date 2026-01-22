import { cronosTestnet } from 'wagmi/chains';

function getBlockExplorerBaseUrl(params: { chainId?: number; network?: string }): string | null {
  if (params.chainId === cronosTestnet.id) return cronosTestnet.blockExplorers.default.url;

  if (params.network === 'cronos-testnet') return cronosTestnet.blockExplorers.default.url;

  return null;
}

export function getTxExplorerUrl(params: { chainId?: number; network?: string; txHash: string }): string | null {
  const base = getBlockExplorerBaseUrl(params);
  if (!base) return null;
  return `${base}/tx/${params.txHash}`;
}
