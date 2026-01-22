import { http, createConfig } from 'wagmi';
import { cronosTestnet, cronos } from 'wagmi/chains';
import { injected } from '@wagmi/core';

export const config = createConfig({
  chains: [cronosTestnet, cronos],
  ssr: true,
  connectors: [injected({ target: 'metaMask' })],
  transports: {
    [cronosTestnet.id]: http(),
    [cronos.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
