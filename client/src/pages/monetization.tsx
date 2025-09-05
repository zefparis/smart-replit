import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  TrendingUp, 
  DollarSign, 
  Link2, 
  Eye, 
  MousePointer, 
  Zap, 
  Plus,
  ExternalLink,
  BarChart3,
  Bot,
  AlertCircle,
  Brain,
  Loader2,
  Activity,
  Target,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SmartLink {
  id: string;
  name: string;
  originalUrl: string;
  shortCode: string;
  affiliateUrl?: string;
  commissionRate: string;
  status: "active" | "paused" | "expired" | "disabled";
  description?: string;
  tags?: string[];
  userId: string;
  createdAt: string;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  potentialRevenue?: string;
  confidence: string;
  status: "detected" | "analyzing" | "active" | "completed" | "rejected";
  sourceUrl?: string;
  createdAt: string;
}

interface MonetizationMetrics {
  totalSmartLinks: number;
  activeSmartLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalExternalRevenue: number;
  totalCommissionRevenue: number;
  totalMonetizationRevenue: number;
  totalOpportunities: number;
  activeOpportunities: number;
}

export default function MonetizationPage() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [amazonInput, setAmazonInput] = useState("");
  const [amazonLocale, setAmazonLocale] = useState("fr_FR");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch monetization metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<MonetizationMetrics>({
    queryKey: ["/api/monetization/metrics"],
  });

  // Fetch smart links
  const { data: smartLinks = [], isLoading: linksLoading } = useQuery<SmartLink[]>({
    queryKey: ["/api/monetization/smart-links"],
  });

  // Fetch opportunities
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/monetization/opportunities"],
  });

  // Create smart link mutation
  const createSmartLinkMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/monetization/smart-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create smart link");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/smart-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/metrics"] });
      toast({
        title: "SmartLink créé",
        description: "Le SmartLink a été créé avec succès",
      });
      setIsCreatingLink(false);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le SmartLink",
        variant: "destructive",
      });
    },
  });

  // Run AI detection mutation
  const runDetectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/monetization/run-detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to run AI detection");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/metrics"] });
      toast({
        title: "Détection IA terminée",
        description: `${data.result?.opportunities_detected || 0} opportunités détectées, ${data.result?.smart_links_created || 0} SmartLinks créés`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec de la détection IA",
        variant: "destructive",
      });
    },
  });

  // Growth Hacker AI V3 mutation
  const growthHackerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/monetization/growth-hacker-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 12, save_to_db: true }),
      });
      if (!response.ok) throw new Error("Failed to run Growth Hacker AI V3");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/metrics"] });
      toast({
        title: "Growth Hacker AI V3 terminé",
        description: `${data.count || 0} opportunités haute valeur détectées avec A/B testing`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec du Growth Hacker AI V3",
        variant: "destructive",
      });
    },
  });

  // Launch Campaign mutation
  const launchCampaignMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      const response = await fetch("/api/campaigns/launch-from-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          opportunity_id: opportunityId, 
          auto_launch: true 
        }),
      });
      if (!response.ok) throw new Error("Failed to launch campaign");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/metrics"] });
      toast({
        title: "🚀 Campagne Lancée",
        description: `Campagne ${data.campaign_created?.variants_count || 0} variantes A/B lancée avec succès sur multiple canaux`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec du lancement de campagne",
        variant: "destructive",
      });
    },
  });

  // Analytics queries
  const { data: winnersReport } = useQuery<any>({
    queryKey: ["/api/analytics/winners-report"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: channelsStatus } = useQuery<any>({
    queryKey: ["/api/channels/status"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Auto-optimization mutation
  const autoOptimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analytics/auto-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to run auto-optimization");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Auto-Optimisation Terminée",
        description: `${data.summary?.optimized_campaigns || 0} campagnes optimisées automatiquement`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec de l'auto-optimisation",
        variant: "destructive",
      });
    },
  });

  // Channel test mutation
  const testChannelsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to test channels");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/status"] });
      toast({
        title: "Test des Canaux Terminé",
        description: "Vérifiez les statuts pour voir les résultats",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec du test des canaux",
        variant: "destructive",
      });
    },
  });

  // Create Amazon SmartLink mutation
  const createAmazonSmartLinkMutation = useMutation({
    mutationFn: async (data: { input: string; locale?: string }) => {
      const response = await fetch("/api/monetization/smart-links/amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create Amazon smart link");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/smart-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monetization/metrics"] });
      const metaInfo = data.smartLink?.meta ? " avec métadonnées PA-API" : "";
      toast({
        title: "SmartLink Amazon créé",
        description: data.duplicate 
          ? `SmartLink existant récupéré${metaInfo}`
          : `Nouveau SmartLink créé avec succès${metaInfo}`,
      });
      setAmazonInput("");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le SmartLink Amazon",
        variant: "destructive",
      });
    },
  });

  const handleCreateAmazonSmartLink = () => {
    if (!amazonInput.trim()) return;
    createAmazonSmartLinkMutation.mutate({
      input: amazonInput,
      locale: amazonLocale,
    });
  };

  const handleCreateSmartLink = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const linkData = {
      name: formData.get("name") as string,
      originalUrl: formData.get("originalUrl") as string,
      shortCode: formData.get("shortCode") as string,
      affiliateUrl: formData.get("affiliateUrl") as string || undefined,
      commissionRate: parseFloat(formData.get("commissionRate") as string) || 0,
      description: formData.get("description") as string,
      userId: "default", // À remplacer par l'ID utilisateur connecté
      status: "active" as const,
    };

    createSmartLinkMutation.mutate(linkData);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      paused: "secondary",
      expired: "destructive",
      disabled: "outline",
      detected: "secondary",
      analyzing: "outline",
      completed: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Cash Machine
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monétisation autonome avec SmartLinks et IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runDetectionMutation.mutate()}
            disabled={runDetectionMutation.isPending}
            variant="outline"
            size="sm"
            data-testid="button-run-ai-detection"
          >
            <Bot className="w-4 h-4 mr-2" />
            {runDetectionMutation.isPending ? "Détection..." : "Détection IA"}
          </Button>
          <Button
            onClick={() => growthHackerMutation.mutate()}
            disabled={growthHackerMutation.isPending}
            variant="outline"
            size="sm"
            data-testid="button-growth-hacker-v3"
          >
            <Brain className="w-4 h-4 mr-2" />
            {growthHackerMutation.isPending ? "Growth Hacker..." : "Growth Hacker V3"}
          </Button>
          <Button
            onClick={() => setIsCreatingLink(true)}
            size="sm"
            data-testid="button-create-smartlink"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau SmartLink
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              {metricsLoading ? "..." : formatCurrency(metrics?.totalMonetizationRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Externe + Commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SmartLinks Actifs</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-links">
              {metricsLoading ? "..." : `${metrics?.activeSmartLinks || 0}/${metrics?.totalSmartLinks || 0}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Liens monétisés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-conversion-rate">
              {metricsLoading ? "..." : `${(metrics?.conversionRate || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalConversions || 0} sur {metrics?.totalClicks || 0} clics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunités IA</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ai-opportunities">
              {metricsLoading ? "..." : `${metrics?.activeOpportunities || 0}/${metrics?.totalOpportunities || 0}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Détectées par IA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="smartlinks">SmartLinks</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunités</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent SmartLinks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Link2 className="w-5 h-5 mr-2" />
                  SmartLinks Récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {smartLinks.slice(0, 5).map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{link.name}</p>
                        <p className="text-sm text-gray-500">/{link.shortCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(link.status)}
                        <Button size="sm" variant="ghost" data-testid={`button-view-link-${link.id}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  Opportunités IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {opportunities.slice(0, 5).map((opportunity) => (
                    <div key={opportunity.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{opportunity.title}</p>
                        <p className="text-sm text-gray-500">{opportunity.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{opportunity.confidence}%</Badge>
                        {getStatusBadge(opportunity.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="smartlinks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des SmartLinks</CardTitle>
              <CardDescription>
                Créez et gérez vos liens monétisés avec tracking automatique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Short Code</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smartLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.name}</TableCell>
                      <TableCell>
                        <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          /{link.shortCode}
                        </code>
                      </TableCell>
                      <TableCell>{link.commissionRate}%</TableCell>
                      <TableCell>{getStatusBadge(link.status)}</TableCell>
                      <TableCell>{new Date(link.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" data-testid={`button-edit-link-${link.id}`}>
                          Modifier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* <AI:BEGIN ui-monetization-inject-amazon> */}
          <Card>
            <CardHeader>
              <CardTitle>Amazon Affiliate Connector</CardTitle>
              <CardDescription>
                Créez des SmartLinks affiliés Amazon automatiquement à partir d'ASIN ou d'URLs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amazon-input">ASIN ou URL Amazon</Label>
                    <Input 
                      id="amazon-input" 
                      value={amazonInput}
                      onChange={(e) => setAmazonInput(e.target.value)}
                      placeholder="B0CXXXXXXX ou https://www.amazon.fr/dp/B0CXXXXXXX"
                      data-testid="input-amazon-asin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amazon-locale">Locale (optionnel)</Label>
                    <Select value={amazonLocale} onValueChange={setAmazonLocale}>
                      <SelectTrigger data-testid="select-amazon-locale">
                        <SelectValue placeholder="fr_FR" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr_FR">France (fr_FR)</SelectItem>
                        <SelectItem value="en_US">États-Unis (en_US)</SelectItem>
                        <SelectItem value="de_DE">Allemagne (de_DE)</SelectItem>
                        <SelectItem value="es_ES">Espagne (es_ES)</SelectItem>
                        <SelectItem value="it_IT">Italie (it_IT)</SelectItem>
                        <SelectItem value="en_GB">Royaume-Uni (en_GB)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateAmazonSmartLink}
                  disabled={!amazonInput.trim() || createAmazonSmartLinkMutation.isPending}
                  data-testid="button-create-amazon-smartlink"
                >
                  {createAmazonSmartLinkMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {createAmazonSmartLinkMutation.isPending ? "Création..." : "Créer SmartLink Amazon"}
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* <AI:END ui-monetization-inject-amazon> */}
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Opportunités Détectées par l'IA</CardTitle>
              <CardDescription>
                Opportunités de monétisation identifiées automatiquement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Confiance</TableHead>
                    <TableHead>Revenus Pot.</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opportunity) => (
                    <TableRow key={opportunity.id}>
                      <TableCell className="font-medium">{opportunity.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{opportunity.category}</Badge>
                      </TableCell>
                      <TableCell>{opportunity.confidence}%</TableCell>
                      <TableCell>
                        {opportunity.potentialRevenue ? formatCurrency(parseFloat(opportunity.potentialRevenue)) : "N/A"}
                      </TableCell>
                      <TableCell>{getStatusBadge(opportunity.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => launchCampaignMutation.mutate(opportunity.id)}
                            disabled={launchCampaignMutation.isPending || opportunity.status === "active"}
                            data-testid={`button-launch-campaign-${opportunity.id}`}
                          >
                            {launchCampaignMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3 mr-1" />
                            )}
                            {opportunity.status === "active" ? "Campagne Active" : "Lancer Campagne"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Growth Machine Analytics Dashboard */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI Moyen</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {winnersReport?.summary?.avg_roi ? `${(winnersReport.summary.avg_roi * 100).toFixed(1)}%` : "Loading..."}
                </div>
                <p className="text-xs text-muted-foreground">
                  {winnersReport?.summary?.profitability_rate ? `${(winnersReport.summary.profitability_rate * 100).toFixed(0)}% campagnes rentables` : ""}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus Totaux</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${winnersReport?.summary?.total_revenue ? winnersReport.summary.total_revenue.toFixed(0) : "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Profit net: ${winnersReport?.summary?.net_profit ? winnersReport.summary.net_profit.toFixed(0) : "0"}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Campagnes Actives</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {winnersReport?.summary?.total_campaigns || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {winnersReport?.summary?.profitable_campaigns || 0} rentables
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Canaux Connectés</CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {channelsStatus?.connected_channels || 0}/{channelsStatus?.total_channels || 5}
                </div>
                <p className="text-xs text-muted-foreground">
                  Multi-canal automatisé
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Top Performers A/B Testing
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => autoOptimizeMutation.mutate()}
                    disabled={autoOptimizeMutation.isPending}
                    variant="outline"
                    size="sm"
                    data-testid="button-auto-optimize"
                  >
                    {autoOptimizeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Auto-Optimiser
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Performances des campagnes avec recommandations automatiques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campagne</TableHead>
                    <TableHead>ROI</TableHead>
                    <TableHead>Revenus</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>CVR</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {winnersReport?.top_performers?.map((campaign: any, index: number) => (
                    <TableRow key={campaign.campaign_id}>
                      <TableCell className="font-medium">
                        {campaign.opportunity_title}
                        <div className="text-xs text-gray-500">ID: {campaign.campaign_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaign.roi > 1.5 ? "default" : campaign.roi > 1.0 ? "secondary" : "destructive"}>
                          {(campaign.roi * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>${campaign.revenue.toFixed(0)}</TableCell>
                      <TableCell>{(campaign.ctr * 100).toFixed(2)}%</TableCell>
                      <TableCell>{(campaign.cvr * 100).toFixed(2)}%</TableCell>
                      <TableCell>
                        <Badge variant={
                          campaign.status_action === "scale" ? "default" :
                          campaign.status_action === "optimize" ? "secondary" :
                          campaign.status_action === "pause" ? "destructive" : "outline"
                        }>
                          {campaign.status_action === "scale" ? "🚀 Scaler" :
                           campaign.status_action === "optimize" ? "🔧 Optimiser" :
                           campaign.status_action === "pause" ? "⏸️ Pause" : "▶️ Continuer"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!winnersReport?.top_performers || winnersReport.top_performers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <AlertCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">Aucune campagne active</p>
                        <p className="text-sm text-gray-400">Lancez des campagnes depuis les opportunités</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Channel Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Wifi className="w-5 h-5 mr-2" />
                  Status Connecteurs Multi-Canal
                </span>
                <Button
                  onClick={() => testChannelsMutation.mutate()}
                  disabled={testChannelsMutation.isPending}
                  variant="outline"
                  size="sm"
                  data-testid="button-test-channels"
                >
                  {testChannelsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Tester Canaux
                </Button>
              </CardTitle>
              <CardDescription>
                Status des canaux de diffusion automatique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {channelsStatus?.channel_info && Object.entries(channelsStatus.channel_info).map(([channel, info]: [string, any]) => (
                  <div key={channel} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {info.status === "connected" ? (
                        <Wifi className="w-5 h-5 text-green-500" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{channel}</p>
                        <p className="text-sm text-gray-500">{info.rate_limit}/h max</p>
                      </div>
                    </div>
                    <Badge variant={
                      info.status === "connected" ? "default" :
                      info.enabled ? "secondary" : "outline"
                    }>
                      {info.status === "connected" ? "Connecté" :
                       info.enabled ? "Configuré" : "Désactivé"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Optimization Insights */}
          {winnersReport?.optimization_insights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  Insights IA & Recommandations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {winnersReport.optimization_insights.map((insight: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <Target className="w-4 h-4 mt-0.5 text-blue-500" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create SmartLink Modal */}
      {isCreatingLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Créer un SmartLink</CardTitle>
              <CardDescription>
                Nouveau lien monétisé avec tracking automatique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSmartLink} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Mon SmartLink"
                    required
                    data-testid="input-smartlink-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="originalUrl">URL Originale</Label>
                  <Input
                    id="originalUrl"
                    name="originalUrl"
                    type="url"
                    placeholder="https://example.com"
                    required
                    data-testid="input-original-url"
                  />
                </div>
                
                <div>
                  <Label htmlFor="shortCode">Code Court</Label>
                  <Input
                    id="shortCode"
                    name="shortCode"
                    placeholder="mon-lien"
                    required
                    data-testid="input-short-code"
                  />
                </div>
                
                <div>
                  <Label htmlFor="affiliateUrl">URL Affiliée (optionnel)</Label>
                  <Input
                    id="affiliateUrl"
                    name="affiliateUrl"
                    type="url"
                    placeholder="https://affiliate.example.com"
                    data-testid="input-affiliate-url"
                  />
                </div>
                
                <div>
                  <Label htmlFor="commissionRate">Taux Commission (%)</Label>
                  <Input
                    id="commissionRate"
                    name="commissionRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="5.00"
                    data-testid="input-commission-rate"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Description du SmartLink..."
                    data-testid="textarea-description"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createSmartLinkMutation.isPending}
                    data-testid="button-submit-smartlink"
                  >
                    {createSmartLinkMutation.isPending ? "Création..." : "Créer"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreatingLink(false)}
                    data-testid="button-cancel-smartlink"
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}