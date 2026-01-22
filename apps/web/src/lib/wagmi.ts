import { http, createConfig } from 'wagmi';
import { cronosTestnet } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [cronosTestnet],
  ssr: true,
  connectors: [metaMask()],
  transports: {
    [cronosTestnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
