import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Plus, Globe, Play, AlertTriangle, Database, Search, RefreshCw, ExternalLink, 
  Code2, Terminal, HelpCircle, Settings, Trash2, Wrench, Bot, Activity, 
  CheckCircle, Download, Upload, Eye, Clock 
} from "lucide-react";
import { useScrapers, useScraperStatus, useRunScraper } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Types
interface ScraperSpec {
  name: string;
  url: string;
  target_type: string;
  selectors: Record<string, string>;
  headers?: Record<string, string>;
  frequency_minutes: number;
  timeout_seconds: number;
  max_retries: number;
  created_at: string;
}

interface ScraperStatus {
  spec: ScraperSpec;
  file_exists: boolean;
  file_size: number;
  last_modified: string | null;
}

interface ScraperResult {
  scraper_name: string;
  status: "success" | "error" | "partial";
  data_count: number;
  execution_time: number;
  error_message?: string;
  data?: any[];
  timestamp: string;
}

// Schema de validation
const scraperFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscore allowed"),
  url: z.string().url("Must be a valid URL"),
  target_type: z.enum(["product", "article", "job", "social", "generic"]),
  selectors: z.object({
    container: z.string().optional(),
    title: z.string().min(1, "Title selector is required"),
    content: z.string().optional(),
    price: z.string().optional(),
    image: z.string().optional(),
    link: z.string().optional(),
  }),
  frequency_minutes: z.number().min(1).max(10080),
  timeout_seconds: z.number().min(5).max(300),
  max_retries: z.number().min(0).max(10),
});

