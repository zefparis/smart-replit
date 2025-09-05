import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';

// ERC20 ABI basique pour les interactions token
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  isLoading: boolean;
  error: string | null;
}

export interface TokenActions {
  refreshBalance: () => Promise<void>;
  transfer: (to: string, amount: string) => Promise<string>;
  approve: (spender: string, amount: string) => Promise<string>;
  getAllowance: (spender: string) => Promise<string>;
  addToWallet: () => Promise<void>;
}

export function useIASToken(tokenAddress?: string): TokenInfo & TokenActions {
  const { provider, signer, account, isConnected } = useWallet();
  
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    name: '',
    symbol: 'IAS',
    decimals: 18,
    totalSupply: '0',
    balance: '0',
    isLoading: false,
    error: null,
  });

  // Get contract instance
  const getContract = useCallback(() => {
    if (!tokenAddress || !provider) return null;
    
    return new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      signer || provider
    );
  }, [tokenAddress, provider, signer]);

  // Load token info (name, symbol, decimals, total supply)
  const loadTokenInfo = useCallback(async () => {
    const contract = getContract();
    if (!contract) return;

    try {
      setTokenInfo(prev => ({ ...prev, isLoading: true, error: null }));

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
      ]);

      setTokenInfo(prev => ({
        ...prev,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        isLoading: false,
      }));
    } catch (error: any) {
      setTokenInfo(prev => ({
        ...prev,
        error: `Failed to load token info: ${error.message}`,
        isLoading: false,
      }));
    }
  }, [getContract]);

  // Refresh user's token balance
  const refreshBalance = useCallback(async () => {
    const contract = getContract();
    if (!contract || !account) return;

    try {
      const balance = await contract.balanceOf(account);
      setTokenInfo(prev => ({
        ...prev,
        balance: ethers.formatUnits(balance, prev.decimals),
      }));
    } catch (error: any) {
      console.error('Failed to refresh balance:', error);
      setTokenInfo(prev => ({
        ...prev,
        error: `Failed to refresh balance: ${error.message}`,
      }));
    }
  }, [getContract, account]);

  // Transfer tokens
  const transfer = useCallback(async (to: string, amount: string): Promise<string> => {
    const contract = getContract();
    if (!contract || !signer) {
      throw new Error('Contract not available or wallet not connected');
    }

    try {
      const decimals = tokenInfo.decimals;
      const parsedAmount = ethers.parseUnits(amount, decimals);
      
      const tx = await (contract.connect(signer) as any).transfer(to, parsedAmount);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      // Refresh balance after transfer
      setTimeout(refreshBalance, 1000);
      
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }, [getContract, signer, tokenInfo.decimals, refreshBalance]);

  // Approve spender to spend tokens
  const approve = useCallback(async (spender: string, amount: string): Promise<string> => {
    const contract = getContract();
    if (!contract || !signer) {
      throw new Error('Contract not available or wallet not connected');
    }

    try {
      const decimals = tokenInfo.decimals;
      const parsedAmount = ethers.parseUnits(amount, decimals);
      
      const tx = await (contract.connect(signer) as any).approve(spender, parsedAmount);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Approval failed: ${error.message}`);
    }
  }, [getContract, signer, tokenInfo.decimals]);

  // Get allowance amount
  const getAllowance = useCallback(async (spender: string): Promise<string> => {
    const contract = getContract();
    if (!contract || !account) {
      throw new Error('Contract not available or wallet not connected');
    }

    try {
      const allowance = await contract.allowance(account, spender);
      return ethers.formatUnits(allowance, tokenInfo.decimals);
    } catch (error: any) {
      throw new Error(`Failed to get allowance: ${error.message}`);
    }
  }, [getContract, account, tokenInfo.decimals]);

  // Add token to MetaMask wallet
  const addToWallet = useCallback(async () => {
    if (!tokenAddress) {
      throw new Error('Token address not provided');
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
          },
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to add token to wallet: ${error.message}`);
    }
  }, [tokenAddress, tokenInfo.symbol, tokenInfo.decimals]);

  // Load token info when contract becomes available
  useEffect(() => {
    if (tokenAddress && provider && isConnected) {
      loadTokenInfo();
    }
  }, [tokenAddress, provider, isConnected, loadTokenInfo]);

  // Load balance when account changes
  useEffect(() => {
    if (account && tokenAddress && provider) {
      refreshBalance();
    }
  }, [account, tokenAddress, provider, refreshBalance]);

  // Listen for transfer events to update balance
  useEffect(() => {
    const contract = getContract();
    if (!contract || !account) return;

    const handleTransfer = (from: string, to: string) => {
      if (from.toLowerCase() === account.toLowerCase() || 
          to.toLowerCase() === account.toLowerCase()) {
        // Refresh balance when user sends or receives tokens
        setTimeout(refreshBalance, 2000);
      }
    };

    // Listen for Transfer events
    contract.on('Transfer', handleTransfer);

    return () => {
      contract.off('Transfer', handleTransfer);
    };
  }, [getContract, account, refreshBalance]);

  return {
    ...tokenInfo,
    refreshBalance,
    transfer,
    approve,
    getAllowance,
    addToWallet,
  };
}