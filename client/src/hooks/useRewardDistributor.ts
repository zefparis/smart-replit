import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './useWallet';
import { useToast } from './use-toast';

// RewardDistributor contract ABI
const REWARD_DISTRIBUTOR_ABI = [
  'function iasToken() view returns (address)',
  'function claimedRewards(address, uint256) view returns (bool)',
  'function totalDistributed(address) view returns (uint256)',
  'function globalTotalDistributed() view returns (uint256)',
  'function hasClaimedReward(address affiliate, uint256 epoch) view returns (bool)',
  'function getAffiliateTotal(address affiliate) view returns (uint256)',
  'function claimReward(uint256 amount, uint256 epoch, bytes calldata signature)',
  'function batchDistributeRewards(address[] calldata affiliates, uint256[] calldata amounts, uint256 epoch)',
  // Events
  'event RewardDistributed(address indexed affiliate, uint256 amount, uint256 epoch)',
  'event BatchRewardDistributed(address[] affiliates, uint256[] amounts, uint256 epoch)',  
  'event RewardClaimed(address indexed affiliate, uint256 amount, uint256 epoch)'
];

export interface RewardInfo {
  totalDistributed: string;
  globalTotalDistributed: string;
  hasClaimed: { [epoch: string]: boolean };
  isLoading: boolean;
  error: string | null;
}

export interface PendingReward {
  epoch: string;
  amount: string;
  signature: string;
  isClaimed: boolean;
}

export interface RewardActions {
  claimReward: (epoch: string, amount: string, signature: string) => Promise<string>;
  checkRewardClaimed: (epoch: string) => Promise<boolean>;
  getAffiliateTotal: () => Promise<string>;
  refreshRewardInfo: () => Promise<void>;
  batchDistributeRewards: (affiliates: string[], amounts: string[], epoch: string) => Promise<string>;
}

