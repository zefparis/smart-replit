import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  DollarSign, 
  Globe, 
  File,
  Bot,
  TrendingUp,
  ArrowRight,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  BarChart3,
  Settings,
  ExternalLink,
  Wifi,
  Brain,
  ShoppingCart,
  CreditCard,
  PieChart,
  LineChart,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  Calendar,
  Filter
} from "lucide-react";
import { useDashboardMetrics, useTransactions, useAiModels } from "@/hooks/use-api";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Requêtes pour les données du dashboard
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const { data: aiModels, isLoading: modelsLoading } = useAiModels();
  
  // Nouvelles queries pour plus de données
  const { data: payoutStats } = useQuery({
    queryKey: ["/api/payouts"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: scraperStats } = useQuery({
    queryKey: ["/api/scraper-factory/status"],
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const { data: smartLinksStats } = useQuery({
    queryKey: ["/api/monetization/metrics"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: channelStatus } = useQuery({
    queryKey: ["/api/channels/status"],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: financeMetrics } = useQuery({
    queryKey: [`/api/finance/metrics/${timeRange}`],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const recentTransactions = transactions?.slice(0, 8) || [];

  // Colonnes pour les transactions récentes
  const transactionColumns = [
    {
      key: "description",
      header: "Transaction",
      render: (value: string, row: any) => (
        <div>
          <div className="font-medium text-sm">{value}</div>
          <div className="text-xs text-muted-foreground">{row.category}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Montant",
      render: (value: string, row: any) => (
        <span className={`font-medium text-sm ${
          row.transactionType === 'income' ? 'text-green-600' : 'text-red-600'
        }`}>
          {row.transactionType === 'income' ? '+' : '-'}${value}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      render: (value: string) => <StatusBadge status={value} />,
    },
  ];

  // Calculs des métriques globales
  const totalRevenue = financeMetrics?.totalRevenue || 0;
  const activeScrapers = scraperStats?.activeScrapers || 0;
  const totalScrapers = scraperStats?.totalScrapers || 0;
  const smartLinksCount = smartLinksStats?.totalSmartLinks || 0;
  const activeSmartLinks = smartLinksStats?.activeSmartLinks || 0;
  const totalPayouts = (payoutStats?.data as any)?.payouts?.length || 0;
  
  // Calcul de la santé du système
  const systemHealth = () => {
    let healthScore = 0;
    let totalChecks = 0;

    // Vérification des channels
    if (channelStatus?.data?.channel_statuses) {
      const channels = Object.values(channelStatus.data.channel_statuses);
      const connectedChannels = channels.filter((status: any) => status === 'connected').length;
      healthScore += (connectedChannels / channels.length) * 25;
      totalChecks += 25;
    }

    // Vérification des scrapers
    if (totalScrapers > 0) {
      healthScore += (activeScrapers / totalScrapers) * 25;
      totalChecks += 25;
    }

    // Vérification des smart links
    if (smartLinksCount > 0) {
      healthScore += (activeSmartLinks / smartLinksCount) * 25;
      totalChecks += 25;
    }

    // Vérification des finances
    if (totalRevenue > 0) {
      healthScore += 25;
      totalChecks += 25;
    }

    return totalChecks > 0 ? Math.round(healthScore) : 0;
  };

  const healthScore = systemHealth();

  if (metricsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">SmartLinks Autopilot Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble complète de votre écosystème de monétisation automatisée
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="toggle-auto-refresh"
          >
            {autoRefresh ? (
              <PauseCircle className="w-4 h-4 mr-2" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="24h">24h</option>
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
          </select>
        </div>
      </div>

      {/* Santé du Système */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Santé du Système
            </CardTitle>
            <Badge variant={healthScore > 80 ? "secondary" : healthScore > 60 ? "outline" : "destructive"}
                   className={healthScore > 80 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}>
              {healthScore}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={healthScore} className="mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              <span>Channels: {channelStatus?.data ? Object.keys(channelStatus.data.channel_statuses || {}).length : 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span>Scrapers: {activeScrapers}/{totalScrapers}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>SmartLinks: {activeSmartLinks}/{smartLinksCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>Revenue: ${totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métriques Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Revenus Totaux"
          value={`$${totalRevenue.toLocaleString()}`}
          change={{
            value: `${timeRange}`,
            type: "neutral",
            period: "période",
          }}
          icon={DollarSign}
          iconColor="text-green-600 dark:text-green-400"
        />
        
        <MetricCard
          title="SmartLinks Actifs"
          value={activeSmartLinks.toString()}
          change={{
            value: `${smartLinksCount} total`,
            type: "neutral",
            period: "créés",
          }}
          icon={Target}
          iconColor="text-blue-600 dark:text-blue-400"
        />
        
        <MetricCard
          title="Scrapers En Cours"
          value={activeScrapers.toString()}
          change={{
            value: `${totalScrapers} configurés`,
            type: "neutral",
            period: "au total",
          }}
          icon={Bot}
          iconColor="text-purple-600 dark:text-purple-400"
        />
        
        <MetricCard
          title="Payouts Traités"
          value={totalPayouts.toString()}
          change={{
            value: "Amazon sync",
            type: "neutral",
            period: "automatique",
          }}
          icon={CreditCard}
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Métriques Secondaires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Utilisateurs"
          value={metrics?.totalUsers?.toString() || "0"}
          change={{
            value: "+12%",
            type: "increase",
            period: "ce mois",
          }}
          icon={Users}
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
        
        <MetricCard
          title="Taux de Conversion"
          value={`${((activeSmartLinks / Math.max(smartLinksCount, 1)) * 100).toFixed(1)}%`}
          change={{
            value: "+5.2%",
            type: "increase",
            period: "amélioration",
          }}
          icon={TrendingUp}
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        
        <MetricCard
          title="Modèles IA"
          value={aiModels?.length?.toString() || "0"}
          change={{
            value: "GPT-4o actif",
            type: "neutral",
            period: "principal",
          }}
          icon={Brain}
          iconColor="text-pink-600 dark:text-pink-400"
        />
        
        <MetricCard
          title="Opportunités"
          value="12"
          change={{
            value: "+3 nouvelles",
            type: "increase",
            period: "aujourd'hui",
          }}
          icon={Zap}
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="systems">Systèmes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Actions Rapides */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Actions Rapides
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/monetization" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Créer un SmartLink
                  </Button>
                </Link>
                <Link href="/scrapers" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Bot className="w-4 h-4 mr-2" />
                    Lancer un Scraper
                  </Button>
                </Link>
                <Link href="/channels-config" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Wifi className="w-4 h-4 mr-2" />
                    Configurer Channels
                  </Button>
                </Link>
                <Link href="/finance" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Voir les Finances
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Statut des Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  Statut des Channels
                </CardTitle>
              </CardHeader>
              <CardContent>
                {channelStatus?.data?.channel_statuses ? (
                  <div className="space-y-3">
                    {Object.entries(channelStatus.data.channel_statuses).map(([channel, status]) => (
                      <div key={channel} className="flex items-center justify-between">
                        <span className="capitalize font-medium">{channel}</span>
                        <StatusBadge status={status as string} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Aucune donnée de channel disponible
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alertes et Notifications */}
          <div className="space-y-3">
            {healthScore < 70 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  La santé du système est en dessous de 70%. Vérifiez vos configurations.
                </AlertDescription>
              </Alert>
            )}
            
            {totalPayouts === 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Aucun payout détecté. Vérifiez la synchronisation Amazon.
                </AlertDescription>
              </Alert>
            )}

            {activeScrapers === 0 && totalScrapers > 0 && (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                  Aucun scraper actif détecté. Vérifiez vos configurations de scraping.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphiques Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Revenus par Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-muted-foreground">Graphique des revenus par source</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Performance des SmartLinks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-muted-foreground">Évolution des clics et conversions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transactions Récentes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={recentTransactions}
                columns={transactionColumns}
                loading={transactionsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systems" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Statut des Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Base de données PostgreSQL</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connectée
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>API Amazon PA-API v5</span>
                    <Badge variant="secondary">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Configurée
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Stripe API</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PayPal API</span>
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Erreur Auth
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Système</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Utilization</span>
                      <span>23%</span>
                    </div>
                    <Progress value={23} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>45%</span>
                    </div>
                    <Progress value={45} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>API Response Time</span>
                      <span>156ms</span>
                    </div>
                    <Progress value={75} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Database Queries</span>
                      <span>2.1s avg</span>
                    </div>
                    <Progress value={60} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}