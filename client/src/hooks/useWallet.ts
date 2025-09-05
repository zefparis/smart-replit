import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  balance: string;
  network: {
    chainId: number;
    name: string;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  requestAddToken: (tokenAddress: string, symbol: string, decimals: number) => Promise<void>;
}

const SUPPORTED_NETWORKS = {
  1: 'Ethereum',
  11155111: 'Sepolia', // Testnet
  137: 'Polygon',
  80001: 'Mumbai', // Polygon testnet
};

export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    account: null,
    provider: null,
    signer: null,
    balance: '0',
    network: null,
    isLoading: false,
    error: null,
  });

  const updateBalance = useCallback(async (provider: ethers.BrowserProvider, account: string) => {
    try {
      const balance = await provider.getBalance(account);
      setState(prev => ({
        ...prev,
        balance: ethers.formatEther(balance)
      }));
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  }, []);

  const updateNetwork = useCallback(async (provider: ethers.BrowserProvider) => {
    try {
      const network = await provider.getNetwork();
      setState(prev => ({
        ...prev,
        network: {
          chainId: Number(network.chainId),
          name: SUPPORTED_NETWORKS[Number(network.chainId) as keyof typeof SUPPORTED_NETWORKS] || 'Unknown'
        }
      }));
    } catch (error) {
      console.error('Failed to update network:', error);
    }
  }, []);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const ethereum = await detectEthereumProvider();
      
      if (!ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to use this feature.');
      }

      // Request account access
      const accounts = await (ethereum as any).request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found. Please make sure your wallet is unlocked.');
      }

      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();
      const account = accounts[0];

      setState(prev => ({
        ...prev,
        isConnected: true,
        account,
        provider,
        signer,
        isLoading: false,
      }));

      // Update balance and network info
      await updateBalance(provider, account);
      await updateNetwork(provider);

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to connect wallet',
        isLoading: false,
      }));
    }
  }, [updateBalance, updateNetwork]);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      account: null,
      provider: null,
      signer: null,
      balance: '0',
      network: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const switchNetwork = useCallback(async (chainId: number) => {
    if (!state.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      
      // Update network info after switch
      setTimeout(() => updateNetwork(state.provider!), 1000);
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added to MetaMask
        throw new Error(`Network ${chainId} is not added to your wallet. Please add it manually.`);
      }
      throw error;
    }
  }, [state.provider, updateNetwork]);

  const requestAddToken = useCallback(async (tokenAddress: string, symbol: string, decimals: number) => {
    if (!state.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: symbol,
            decimals: decimals,
            image: '', // Optional: Add IAS token logo
          },
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to add token: ${error.message}`);
    }
  }, [state.provider]);

  // Listen for account changes
  useEffect(() => {
    if (!state.provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.account) {
        setState(prev => ({ ...prev, account: accounts[0] }));
        updateBalance(state.provider!, accounts[0]);
      }
    };

    const handleChainChanged = () => {
      // Refresh the page when chain changes (recommended by MetaMask)
      window.location.reload();
    };

    const handleDisconnect = () => {
      disconnect();
    };

    const ethereum = (window as any).ethereum;
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('disconnect', handleDisconnect);

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
        ethereum.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [state.provider, state.account, disconnect, updateBalance]);

  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const ethereum = await detectEthereumProvider();
      if (ethereum) {
        const accounts = await (ethereum as any).request({
          method: 'eth_accounts',
        });
        
        if (accounts.length > 0) {
          connect();
        }
      }
    };

    autoConnect();
  }, [connect]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    requestAddToken,
  };
}