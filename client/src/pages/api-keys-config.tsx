import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Key, TestTube, Trash2, Check, X, Loader2 } from "lucide-react";
import { insertApiKeySchema, type ApiKey } from "@shared/schema";

interface ApiKeyForm {
  channelType: string;
  keyName: string;
  keyValue: string;
  description: string;
}

export default function ApiKeysConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<ApiKeyForm>({
    channelType: "",
    keyName: "",
    keyValue: "",
    description: "",
  });

  // Récupérer toutes les clés API
  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  // Mutation pour créer une clé API
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyForm) => {
      const validatedData = insertApiKeySchema.parse(data);
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData),
      });
      if (!response.ok) throw new Error("Failed to create API key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setShowAddForm(false);
      setFormData({ channelType: "", keyName: "", keyValue: "", description: "" });
      toast({
        title: "Succès",
        description: "Clé API ajoutée avec succès",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'ajout de la clé API",
        variant: "destructive",
      });
    },
  });

  // Mutation pour tester une clé API
  const testApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}/test`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to test API key");
      return response.json() as { success: boolean; message: string };
    },
    onSuccess: (data, keyId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: data.success ? "Test réussi" : "Test échoué",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  // Mutation pour supprimer une clé API
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete API key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Succès",
        description: "Clé API supprimée avec succès",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createApiKeyMutation.mutate(formData);
  };

  const channelOptions = [
    { value: "twitter", label: "Twitter/X", icon: "🐦" },
    { value: "discord", label: "Discord", icon: "💬" },
    { value: "telegram", label: "Telegram", icon: "✈️" },
    { value: "email", label: "Email Marketing", icon: "📧" },
    { value: "medium", label: "Medium", icon: "📝" },
  ];

  const getStatusBadge = (testStatus: string) => {
    switch (testStatus) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><Check className="w-3 h-3 mr-1" />Actif</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"><X className="w-3 h-3 mr-1" />Échec</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">En attente</Badge>;
    }
  };

  const groupedKeys = apiKeys.reduce((acc: { [key: string]: ApiKey[] }, key: ApiKey) => {
    if (!acc[key.channelType]) {
      acc[key.channelType] = [];
    }
    acc[key.channelType].push(key);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Configuration des Clés API
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gérez vos clés API pour activer les connecteurs multi-canal
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-add-api-key"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une clé API
          </Button>
        </div>

        {/* Formulaire d'ajout */}
        {showAddForm && (
          <Card data-testid="form-add-api-key">
            <CardHeader>
              <CardTitle>Ajouter une nouvelle clé API</CardTitle>
              <CardDescription>
                Configurez une nouvelle clé API pour activer un connecteur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="channelType">Canal</Label>
                    <Select
                      value={formData.channelType}
                      onValueChange={(value) => setFormData({ ...formData, channelType: value })}
                      required
                    >
                      <SelectTrigger data-testid="select-channel-type">
                        <SelectValue placeholder="Sélectionner un canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {channelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.icon} {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyName">Nom de la clé</Label>
                    <Input
                      id="keyName"
                      value={formData.keyName}
                      onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
                      placeholder="ex: API_KEY, BOT_TOKEN..."
                      required
                      data-testid="input-key-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyValue">Valeur de la clé</Label>
                  <Input
                    id="keyValue"
                    type="password"
                    value={formData.keyValue}
                    onChange={(e) => setFormData({ ...formData, keyValue: e.target.value })}
                    placeholder="Entrez votre clé API..."
                    required
                    data-testid="input-key-value"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optionnel)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description de cette clé API..."
                    data-testid="input-description"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createApiKeyMutation.isPending}
                    data-testid="button-submit-api-key"
                  >
                    {createApiKeyMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ajout...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Ajouter la clé
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liste des clés API par canal */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6">
            {channelOptions.map((channel) => {
              const channelKeys = groupedKeys[channel.value] || [];
              return (
                <Card key={channel.value} data-testid={`channel-${channel.value}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{channel.icon}</span>
                      {channel.label}
                      <Badge variant="outline" className="ml-auto">
                        {channelKeys.length} clé{channelKeys.length > 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {channelKeys.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Aucune clé API configurée pour ce canal</p>
                        <p className="text-sm">Ajoutez une clé pour activer ce connecteur</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {channelKeys.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800"
                            data-testid={`api-key-${key.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-medium">{key.keyName}</h4>
                                {getStatusBadge(key.testStatus || "pending")}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {key.description || "Aucune description"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                Valeur: {key.keyValue} • Modifié: {new Date(key.updatedAt || key.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testApiKeyMutation.mutate(key.id)}
                                disabled={testApiKeyMutation.isPending}
                                data-testid={`button-test-${key.id}`}
                              >
                                {testApiKeyMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <TestTube className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteApiKeyMutation.mutate(key.id)}
                                disabled={deleteApiKeyMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-${key.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}