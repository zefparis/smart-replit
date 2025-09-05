import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Coins, 
  TrendingUp, 
  Clock, 
  Gift,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Wallet,
  BarChart3
} from 'lucide-react';
import { WalletConnect } from '@/components/WalletConnect';
import { useWallet } from '@/hooks/useWallet';
import { useIASToken } from '@/hooks/useIASToken';
import { useRewardDistributor } from '@/hooks/useRewardDistributor';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PendingReward {
  epoch: string;
  amount: number;
  status: string;
  clicksCount: number;
}

interface ClickStats {
  totalClicks: number;
  validClicks: number;
  eligibleClicks: number;
  averageFraudScore: number;
}

export default function IASDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  
  const { isConnected, account, network } = useWallet();
  const iasToken = useIASToken(import.meta.env.VITE_IAS_CONTRACT_ADDRESS);
  const rewardDistributor = useRewardDistributor(import.meta.env.VITE_IAS_DISTRIBUTOR_ADDRESS);

  const isSepoliaNetwork = network?.chainId === 11155111;

  // Récupérer les rewards en attente depuis l'API
  const { data: pendingRewards, isLoading: loadingRewards } = useQuery({
    queryKey: ['ias', 'pending-rewards', account],
    queryFn: async () => {
      if (!account) return { rewards: [], totalPending: 0 };
      const response = await apiRequest('GET', `/api/ias/rewards/pending/${account}`);
      const data = await response.json();
      return data as { rewards: PendingReward[]; totalPending: number };
    },
    enabled: !!account && isConnected,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Récupérer les stats de clicks
  const { data: clickStats } = useQuery({
    queryKey: ['ias', 'click-stats'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      const response = await apiRequest('GET', `/api/ias/clicks/stats?startDate=${weekAgo}&endDate=${today}`);
      const data = await response.json();
      return data.stats as ClickStats;
    },
    enabled: isConnected,
  });

  // Récupérer la configuration IAS
  const { data: iasConfig } = useQuery({
    queryKey: ['ias', 'config'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ias/config');
      const data = await response.json();
      return data.config;
    },
  });

  // Mutation pour générer une signature de claim
  const generateSignatureMutation = useMutation({
    mutationFn: async ({ userAddress, amount, epoch }: {
      userAddress: string;
      amount: string;
      epoch: string;
    }) => {
      const response = await apiRequest('POST', '/api/ias/signature/generate', {
        userAddress, 
        amount, 
        epoch
      });
      const data = await response.json();
      return data.signature;
    },
  });

  // Claim d'un reward
  const handleClaimReward = async (reward: PendingReward) => {
    if (!account || !isSepoliaNetwork) {
      toast({
        title: 'Wrong Network',
        description: 'Please switch to Sepolia testnet to claim rewards',
        variant: 'destructive',
      });
      return;
    }

    setClaimingReward(reward.epoch);

    try {
      // 1. Générer la signature depuis l'API
      toast({
        title: 'Generating Signature...',
        description: 'Please wait while we generate your claim signature',
      });

      const signature = await generateSignatureMutation.mutateAsync({
        userAddress: account,
        amount: reward.amount.toString(),
        epoch: reward.epoch,
      });

      // 2. Claim le reward via le smart contract
      toast({
        title: 'Claiming Reward...',
        description: 'Please confirm the transaction in your wallet',
      });

      const txHash = await rewardDistributor.claimReward(
        reward.epoch,
        reward.amount.toString(),
        signature
      );

      toast({
        title: 'Reward Claimed!',
        description: `Successfully claimed ${reward.amount} IAS tokens`,
      });

      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['ias', 'pending-rewards'] });
      iasToken.refreshBalance();
      rewardDistributor.refreshRewardInfo();

    } catch (error: any) {
      console.error('Claim failed:', error);
      toast({
        title: 'Claim Failed',
        description: error.message || 'Failed to claim reward',
        variant: 'destructive',
      });
    } finally {
      setClaimingReward(null);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 4 
    });
  };

  const formatDate = (epoch: string) => {
    // Convertir epoch YYYY-MM-DD en date lisible
    return new Date(epoch + 'T00:00:00Z').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Coins className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">IAS Token Dashboard</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Track your affiliate performance, monitor IAS token rewards, and claim your earnings. 
            Connect your wallet to get started with the Le Coin IAS reward system.
          </p>
        </div>
        
        <div className="max-w-md mx-auto">
          <WalletConnect />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="ias-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IAS Token Dashboard</h1>
          <p className="text-muted-foreground">
            Track your affiliate rewards and claim IAS tokens
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['ias'] });
            iasToken.refreshBalance();
            rewardDistributor.refreshRewardInfo();
          }}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Network Warning */}
      {!isSepoliaNetwork && (
        <Alert data-testid="alert-network-warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're connected to {network?.name || 'unknown network'}. Switch to Sepolia testnet to claim IAS rewards.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* IAS Balance */}
        <Card data-testid="card-ias-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IAS Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ias-balance">
              {iasToken.isLoading ? (
                <div className="flex items-center">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                `${formatAmount(parseFloat(iasToken.balance || '0'))} IAS`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Current wallet balance
            </p>
          </CardContent>
        </Card>

        {/* Pending Rewards */}
        <Card data-testid="card-pending-rewards">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-pending-rewards">
              {loadingRewards ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                `${formatAmount(pendingRewards?.totalPending || 0)} IAS`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available to claim
            </p>
          </CardContent>
        </Card>

        {/* Total Distributed */}
        <Card data-testid="card-total-distributed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-earned">
              {rewardDistributor.isLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                `${formatAmount(parseFloat(rewardDistributor.totalDistributed || '0'))} IAS`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime rewards
            </p>
          </CardContent>
        </Card>

        {/* Valid Clicks */}
        <Card data-testid="card-valid-clicks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Clicks (7d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-valid-clicks">
              {clickStats?.eligibleClicks || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of {clickStats?.totalClicks || 0} total clicks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="rewards" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rewards" data-testid="tab-rewards">Pending Rewards</TabsTrigger>
          <TabsTrigger value="wallet" data-testid="tab-wallet">Wallet</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Pending Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <Card data-testid="card-rewards-list">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gift className="mr-2 h-5 w-5" />
                Claimable Rewards
              </CardTitle>
              <CardDescription>
                Your earned rewards ready to be claimed. Rewards are calculated daily based on valid affiliate clicks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRewards ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading rewards...
                </div>
              ) : pendingRewards?.rewards?.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending rewards at the moment</p>
                  <p className="text-sm">Keep driving traffic to earn IAS tokens!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRewards?.rewards?.map((reward) => (
                    <div 
                      key={reward.epoch} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`reward-item-${reward.epoch}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">Epoch {formatDate(reward.epoch)}</h4>
                          <Badge variant="secondary">{reward.clicksCount} clicks</Badge>
                        </div>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          {formatAmount(reward.amount)} IAS
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Earned from {reward.clicksCount} valid affiliate clicks
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={reward.status === 'calculated' ? 'default' : 'outline'}
                          data-testid={`reward-status-${reward.epoch}`}
                        >
                          {reward.status}
                        </Badge>
                        <Button
                          onClick={() => handleClaimReward(reward)}
                          disabled={!isSepoliaNetwork || claimingReward === reward.epoch}
                          data-testid={`button-claim-${reward.epoch}`}
                        >
                          {claimingReward === reward.epoch ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Claim
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet" className="space-y-6">
          <WalletConnect 
            showBalance={true}
            showAddToken={true}
            className="max-w-2xl"
          />
          
          {/* Token Information */}
          <Card data-testid="card-token-info">
            <CardHeader>
              <CardTitle>IAS Token Information</CardTitle>
              <CardDescription>
                Details about the IAS token contract and configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Token Symbol</p>
                  <p className="font-mono">{iasToken.symbol || 'IAS'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Decimals</p>
                  <p className="font-mono">{iasToken.decimals || 18}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contract Address</p>
                  <div className="flex items-center space-x-2">
                    <p className="font-mono text-sm">
                      {import.meta.env.VITE_IAS_CONTRACT_ADDRESS ? 
                        `${import.meta.env.VITE_IAS_CONTRACT_ADDRESS.slice(0, 10)}...${import.meta.env.VITE_IAS_CONTRACT_ADDRESS.slice(-8)}` :
                        'Not configured'
                      }
                    </p>
                    {import.meta.env.VITE_IAS_CONTRACT_ADDRESS && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={`https://sepolia.etherscan.io/token/${import.meta.env.VITE_IAS_CONTRACT_ADDRESS}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          data-testid="link-token-contract"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reward Per Click</p>
                  <p className="font-mono">{iasConfig?.rewardPerClick || '0.25'} IAS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
          <Card data-testid="card-click-stats">
            <CardHeader>
              <CardTitle>Click Performance (Last 7 Days)</CardTitle>
              <CardDescription>
                Overview of your affiliate link performance and fraud detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{clickStats?.totalClicks || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{clickStats?.validClicks || 0}</div>
                  <p className="text-sm text-muted-foreground">Valid Clicks</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{clickStats?.eligibleClicks || 0}</div>
                  <p className="text-sm text-muted-foreground">Reward Eligible</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {clickStats?.averageFraudScore ? Math.round(clickStats.averageFraudScore) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Fraud Score</p>
                </div>
              </div>
              
              {clickStats && clickStats.totalClicks > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Performance Insights</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      • <strong>{Math.round((clickStats.validClicks / clickStats.totalClicks) * 100)}%</strong> of your clicks passed fraud detection
                    </p>
                    <p>
                      • <strong>{Math.round((clickStats.eligibleClicks / clickStats.totalClicks) * 100)}%</strong> of your clicks are eligible for rewards
                    </p>
                    <p>
                      • Estimated earnings: <strong>{formatAmount((clickStats.eligibleClicks || 0) * (iasConfig?.rewardPerClick || 0.25))} IAS</strong>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}