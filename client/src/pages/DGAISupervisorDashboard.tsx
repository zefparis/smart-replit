import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Brain,
  Activity,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Link,
  DollarSign,
  Users,
  BarChart3,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Eye,
  AlertCircle,
  Bot,
  Cpu,
  Network,
  HardDrive
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SupervisorStatus {
  isRunning: boolean;
  health: {
    overall: 'healthy' | 'warning' | 'critical';
    components: {
      database: 'online' | 'slow' | 'offline';
      blockchain: 'synced' | 'syncing' | 'disconnected';
      scrapers: 'running' | 'partial' | 'stopped';
      aiModels: 'available' | 'limited' | 'unavailable';
    };
    metrics: {
      totalClicks24h: number;
      fraudDetectionRate: number;
      rewardsPending: number;
      systemUptime: number;
    };
    lastChecked: string;
  };
  metrics: {
    clicksProcessed: number;
    fraudDetected: number;
    rewardsDistributed: number;
    aiDecisionsMade: number;
    systemAlertsTriggered: number;
    uptime: number;
  };
  recentDecisions: AIDecision[];
  healthScore: number;
  autonomyLevel: string;
  lastDecisionTime: string | null;
}

interface AIDecision {
  id: string;
  type: 'fraud_detection' | 'reward_approval' | 'batch_trigger' | 'anomaly_response';
  confidence: number;
  decision: string;
  reasoning: string[];
  actions: string[];
  timestamp: string;
  executedActions: string[];
}

interface BatchEvaluation {
  shouldTriggerBatch: boolean;
  reasoning: string[];
  estimatedRewards: number;
  affectedUsers: number;
  nextEvaluation: string;
  costEstimate: number;
}

