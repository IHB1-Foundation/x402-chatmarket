'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { cronosTestnet } from 'wagmi/chains';
import { isAddress } from 'viem';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { LogoMark } from '../brand/LogoMark';

const navLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/seller', label: 'Seller' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { showToast } = useToast();

  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const desiredChainId = cronosTestnet.id;
  const desiredChainLabel = 'Cronos Testnet';
  const isWrongNetwork = isConnected && chainId != null && chainId !== desiredChainId;
  const connectedLabel = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';

  const defaultAssetContract = '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
  const assetContractRaw = process.env.NEXT_PUBLIC_X402_ASSET_CONTRACT || defaultAssetContract;
  const assetContract =
    assetContractRaw && isAddress(assetContractRaw) ? (assetContractRaw as `0x${string}`) : undefined;

  const walletAddress = address as `0x${string}` | undefined;

  const { data: usdBalance, isLoading: isUsdBalanceLoading } = useBalance({
    address: walletAddress,
    token: assetContract,
    chainId: desiredChainId,
    query: {
      enabled: Boolean(isConnected && walletAddress && assetContract && !isWrongNetwork),
      refetchInterval: 15_000,
    },
  });

  const formatBalanceUsd = (value: bigint, decimals: number): string => {
    const displayDecimals: number = 2;

    if (displayDecimals === 0) {
      const divisor = 10n ** BigInt(decimals);
      return (value / divisor).toString();
    }

    let scaled: bigint;
    if (decimals >= displayDecimals) {
      const divisor = 10n ** BigInt(decimals - displayDecimals);
      scaled = (value + divisor / 2n) / divisor; // rounded to displayDecimals
    } else {
      const multiplier = 10n ** BigInt(displayDecimals - decimals);
      scaled = value * multiplier;
    }

    const base = 10n ** BigInt(displayDecimals);
    const integerPart = scaled / base;
    const fractionalPart = scaled % base;
    return `${integerPart.toString()}.${fractionalPart.toString().padStart(displayDecimals, '0')}`;
  };

  const handleConnect = async () => {
    const metaMaskConnector = connectors.find((connector) => connector.name === 'MetaMask') ?? connectors[0];
    if (!metaMaskConnector) {
      showToast('MetaMask connector not available', 'error');
      return;
    }

    try {
      await connectAsync({ connector: metaMaskConnector, chainId: desiredChainId });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to connect MetaMask', 'error');
    }
  };

  const handleSwitchToCronos = async () => {
    try {
      await switchChainAsync({ chainId: desiredChainId });
      showToast(`Switched to ${desiredChainLabel}`, 'success', 2000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to switch to ${desiredChainLabel}`, 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md">
      <div className="container-app">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <LogoMark size={32} className="shrink-0" />
            <span className="hidden sm:inline">SoulForge</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    px-3 py-2
                    text-sm font-medium
                    rounded-[var(--radius-md)]
                    transition-colors
                    ${isActive
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]'
                    }
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Wallet */}
            {isConnected ? (
              <div className="hidden sm:flex items-center gap-2">
                <Badge variant={isWrongNetwork ? 'warning' : 'success'} size="sm">
                  {isWrongNetwork ? 'Wrong network' : desiredChainLabel}
                </Badge>
                {!isWrongNetwork && usdBalance && (
                  <Badge variant="outline" size="sm">
                    USD ${formatBalanceUsd(usdBalance.value, usdBalance.decimals)}
                  </Badge>
                )}
                {!isWrongNetwork && isUsdBalanceLoading && assetContract && (
                  <Badge variant="outline" size="sm">
                    USD ...
                  </Badge>
                )}
                <Badge variant="outline" size="sm">
                  {connectedLabel}
                </Badge>
                {isWrongNetwork ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSwitchToCronos}
                    isLoading={isSwitching}
                  >
                    Switch
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    isLoading={isDisconnecting}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="hidden sm:block">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConnect}
                  isLoading={isConnecting}
                >
                  Connect MetaMask
                </Button>
              </div>
            )}

            <ThemeToggle />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[var(--color-border)]">
            <div className="px-3 pb-3">
              {isConnected ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={isWrongNetwork ? 'warning' : 'success'} size="sm">
                      {isWrongNetwork ? 'Wrong network' : desiredChainLabel}
                    </Badge>
                    {!isWrongNetwork && usdBalance && (
                      <Badge variant="outline" size="sm">
                        USD ${formatBalanceUsd(usdBalance.value, usdBalance.decimals)}
                      </Badge>
                    )}
                    {!isWrongNetwork && isUsdBalanceLoading && assetContract && (
                      <Badge variant="outline" size="sm">
                        USD ...
                      </Badge>
                    )}
                    <Badge variant="outline" size="sm">
                      {connectedLabel}
                    </Badge>
                  </div>
                  {isWrongNetwork ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSwitchToCronos}
                      isLoading={isSwitching}
                      fullWidth
                    >
                      Switch to {desiredChainLabel}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnect}
                      isLoading={isDisconnecting}
                      fullWidth
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConnect}
                  isLoading={isConnecting}
                  fullWidth
                >
                  Connect MetaMask
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      px-3 py-2
                      text-sm font-medium
                      rounded-[var(--radius-md)]
                      transition-colors
                      ${isActive
                        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]'
                      }
                    `}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
