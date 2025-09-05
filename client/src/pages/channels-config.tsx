import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Settings, 
  TestTube, 
  Wifi, 
  WifiOff,
  Save,
  RefreshCw,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "configured" | "disconnected" | "error";
  required_keys: string[];
  rate_limit: string;
  test_available: boolean;
  enabled: boolean;
}

interface ChannelCredentials {
  [key: string]: string;
}

export default function ChannelsConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ChannelCredentials>({});
  const [showCredentials, setShowCredentials] = useState<{[key: string]: boolean}>({});

  // Fetch channels configuration
  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels/config"],
    refetchInterval: 30000,
  });

  // Configure channel mutation
  const configureChannelMutation = useMutation({
    mutationFn: async ({ channelId, credentials }: { channelId: string; credentials: ChannelCredentials }) => {
      const response = await fetch(`/api/channels/configure/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });
      if (!response.ok) throw new Error("Failed to configure channel");
      return response.json();
    },
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/config"] });
      toast({
        title: "Configuration Sauvegardée",
        description: `Canal ${channelId} configuré avec succès`,
      });
      setCredentials({});
    },
    onError: () => {
      toast({
        title: "Erreur de Configuration",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    },
  });

  // Test channel connection mutation
  const testChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const response = await fetch(`/api/channels/test/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to test channel");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Test Réussi" : "Test Échoué",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Erreur de Test",
        description: "Impossible de tester la connexion",
        variant: "destructive",
      });
    },
  });

  // Toggle channel mutation
  const toggleChannelMutation = useMutation({
    mutationFn: async ({ channelId, enabled }: { channelId: string; enabled: boolean }) => {
      const response = await fetch(`/api/channels/toggle/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("Failed to toggle channel");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels/config"] });
      toast({
        title: "Canal Modifié",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le canal",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "configured": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "disconnected": return <WifiOff className="w-5 h-5 text-gray-400" />;
      case "error": return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      configured: "default",
      disconnected: "secondary", 
      error: "destructive"
    } as const;

    const labels = {
      configured: "Connecté",
      disconnected: "Déconnecté",
      error: "Erreur"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveCredentials = (channelId: string) => {
    configureChannelMutation.mutate({ channelId, credentials });
  };

  const toggleCredentialVisibility = (key: string) => {
    setShowCredentials(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration des Connecteurs</h1>
          <p className="text-muted-foreground">
            Gérez les connecteurs multi-canaux pour la diffusion automatique
          </p>
        </div>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/channels/config"] })}
          variant="outline"
          data-testid="button-refresh-channels"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="configure" data-testid="tab-configure">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {channels?.map((channel) => (
              <Card key={channel.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{channel.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{channel.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {channel.description}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusIcon(channel.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    {getStatusBadge(channel.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rate Limit</span>
                    <span className="text-sm text-muted-foreground">{channel.rate_limit}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Activé</span>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(enabled) => 
                        toggleChannelMutation.mutate({ channelId: channel.id, enabled })
                      }
                      disabled={toggleChannelMutation.isPending}
                      data-testid={`toggle-${channel.id}`}
                    />
                  </div>

                  <div className="flex space-x-2 pt-2">
                    {channel.test_available && (
                      <Button
                        onClick={() => testChannelMutation.mutate(channel.id)}
                        disabled={testChannelMutation.isPending}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        data-testid={`test-${channel.id}`}
                      >
                        {testChannelMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                        Test
                      </Button>
                    )}
                    <Button
                      onClick={() => setSelectedChannel(channel.id)}
                      size="sm"
                      className="flex-1"
                      data-testid={`configure-${channel.id}`}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configurer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="configure" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channel Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Sélectionner un Canal</CardTitle>
                <CardDescription>
                  Choisissez le canal à configurer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {channels?.map((channel) => (
                  <div
                    key={channel.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedChannel === channel.id 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedChannel(channel.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{channel.icon}</span>
                      <div>
                        <p className="font-medium">{channel.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {channel.required_keys.length} clés requises
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(channel.status)}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Configuration Form */}
            {selectedChannel && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lock className="w-5 h-5 mr-2" />
                    Configuration {channels?.find(c => c.id === selectedChannel)?.name}
                  </CardTitle>
                  <CardDescription>
                    Entrez les clés API nécessaires pour ce canal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {channels?.find(c => c.id === selectedChannel)?.required_keys.map((key) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{key}</Label>
                      <div className="relative">
                        <Input
                          id={key}
                          type={showCredentials[key] ? "text" : "password"}
                          placeholder={`Entrez votre ${key}`}
                          value={credentials[key] || ""}
                          onChange={(e) => handleCredentialChange(key, e.target.value)}
                          className="pr-10"
                          data-testid={`input-${selectedChannel}-${key}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleCredentialVisibility(key)}
                        >
                          {showCredentials[key] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="flex space-x-2 pt-4">
                    <Button
                      onClick={() => handleSaveCredentials(selectedChannel)}
                      disabled={configureChannelMutation.isPending}
                      className="flex-1"
                      data-testid={`save-${selectedChannel}`}
                    >
                      {configureChannelMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Sauvegarder
                    </Button>
                    <Button
                      onClick={() => testChannelMutation.mutate(selectedChannel)}
                      disabled={testChannelMutation.isPending}
                      variant="outline"
                      data-testid={`test-config-${selectedChannel}`}
                    >
                      {testChannelMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      Tester
                    </Button>
                  </div>

                  {/* Security Notice */}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <Lock className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-700 dark:text-blue-300">
                          Sécurité
                        </p>
                        <p className="text-blue-600 dark:text-blue-400">
                          Les clés API sont chiffrées et stockées de manière sécurisée. 
                          Elles ne sont jamais exposées dans les logs.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}