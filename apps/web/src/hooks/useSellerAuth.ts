'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_CHAIN_ID = 338;

interface User {
  id: string;
  address: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useSellerAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('sellerToken');
    const savedUser = localStorage.getItem('sellerUser');
    if (savedToken && savedUser) {
      try {
        const user = JSON.parse(savedUser) as User;
        // Verify token is still valid for current address
        if (user.address.toLowerCase() === address?.toLowerCase()) {
          setAuthState({
            user,
            token: savedToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          // Address changed, clear auth
          localStorage.removeItem('sellerToken');
          localStorage.removeItem('sellerUser');
        }
      } catch {
        localStorage.removeItem('sellerToken');
        localStorage.removeItem('sellerUser');
      }
    }
  }, [address]);

  const login = useCallback(async () => {
    if (!address || !isConnected) {
      setAuthState((prev) => ({ ...prev, error: 'Wallet not connected' }));
      return;
    }

    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get nonce
      const nonceRes = await fetch(`${API_URL}/api/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!nonceRes.ok) {
        throw new Error('Failed to get nonce');
      }

      const { nonce } = await nonceRes.json();

      // Create SIWE message
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to SoulForge as a seller',
        uri: window.location.origin,
        version: '1',
        chainId: chainId ?? DEFAULT_CHAIN_ID,
        nonce,
      });

      const message = siweMessage.prepareMessage();

      // Sign message
      const signature = await signMessageAsync({ message });

      // Verify signature
      const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.details || 'Authentication failed');
      }

      const { token, user } = await verifyRes.json();

      // Save to localStorage
      localStorage.setItem('sellerToken', token);
      localStorage.setItem('sellerUser', JSON.stringify(user));

      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  const logout = useCallback(() => {
    localStorage.removeItem('sellerToken');
    localStorage.removeItem('sellerUser');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!authState.token) return {};
    return { Authorization: `Bearer ${authState.token}` };
  }, [authState.token]);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    isConnected,
    address,
  };
}