export default function DGAISupervisorDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null);

  // Récupérer le statut du superviseur
  const { data: supervisorStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['dg-ai-supervisor', 'status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dg-ai-supervisor/status');
      const data = await response.json();
      return data.status as SupervisorStatus;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Récupérer l'évaluation de batch
  const { data: batchEvaluation } = useQuery({
    queryKey: ['dg-ai-supervisor', 'batch-evaluation'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dg-ai-supervisor/batch-evaluation');
      const data = await response.json();
      return data.evaluation as BatchEvaluation;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutation pour démarrer/arrêter le superviseur
  const toggleSupervisorMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      const response = await apiRequest('POST', `/api/dg-ai-supervisor/${action}`);
      return response.json();
    },
    onSuccess: (data, action) => {
      toast({
        title: action === 'start' ? 'DG AI Supervisor Started' : 'DG AI Supervisor Stopped',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['dg-ai-supervisor'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Operation Failed',
        description: error.message || 'Failed to toggle supervisor',
        variant: 'destructive',
      });
    },
  });

  // Mutation pour forcer un batch
  const forceBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/dg-ai-supervisor/force-batch');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Batch Distribution Triggered',
        description: `Transaction hash: ${data.transactionHash}`,
      });
      queryClient.invalidateQueries({ queryKey: ['dg-ai-supervisor'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Batch Failed',
        description: error.message || 'Failed to trigger batch distribution',
        variant: 'destructive',
      });
    },
  });

  const handleToggleSupervisor = () => {
    const action = supervisorStatus?.isRunning ? 'stop' : 'start';
    toggleSupervisorMutation.mutate(action);
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'online':
      case 'synced':
      case 'running':
      case 'available':
        return 'text-green-600 bg-green-100';
      case 'warning':
      case 'slow':
      case 'syncing':
      case 'partial':
      case 'limited':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
      case 'offline':
      case 'disconnected':
      case 'stopped':
      case 'unavailable':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'fraud_detection':
        return <Shield className="w-4 h-4" />;
      case 'reward_approval':
        return <DollarSign className="w-4 h-4" />;
      case 'batch_trigger':
        return <Zap className="w-4 h-4" />;
      case 'anomaly_response':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (statusLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading DG AI Supervisor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="dg-ai-supervisor-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            DG AI Supervisor
          </h1>
          <p className="text-muted-foreground">
            Autonomous orchestration for affiliate management and fraud detection
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge 
            className={`${supervisorStatus?.isRunning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            data-testid="supervisor-status-badge"
          >
            {supervisorStatus?.isRunning ? 'ACTIVE' : 'STOPPED'}
          </Badge>
          
          <Button
            onClick={handleToggleSupervisor}
            disabled={toggleSupervisorMutation.isPending}
            className={supervisorStatus?.isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            data-testid="toggle-supervisor-button"
          >
            {toggleSupervisorMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : supervisorStatus?.isRunning ? (
              <Pause className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {supervisorStatus?.isRunning ? 'Stop Supervisor' : 'Start Supervisor'}
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={supervisorStatus?.healthScore || 0} className="flex-1" />
              <span className="text-sm font-medium">{supervisorStatus?.healthScore || 0}%</span>
            </div>
            <Badge className={`mt-2 ${getHealthColor(supervisorStatus?.health.overall || 'offline')}`}>
              {supervisorStatus?.health.overall?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI Decisions (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisorStatus?.metrics.aiDecisionsMade || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last: {supervisorStatus?.lastDecisionTime ? 
                new Date(supervisorStatus.lastDecisionTime).toLocaleTimeString() : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fraud Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisorStatus?.metrics.fraudDetected || 0}</div>
            <p className="text-xs text-muted-foreground">
              {supervisorStatus?.health.metrics.totalClicks24h || 0} total clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rewards Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisorStatus?.health.metrics.rewardsPending || 0}</div>
            <p className="text-xs text-muted-foreground">
              ${batchEvaluation?.estimatedRewards.toFixed(2) || '0.00'} value
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="decisions">AI Decisions</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="batch">Batch Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span className="text-sm">Database</span>
                    <Badge className={getHealthColor(supervisorStatus?.health.components.database || 'offline')}>
                      {supervisorStatus?.health.components.database || 'Unknown'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    <span className="text-sm">Blockchain</span>
                    <Badge className={getHealthColor(supervisorStatus?.health.components.blockchain || 'disconnected')}>
                      {supervisorStatus?.health.components.blockchain || 'Unknown'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    <span className="text-sm">Scrapers</span>
                    <Badge className={getHealthColor(supervisorStatus?.health.components.scrapers || 'stopped')}>
                      {supervisorStatus?.health.components.scrapers || 'Unknown'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    <span className="text-sm">AI Models</span>
                    <Badge className={getHealthColor(supervisorStatus?.health.components.aiModels || 'unavailable')}>
                      {supervisorStatus?.health.components.aiModels || 'Unknown'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uptime</span>
                    <span>{formatUptime(supervisorStatus?.metrics.uptime || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Autonomy Level</span>
                    <Badge variant="outline">{supervisorStatus?.autonomyLevel || 'Disabled'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Decisions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Recent AI Decisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {supervisorStatus?.recentDecisions.slice(0, 5).map((decision) => (
                    <div 
                      key={decision.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDecision(decision)}
                    >
                      <div className="p-1 rounded-full bg-blue-100">
                        {getDecisionIcon(decision.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{decision.decision}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(decision.timestamp).toLocaleTimeString()} • 
                          Confidence: {Math.round(decision.confidence * 100)}%
                        </p>
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                  
                  {(!supervisorStatus?.recentDecisions || supervisorStatus.recentDecisions.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bot className="w-8 h-8 mx-auto mb-2" />
                      <p>No AI decisions yet</p>
                      <p className="text-xs">Start the supervisor to see AI-driven decisions</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Decision History</CardTitle>
              <CardDescription>
                Detailed view of all AI-driven decisions and their reasoning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supervisorStatus?.recentDecisions.map((decision) => (
                  <div key={decision.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getDecisionIcon(decision.type)}
                        <Badge variant="outline">{decision.type.replace('_', ' ')}</Badge>
                        <span className="font-medium">{decision.decision}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {new Date(decision.timestamp).toLocaleString()}
                        </div>
                        <Badge className={decision.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {Math.round(decision.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Reasoning:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {decision.reasoning.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-1">Actions:</h4>
                        <div className="flex flex-wrap gap-1">
                          {decision.actions.map((action, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Component Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(supervisorStatus?.health.components || {}).map(([component, status]) => (
                  <div key={component} className="flex items-center justify-between">
                    <span className="capitalize">{component}</span>
                    <Badge className={getHealthColor(status)}>{status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Clicks (24h)</span>
                    <span className="font-medium">{supervisorStatus?.health.metrics.totalClicks24h || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fraud Rate</span>
                    <span className="font-medium">
                      {((supervisorStatus?.health.metrics.fraudDetectionRate || 0) / 
                        Math.max(1, supervisorStatus?.health.metrics.totalClicks24h || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Rewards</span>
                    <span className="font-medium">{supervisorStatus?.health.metrics.rewardsPending || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Distribution Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Should Trigger Batch</span>
                  <Badge className={batchEvaluation?.shouldTriggerBatch ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {batchEvaluation?.shouldTriggerBatch ? 'YES' : 'NO'}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Estimated Rewards</span>
                    <span className="font-medium">${batchEvaluation?.estimatedRewards.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Affected Users</span>
                    <span className="font-medium">{batchEvaluation?.affectedUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gas Cost Estimate</span>
                    <span className="font-medium">${batchEvaluation?.costEstimate.toFixed(2) || '0.00'}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">AI Reasoning:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {batchEvaluation?.reasoning.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button 
                  onClick={() => forceBatchMutation.mutate()}
                  disabled={forceBatchMutation.isPending || !batchEvaluation?.affectedUsers}
                  className="w-full"
                  data-testid="force-batch-button"
                >
                  {forceBatchMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Force Batch Distribution
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Decision Detail Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getDecisionIcon(selectedDecision.type)}
                AI Decision Details
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4"
                onClick={() => setSelectedDecision(null)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Decision</h4>
                <p className="text-muted-foreground">{selectedDecision.decision}</p>
              </div>
              
              <div>
                <h4 className="font-medium">Type & Confidence</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{selectedDecision.type.replace('_', ' ')}</Badge>
                  <Badge>{Math.round(selectedDecision.confidence * 100)}% confidence</Badge>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium">Reasoning</h4>
                <ul className="mt-1 space-y-1">
                  {selectedDecision.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1 h-1 bg-current rounded-full mt-2 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium">Actions</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDecision.actions.map((action, idx) => (
                    <Badge key={idx} variant="secondary">{action}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium">Timestamp</h4>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedDecision.timestamp).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}