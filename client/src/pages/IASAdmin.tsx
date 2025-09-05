import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Settings,
  Users, 
  TrendingUp, 
  Activity,
  Coins,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Send,
  Zap,
  BarChart3,
  Shield,
  DollarSign,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DashboardStats {
  currentEpoch: string;
  dailyStats: {
    totalClicks: number;
    validClicks: number;
    eligibleClicks: number;
    averageFraudScore: number;
    period: string;
  };
  weeklyStats: {
    totalClicks: number;
    validClicks: number;
    eligibleClicks: number;
    averageFraudScore: number;
    period: string;
  };
  contractInfo: {
    tokenAddress: string;
    distributorAddress: string;
    totalDistributed: string;
    contractBalance: string;
    network: string;
  };
}

interface BatchDistributionRequest {
  affiliates: string[];
  amounts: string[];
  epoch: string;
}

export default function IASAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [distributionData, setDistributionData] = useState<BatchDistributionRequest>({
    affiliates: [],
    amounts: [],
    epoch: new Date().toISOString().split('T')[0] // Today's date as epoch
  });

  // Récupérer les statistiques du dashboard admin
  const { data: dashboardStats, isLoading: loadingStats } = useQuery({
    queryKey: ['ias', 'dashboard-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ias/dashboard/stats');
      const data = await response.json();
      return data as DashboardStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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

  // Mutation pour calculer les rewards d'une époque
  const calculateRewardsMutation = useMutation({
    mutationFn: async (epoch: string) => {
      const response = await apiRequest('POST', '/api/ias/rewards/calculate', { epoch });
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Rewards Calculated!',
        description: 'Epoch rewards have been calculated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['ias'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Calculation Failed',
        description: error.message || 'Failed to calculate rewards',
        variant: 'destructive',
      });
    },
  });

  // Mutation pour distribution en batch
  const batchDistributeMutation = useMutation({
    mutationFn: async (data: BatchDistributionRequest) => {
      const response = await apiRequest('POST', '/api/ias/distribution/batch', data);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'Distribution Successful!',
        description: `Distributed ${data.distributedAmount} IAS to ${data.affiliatesCount} affiliates`,
      });
      queryClient.invalidateQueries({ queryKey: ['ias'] });
      // Reset form
      setDistributionData({
        affiliates: [],
        amounts: [],
        epoch: new Date().toISOString().split('T')[0]
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Distribution Failed',
        description: error.message || 'Failed to distribute rewards',
        variant: 'destructive',
      });
    },
  });

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 4 
    });
  };

  const formatDate = (epoch: string) => {
    return new Date(epoch + 'T00:00:00Z').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCalculateRewards = async () => {
    const epoch = distributionData.epoch;
    if (!epoch) {
      toast({
        title: 'Missing Epoch',
        description: 'Please select an epoch date',
        variant: 'destructive',
      });
      return;
    }
    
    calculateRewardsMutation.mutate(epoch);
  };

  const handleAddAffiliate = () => {
    setDistributionData(prev => ({
      ...prev,
      affiliates: [...prev.affiliates, ''],
      amounts: [...prev.amounts, '']
    }));
  };

  const handleRemoveAffiliate = (index: number) => {
    setDistributionData(prev => ({
      ...prev,
      affiliates: prev.affiliates.filter((_, i) => i !== index),
      amounts: prev.amounts.filter((_, i) => i !== index)
    }));
  };

  const handleAffiliateChange = (index: number, field: 'address' | 'amount', value: string) => {
    setDistributionData(prev => {
      if (field === 'address') {
        const newAffiliates = [...prev.affiliates];
        newAffiliates[index] = value;
        return { ...prev, affiliates: newAffiliates };
      } else {
        const newAmounts = [...prev.amounts];
        newAmounts[index] = value;
        return { ...prev, amounts: newAmounts };
      }
    });
  };

  const handleBatchDistribute = async () => {
    if (distributionData.affiliates.length === 0) {
      toast({
        title: 'No Affiliates',
        description: 'Please add at least one affiliate to distribute rewards',
        variant: 'destructive',
      });
      return;
    }

    if (distributionData.affiliates.some(addr => !addr) || distributionData.amounts.some(amt => !amt)) {
      toast({
        title: 'Missing Data',
        description: 'Please fill all affiliate addresses and amounts',
        variant: 'destructive',
      });
      return;
    }

    batchDistributeMutation.mutate(distributionData);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="ias-admin-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IAS Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor blockchain rewards and manage IAS token distribution
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['ias'] });
          }}
          data-testid="button-refresh-admin"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Distributed */}
        <Card data-testid="card-total-distributed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distributed</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-distributed">
              {loadingStats ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                `${formatAmount(dashboardStats?.contractInfo.totalDistributed || '0')} IAS`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              All-time rewards distributed
            </p>
          </CardContent>
        </Card>

        {/* Contract Balance */}
        <Card data-testid="card-contract-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-contract-balance">
              {loadingStats ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                `${formatAmount(dashboardStats?.contractInfo.contractBalance || '0')} IAS`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for distribution
            </p>
          </CardContent>
        </Card>

        {/* Daily Clicks */}
        <Card data-testid="card-daily-clicks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Valid Clicks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daily-clicks">
              {loadingStats ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                dashboardStats?.dailyStats.eligibleClicks || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of {dashboardStats?.dailyStats.totalClicks || 0} total clicks
            </p>
          </CardContent>
        </Card>

        {/* Weekly Performance */}
        <Card data-testid="card-weekly-performance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Performance</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-weekly-performance">
              {loadingStats ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                `${Math.round((dashboardStats?.weeklyStats.eligibleClicks || 0) / (dashboardStats?.weeklyStats.totalClicks || 1) * 100)}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Valid click ratio (7 days)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">Rewards</TabsTrigger>
          <TabsTrigger value="distribution" data-testid="tab-distribution">Distribution</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Click Analytics */}
          <Card data-testid="card-click-analytics">
            <CardHeader>
              <CardTitle>Click Analytics</CardTitle>
              <CardDescription>Real-time click tracking and fraud detection metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Daily Stats */}
                <div className="space-y-4">
                  <h4 className="font-medium">Today's Activity</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Clicks</span>
                      <span className="font-medium">{dashboardStats?.dailyStats.totalClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valid Clicks</span>
                      <span className="font-medium text-green-600">{dashboardStats?.dailyStats.validClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reward Eligible</span>
                      <span className="font-medium text-blue-600">{dashboardStats?.dailyStats.eligibleClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Fraud Score</span>
                      <Badge variant={
                        (dashboardStats?.dailyStats.averageFraudScore || 0) < 30 ? 'default' :
                        (dashboardStats?.dailyStats.averageFraudScore || 0) < 70 ? 'secondary' : 'destructive'
                      }>
                        {Math.round(dashboardStats?.dailyStats.averageFraudScore || 0)}%
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Weekly Stats */}
                <div className="space-y-4">
                  <h4 className="font-medium">7-Day Summary</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Clicks</span>
                      <span className="font-medium">{dashboardStats?.weeklyStats.totalClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valid Clicks</span>
                      <span className="font-medium text-green-600">{dashboardStats?.weeklyStats.validClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reward Eligible</span>
                      <span className="font-medium text-blue-600">{dashboardStats?.weeklyStats.eligibleClicks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="font-medium text-green-600">
                        {Math.round((dashboardStats?.weeklyStats.eligibleClicks || 0) / (dashboardStats?.weeklyStats.totalClicks || 1) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract Information */}
          <Card data-testid="card-contract-info">
            <CardHeader>
              <CardTitle>Smart Contract Information</CardTitle>
              <CardDescription>IAS token and reward distributor contract details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">IAS Token Contract</p>
                  <div className="flex items-center space-x-2">
                    <p className="font-mono text-sm">
                      {dashboardStats?.contractInfo.tokenAddress ? 
                        `${dashboardStats.contractInfo.tokenAddress.slice(0, 10)}...${dashboardStats.contractInfo.tokenAddress.slice(-8)}` :
                        'Not configured'
                      }
                    </p>
                    {dashboardStats?.contractInfo.tokenAddress && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={`https://sepolia.etherscan.io/token/${dashboardStats.contractInfo.tokenAddress}`}
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
                  <p className="text-sm text-muted-foreground">Distributor Contract</p>
                  <div className="flex items-center space-x-2">
                    <p className="font-mono text-sm">
                      {dashboardStats?.contractInfo.distributorAddress ? 
                        `${dashboardStats.contractInfo.distributorAddress.slice(0, 10)}...${dashboardStats.contractInfo.distributorAddress.slice(-8)}` :
                        'Not configured'
                      }
                    </p>
                    {dashboardStats?.contractInfo.distributorAddress && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={`https://sepolia.etherscan.io/address/${dashboardStats.contractInfo.distributorAddress}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          data-testid="link-distributor-contract"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Network</p>
                  <Badge variant="outline">{dashboardStats?.contractInfo.network || 'Unknown'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reward Per Click</p>
                  <p className="font-medium">{iasConfig?.rewardPerClick || '0.25'} IAS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <Card data-testid="card-rewards-management">
            <CardHeader>
              <CardTitle>Rewards Management</CardTitle>
              <CardDescription>Calculate and manage epoch-based rewards for affiliates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Epoch */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Current Epoch</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(dashboardStats?.currentEpoch || new Date().toISOString().split('T')[0])}
                    </p>
                  </div>
                  <Badge variant="outline" className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Active</span>
                  </Badge>
                </div>
              </div>

              {/* Calculate Rewards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Calculate Epoch Rewards</h4>
                    <p className="text-sm text-muted-foreground">
                      Process affiliate clicks and calculate rewards for a specific epoch
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="space-y-2">
                    <Label htmlFor="epoch-date">Epoch Date</Label>
                    <Input
                      id="epoch-date"
                      type="date"
                      value={distributionData.epoch}
                      onChange={(e) => setDistributionData(prev => ({ ...prev, epoch: e.target.value }))}
                      data-testid="input-epoch-date"
                    />
                  </div>
                  <Button
                    onClick={handleCalculateRewards}
                    disabled={calculateRewardsMutation.isPending}
                    data-testid="button-calculate-rewards"
                  >
                    {calculateRewardsMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Calculate Rewards
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-6">
          <Card data-testid="card-batch-distribution">
            <CardHeader>
              <CardTitle>Batch Token Distribution</CardTitle>
              <CardDescription>Distribute IAS tokens to multiple affiliates in a single transaction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Distribution Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Affiliate Recipients</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddAffiliate}
                    data-testid="button-add-affiliate"
                  >
                    Add Affiliate
                  </Button>
                </div>

                {distributionData.affiliates.map((affiliate, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Label>Wallet Address</Label>
                      <Input
                        placeholder="0x..."
                        value={affiliate}
                        onChange={(e) => handleAffiliateChange(index, 'address', e.target.value)}
                        data-testid={`input-affiliate-address-${index}`}
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>Amount (IAS)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={distributionData.amounts[index]}
                        onChange={(e) => handleAffiliateChange(index, 'amount', e.target.value)}
                        data-testid={`input-affiliate-amount-${index}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAffiliate(index)}
                      data-testid={`button-remove-affiliate-${index}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                {distributionData.affiliates.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No affiliates added yet</p>
                    <p className="text-sm">Click "Add Affiliate" to start batch distribution</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Distribution Summary */}
              {distributionData.affiliates.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Distribution Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-2xl font-bold">{distributionData.affiliates.length}</div>
                      <p className="text-sm text-muted-foreground">Recipients</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-2xl font-bold">
                        {formatAmount(
                          distributionData.amounts
                            .filter(amt => amt && !isNaN(parseFloat(amt)))
                            .reduce((sum, amt) => sum + parseFloat(amt), 0)
                            .toString()
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Total IAS</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-2xl font-bold">{formatDate(distributionData.epoch)}</div>
                      <p className="text-sm text-muted-foreground">Epoch</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleBatchDistribute}
                    disabled={batchDistributeMutation.isPending}
                    className="w-full"
                    size="lg"
                    data-testid="button-batch-distribute"
                  >
                    {batchDistributeMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Distributing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Execute Batch Distribution
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card data-testid="card-ias-settings">
            <CardHeader>
              <CardTitle>IAS Configuration</CardTitle>
              <CardDescription>System configuration and parameters for IAS token rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Reward Parameters</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reward per Click</span>
                      <span className="font-medium">{iasConfig?.rewardPerClick || '0.25'} IAS</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Epoch Duration</span>
                      <span className="font-medium">{Math.round((iasConfig?.epochDuration || 86400) / 3600)}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Max Clicks per Hour</span>
                      <span className="font-medium">{iasConfig?.maxClicksPerHour || '10'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Anti-Fraud Settings</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fraud Threshold</span>
                      <Badge variant="outline">30%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Min Time Between Clicks</span>
                      <span className="font-medium">30s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">IP Rate Limit</span>
                      <span className="font-medium">{iasConfig?.maxClicksPerHour || '10'}/hour</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert data-testid="alert-configuration-warning">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Configuration changes require system restart. Contact development team for parameter modifications.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}