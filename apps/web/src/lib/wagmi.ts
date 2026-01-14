import { http, createConfig } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: 'SoulForge' }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