export default function Scrapers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // États pour le manager
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Form pour création de scraper
  const scraperForm = useForm<z.infer<typeof scraperFormSchema>>({
    resolver: zodResolver(scraperFormSchema),
    defaultValues: {
      name: "",
      url: "",
      target_type: "generic",
      selectors: {
        title: "h1, h2, h3",
        content: "p, .content",
        price: "",
        image: "",
        link: "",
        container: "",
      },
      frequency_minutes: 60,
      timeout_seconds: 30,
      max_retries: 3,
    },
  });
  
  const { data: scrapers, isLoading: scrapersLoading } = useScrapers();
  const { data: status, isLoading: statusLoading } = useScraperStatus();
  const runScraper = useRunScraper();

  // Queries pour scrapers externes
  const { data: externalScrapers, isLoading: externalLoading } = useQuery({
    queryKey: ["/api/external-scrapers"],
    retry: false,
  });

  const { data: dependencies } = useQuery({
    queryKey: ["/api/external-scrapers/dependencies/check"],
    retry: false,
  });

  // Queries pour scrapers autonomes
  const scraperStatuses = useQuery({
    queryKey: ["/api/scraper-manager/scrapers"],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const scraperResults = useQuery({
    queryKey: ["/api/scraper-manager/results"],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Mutations
  const runExternalScraper = useMutation({
    mutationFn: async ({ name, args }: { name: string; args: string[] }) => {
      const response = await fetch(`/api/external-scrapers/run/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to run scraper");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-scrapers"] });
    },
  });

  const installDependencies = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/external-scrapers/dependencies/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to install dependencies");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-scrapers/dependencies/check"] });
    },
  });

  const createScraperMutation = useMutation({
    mutationFn: async (data: z.infer<typeof scraperFormSchema>) => {
      const response = await fetch("/api/scraper-manager/scrapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create scraper");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scraper créé",
        description: "Le scraper autonome a été créé avec succès.",
      });
      setIsCreateDialogOpen(false);
      scraperForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/scraper-manager/scrapers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runAutonomousScraper = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/scraper-manager/scrapers/${name}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to run scraper");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scraper exécuté",
        description: "Le scraper a été lancé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scraper-manager/results"] });
    },
  });

  // Calcul des métriques
  const autonomousScrapers = Array.isArray(scraperStatuses.data) ? scraperStatuses.data : Object.values(scraperStatuses.data || {});
  const totalScrapers = (scrapers?.length || 0) + Object.keys(externalScrapers || {}).length + autonomousScrapers.length;
  const activeScrapers = scrapers?.filter((s: any) => s.lastRun && new Date(s.lastRun) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length || 0;
  const successRate = scrapers?.length ? 
    ((scrapers.filter((s: any) => s.status === 'success').length / scrapers.length) * 100).toFixed(1) : "0";
  
  const filteredScrapers = scrapers?.filter((scraper: any) =>
    scraper.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scraper.url.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleCreateScraper = async (data: z.infer<typeof scraperFormSchema>) => {
    createScraperMutation.mutate(data);
  };

  // Colonnes pour les tables
  const scraperColumns = [
    {
      key: "name",
      header: "Nom",
      render: (value: string) => (
        <div className="font-medium">{value}</div>
      ),
    },
    {
      key: "url",
      header: "URL",
      render: (value: string) => (
        <div className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
          {value}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value || "unknown"} />,
    },
    {
      key: "lastRun",
      header: "Dernière Exécution",
      render: (value: string) => 
        value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "Jamais",
    },
  ];

  const autonomousColumns = [
    {
      key: "name",
      header: "Nom",
      render: (_: any, row: ScraperStatus) => (
        <div className="font-medium">{row.spec.name}</div>
      ),
    },
    {
      key: "target_type",
      header: "Type",
      render: (_: any, row: ScraperStatus) => (
        <Badge variant="secondary">{row.spec.target_type}</Badge>
      ),
    },
    {
      key: "url",
      header: "URL",
      render: (_: any, row: ScraperStatus) => (
        <div className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
          {row.spec.url}
        </div>
      ),
    },
    {
      key: "status",
      header: "Statut",
      render: (_: any, row: ScraperStatus) => (
        <StatusBadge status={row.file_exists ? "ready" : "error"} />
      ),
    },
  ];

  const scraperActions = [
    {
      label: "Exécuter",
      onClick: (row: any) => runScraper.mutate(row.id),
      variant: "default" as const,
    },
  ];

  const autonomousActions = [
    {
      label: "Exécuter",
      onClick: (row: ScraperStatus) => runAutonomousScraper.mutate(row.spec.name),
      variant: "default" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scrapers</h1>
          <p className="text-muted-foreground">
            Gestion complète de vos scrapers : internes, externes, et autonomes
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Créer Scraper
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un Nouveau Scraper Autonome</DialogTitle>
              </DialogHeader>
              <Form {...scraperForm}>
                <form onSubmit={scraperForm.handleSubmit(handleCreateScraper)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={scraperForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom du Scraper</FormLabel>
                          <FormControl>
                            <Input placeholder="mon_scraper" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={scraperForm.control}
                      name="target_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type de Cible</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner le type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="generic">Générique</SelectItem>
                              <SelectItem value="product">Produit</SelectItem>
                              <SelectItem value="article">Article</SelectItem>
                              <SelectItem value="job">Offre d'emploi</SelectItem>
                              <SelectItem value="social">Réseaux sociaux</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={scraperForm.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Cible</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/page" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Sélecteurs CSS</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={scraperForm.control}
                        name="selectors.title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Titre (h1, h2)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scraperForm.control}
                        name="selectors.content"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Contenu (p, .content)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={scraperForm.control}
                      name="frequency_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fréquence (min)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={scraperForm.control}
                      name="timeout_seconds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timeout (sec)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={scraperForm.control}
                      name="max_retries"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Retries</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createScraperMutation.isPending}>
                      {createScraperMutation.isPending ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="internal">Scrapers Internes</TabsTrigger>
          <TabsTrigger value="autonomous">Scrapers Autonomes</TabsTrigger>
          <TabsTrigger value="external">Outils Externes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Total Scrapers"
              value={totalScrapers.toString()}
              change={{
                value: "+3 nouveaux",
                type: "increase",
                period: "ce mois",
              }}
              icon={Bot}
              iconColor="text-blue-600 dark:text-blue-400"
            />
            
            <MetricCard
              title="Scrapers Actifs"
              value={activeScrapers.toString()}
              change={{
                value: "24h",
                type: "neutral",
                period: "dernières",
              }}
              icon={Activity}
              iconColor="text-green-600 dark:text-green-400"
            />
            
            <MetricCard
              title="Taux de Succès"
              value={`${successRate}%`}
              change={{
                value: "+5.2%",
                type: "increase",
                period: "ce mois",
              }}
              icon={CheckCircle}
              iconColor="text-purple-600 dark:text-purple-400"
            />

            <MetricCard
              title="Erreurs"
              value={scrapers?.filter((s: any) => s.status === 'error').length?.toString() || "0"}
              change={{
                value: "-2 cette semaine",
                type: "decrease",
                period: "en baisse",
              }}
              icon={AlertTriangle}
              iconColor="text-red-600 dark:text-red-400"
            />
          </div>
        </TabsContent>

        <TabsContent value="internal" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>Scrapers Internes</CardTitle>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher des scrapers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={filteredScrapers}
                columns={scraperColumns}
                actions={scraperActions}
                loading={scrapersLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="autonomous" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                Scrapers Autonomes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={autonomousScrapers}
                columns={autonomousColumns}
                actions={autonomousActions}
                loading={scraperStatuses.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external" className="space-y-6">
          {/* Statut des dépendances Python */}
          {dependencies && typeof dependencies === 'object' && Object.keys(dependencies).length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="w-5 h-5" />
                  Dépendances Python
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => installDependencies.mutate()}
                  disabled={installDependencies.isPending}
                >
                  {installDependencies.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Installer les manquantes
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(dependencies as Record<string, any>).map(([key, status]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-medium">{key}</span>
                        {status.path && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">
                            {status.path}
                          </span>
                        )}
                      </div>
                      <Badge variant={status.available ? "success" : "destructive"}>
                        {status.available ? "Disponible" : "Manquant"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Console Interactive */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Terminal className="w-4 h-4 mr-2" />
                Console Interactive Scraper
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Utilisez la console interactive Python pour installer et exécuter des scrapers avec des arguments personnalisés.
              </p>
              <Button 
                onClick={() => runExternalScraper.mutate({ name: "interactive", args: [] })}
                className="w-full"
                disabled={runExternalScraper.isPending}
              >
                {runExternalScraper.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Terminal className="w-4 h-4 mr-2" />
                )}
                Ouvrir la Console Interactive
              </Button>
            </CardContent>
          </Card>

          {/* Outils Externes Python */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Outils Externes Python</CardTitle>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
            </CardHeader>
            <CardContent>
              {externalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Chargement des outils externes...</span>
                </div>
              ) : externalScrapers && Object.keys(externalScrapers).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(externalScrapers).map(([name, description]) => (
                    <Card key={name} className="border-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                              <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-semibold capitalize">{name}</h3>
                          </div>
                          <Badge variant="outline">{name}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            {description as string}
                          </p>
                          {name === 'jobfunnel' && (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">Indeed</Badge>
                              <Badge variant="secondary" className="text-xs">Monster</Badge>
                              <Badge variant="secondary" className="text-xs">Glassdoor</Badge>
                            </div>
                          )}
                          {name === 'paper' && (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">arXiv</Badge>
                              <Badge variant="secondary" className="text-xs">PubMed</Badge>
                              <Badge variant="secondary" className="text-xs">Scholar</Badge>
                            </div>
                          )}
                          {name === 'scrapfly' && (
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary" className="text-xs">Amazon</Badge>
                              <Badge variant="secondary" className="text-xs">Instagram</Badge>
                              <Badge variant="secondary" className="text-xs">LinkedIn</Badge>
                              <Badge variant="secondary" className="text-xs">+36 more</Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => runExternalScraper.mutate({ name, args: [] })}
                            disabled={runExternalScraper.isPending}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Exécuter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun outil externe disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}