export function useRewardDistributor(contractAddress?: string): RewardInfo & RewardActions {
  const { provider, signer, account, isConnected } = useWallet();
  const { toast } = useToast();
  
  const [rewardInfo, setRewardInfo] = useState<RewardInfo>({
    totalDistributed: '0',
    globalTotalDistributed: '0',
    hasClaimed: {},
    isLoading: false,
    error: null,
  });

  // Get contract instance
  const getContract = useCallback(() => {
    if (!contractAddress || !provider) return null;
    
    return new ethers.Contract(
      contractAddress,
      REWARD_DISTRIBUTOR_ABI,
      signer || provider
    );
  }, [contractAddress, provider, signer]);

  // Refresh reward information
  const refreshRewardInfo = useCallback(async () => {
    const contract = getContract();
    if (!contract || !account) return;

    try {
      setRewardInfo(prev => ({ ...prev, isLoading: true, error: null }));

      const [totalDistributed, globalTotalDistributed] = await Promise.all([
        contract.getAffiliateTotal(account),
        contract.globalTotalDistributed(),
      ]);

      setRewardInfo(prev => ({
        ...prev,
        totalDistributed: ethers.formatUnits(totalDistributed, 18),
        globalTotalDistributed: ethers.formatUnits(globalTotalDistributed, 18),
        isLoading: false,
      }));
    } catch (error: any) {
      setRewardInfo(prev => ({
        ...prev,
        error: `Failed to load reward info: ${error.message}`,
        isLoading: false,
      }));
    }
  }, [getContract, account]);

  // Check if reward has been claimed for specific epoch
  const checkRewardClaimed = useCallback(async (epoch: string): Promise<boolean> => {
    const contract = getContract();
    if (!contract || !account) return false;

    try {
      const epochNumber = parseInt(epoch);
      const hasClaimed = await contract.hasClaimedReward(account, epochNumber);
      
      setRewardInfo(prev => ({
        ...prev,
        hasClaimed: { ...prev.hasClaimed, [epoch]: hasClaimed }
      }));
      
      return hasClaimed;
    } catch (error: any) {
      console.error('Failed to check reward claimed status:', error);
      return false;
    }
  }, [getContract, account]);

  // Get total distributed amount for current user
  const getAffiliateTotal = useCallback(async (): Promise<string> => {
    const contract = getContract();
    if (!contract || !account) return '0';

    try {
      const total = await contract.getAffiliateTotal(account);
      return ethers.formatUnits(total, 18);
    } catch (error: any) {
      throw new Error(`Failed to get affiliate total: ${error.message}`);
    }
  }, [getContract, account]);

  // Claim reward with signature
  const claimReward = useCallback(async (
    epoch: string, 
    amount: string, 
    signature: string
  ): Promise<string> => {
    const contract = getContract();
    if (!contract || !signer) {
      throw new Error('Contract not available or wallet not connected');
    }

    try {
      const epochNumber = parseInt(epoch);
      const parsedAmount = ethers.parseUnits(amount, 18);

      // Check if already claimed
      const alreadyClaimed = await contract.hasClaimedReward(account, epochNumber);
      if (alreadyClaimed) {
        throw new Error('Reward already claimed for this epoch');
      }

      const tx = await (contract.connect(signer) as any).claimReward(
        parsedAmount,
        epochNumber,
        signature
      );

      // Show pending toast
      toast({
        title: 'Transaction Submitted',
        description: `Claiming ${amount} IAS tokens for epoch ${epoch}...`,
      });

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast({
          title: 'Reward Claimed!',
          description: `Successfully claimed ${amount} IAS tokens`,
        });

        // Refresh reward info
        setTimeout(refreshRewardInfo, 2000);
      }

      return tx.hash;
    } catch (error: any) {
      toast({
        title: 'Claim Failed',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [getContract, signer, account, toast, refreshRewardInfo]);

  // Batch distribute rewards (admin only)
  const batchDistributeRewards = useCallback(async (
    affiliates: string[],
    amounts: string[],
    epoch: string
  ): Promise<string> => {
    const contract = getContract();
    if (!contract || !signer) {
      throw new Error('Contract not available or wallet not connected');
    }

    try {
      if (affiliates.length !== amounts.length) {
        throw new Error('Affiliates and amounts arrays must have the same length');
      }

      const epochNumber = parseInt(epoch);
      const parsedAmounts = amounts.map(amount => ethers.parseUnits(amount, 18));

      const tx = await (contract.connect(signer) as any).batchDistributeRewards(
        affiliates,
        parsedAmounts,
        epochNumber
      );

      toast({
        title: 'Distribution Submitted',
        description: `Distributing rewards to ${affiliates.length} affiliates...`,
      });

      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast({
          title: 'Distribution Complete!',
          description: `Successfully distributed rewards to ${affiliates.length} affiliates`,
        });

        // Refresh reward info
        setTimeout(refreshRewardInfo, 2000);
      }

      return tx.hash;
    } catch (error: any) {
      toast({
        title: 'Distribution Failed',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  }, [getContract, signer, toast, refreshRewardInfo]);

  // Load reward info when contract becomes available
  useEffect(() => {
    if (contractAddress && provider && account && isConnected) {
      refreshRewardInfo();
    }
  }, [contractAddress, provider, account, isConnected, refreshRewardInfo]);

  // Listen for reward events
  useEffect(() => {
    const contract = getContract();
    if (!contract || !account) return;

    const handleRewardClaimed = (affiliate: string, amount: bigint, epoch: bigint) => {
      if (affiliate.toLowerCase() === account.toLowerCase()) {
        toast({
          title: 'Reward Claimed!',
          description: `Claimed ${ethers.formatUnits(amount, 18)} IAS tokens`,
        });
        refreshRewardInfo();
      }
    };

    const handleRewardDistributed = (affiliate: string, amount: bigint, epoch: bigint) => {
      if (affiliate.toLowerCase() === account.toLowerCase()) {
        toast({
          title: 'Reward Available!',
          description: `${ethers.formatUnits(amount, 18)} IAS tokens available to claim`,
        });
        refreshRewardInfo();
      }
    };

    // Listen for events
    contract.on('RewardClaimed', handleRewardClaimed);
    contract.on('RewardDistributed', handleRewardDistributed);

    return () => {
      contract.off('RewardClaimed', handleRewardClaimed);
      contract.off('RewardDistributed', handleRewardDistributed);
    };
  }, [getContract, account, toast, refreshRewardInfo]);

  return {
    ...rewardInfo,
    claimReward,
    checkRewardClaimed,
    getAffiliateTotal,
    refreshRewardInfo,
    batchDistributeRewards,
  };
}