import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Zap, Clock, DollarSign, Key, Settings, CheckCircle, XCircle } from "lucide-react";
import { useAiModels, useAiStatus } from "@/hooks/use-api";
import { format } from "date-fns";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AiMonitoring() {
  const { data: models, isLoading: modelsLoading } = useAiModels();
  const { data: status, isLoading: statusLoading } = useAiStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for API key and model configuration
  const [openApiKeyDialog, setOpenApiKeyDialog] = useState(false);
  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  
  // Available GPT models
  const gptModels = [
    { value: "gpt-4o", label: "GPT-4o", description: "Latest multimodal model" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Fast and efficient" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Advanced reasoning" },
    { value: "gpt-4", label: "GPT-4", description: "High performance" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Cost effective" }
  ];

  // Check if API key exists
  const { data: apiKeyStatus } = useQuery({
    queryKey: ["/api/ai/api-key/status"],
    retry: false,
  }) as { data: any };

  // Save API key mutation
  const saveApiKeyMutation = useMutation({
    mutationFn: async (data: { apiKey: string; model?: string }) => {
      const response = await fetch("/api/ai/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          apiKey: data.apiKey, 
          model: data.model || selectedModel 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save API key");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "API key saved successfully",
      });
      setOpenApiKeyDialog(false);
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai/api-key/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
    },
  });

  // Configure model mutation
  const configureModelMutation = useMutation({
    mutationFn: async (data: { model: string }) => {
      const response = await fetch("/api/ai/model/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to configure model");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Model configured successfully",
      });
      setOpenModelDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure model",
        variant: "destructive",
      });
    },
  });

  // Test API connection
  const testApiMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to test connection");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Connection Test",
        description: data.message || "API connection successful",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to API",
        variant: "destructive",
      });
    },
  });

  const modelColumns = [
    {
      key: "name",
      header: "Model",
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            row.status === 'active' ? 'bg-green-500' : 
            row.status === 'training' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-sm text-gray-500">{row.version}</div>
          </div>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'openai' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' :
          value === 'anthropic' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200' :
          'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "accuracy",
      header: "Accuracy",
      render: (value: string) => `${value}%`,
    },
    {
      key: "lastTrained",
      header: "Last Trained",
      render: (value: string) => value ? format(new Date(value), "MMM dd, yyyy") : "Never",
    },
  ];

  const modelActions = [
    {
      label: "Edit",
      onClick: (row: any) => console.log("Edit model", row.id),
    },
    {
      label: "Train",
      onClick: (row: any) => console.log("Train model", row.id),
    },
    {
      label: "Delete",
      onClick: (row: any) => console.log("Delete model", row.id),
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor AI models and inference performance
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={openApiKeyDialog} onOpenChange={setOpenApiKeyDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="configure-api-key">
                <Key className="w-4 h-4 mr-2" />
                API Key
                {apiKeyStatus?.hasKey ? (
                  <CheckCircle className="w-4 h-4 ml-2 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 ml-2 text-red-500" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure OpenAI API Key</DialogTitle>
                <DialogDescription>
                  Enter your OpenAI API key to enable AI monitoring features
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="api-key">OpenAI API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Your OpenAI API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    data-testid="input-api-key"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Your API key will be securely stored and encrypted
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setOpenApiKeyDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => saveApiKeyMutation.mutate({ apiKey })}
                    disabled={!apiKey || saveApiKeyMutation.isPending}
                    data-testid="save-api-key"
                  >
                    {saveApiKeyMutation.isPending ? "Saving..." : "Save Key"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={openModelDialog} onOpenChange={setOpenModelDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="configure-model">
                <Settings className="w-4 h-4 mr-2" />
                Configure Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure GPT Model</DialogTitle>
                <DialogDescription>
                  Select the GPT model you want to use for AI operations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="model-select">Select GPT Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger data-testid="select-gpt-model">
                      <SelectValue placeholder="Choose a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {gptModels.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-sm text-gray-500">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setOpenModelDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => configureModelMutation.mutate({ model: selectedModel })}
                    disabled={configureModelMutation.isPending}
                    data-testid="save-model-config"
                  >
                    {configureModelMutation.isPending ? "Configuring..." : "Configure"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={() => testApiMutation.mutate()}
            disabled={testApiMutation.isPending || !apiKeyStatus?.hasKey}
            data-testid="test-api-connection"
          >
            {testApiMutation.isPending ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </div>

      {/* API Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${apiKeyStatus?.hasKey ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium">API Key Status</p>
                <p className="text-sm text-gray-500">
                  {apiKeyStatus?.hasKey ? 'Configured' : 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Bot className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">Active Model</p>
                <p className="text-sm text-gray-500">
                  {apiKeyStatus?.currentModel || 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${apiKeyStatus?.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="font-medium">Connection</p>
                <p className="text-sm text-gray-500">
                  {apiKeyStatus?.connectionStatus || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Models"
          value={status?.activeModels || 0}
          change={{
            value: "All operational",
            type: "neutral",
          }}
          icon={Bot}
          iconColor="text-blue-600 dark:text-blue-400"
        />
        
        <MetricCard
          title="Total Inferences"
          value={status?.totalInferences?.toLocaleString() || 0}
          change={{
            value: "+18%",
            type: "increase",
            period: "today",
          }}
          icon={Zap}
          iconColor="text-green-600 dark:text-green-400"
        />
        
        <MetricCard
          title="Avg Response Time"
          value={`${status?.avgLatency || 0}ms`}
          change={{
            value: "-12ms",
            type: "decrease",
            period: "improvement",
          }}
          icon={Clock}
          iconColor="text-purple-600 dark:text-purple-400"
        />
        
        <MetricCard
          title="Total Cost"
          value={`$${status?.totalCost || 0}`}
          change={{
            value: "+5%",
            type: "increase",
            period: "this month",
          }}
          icon={DollarSign}
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* AI Models Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI Models</CardTitle>
          <Button size="sm" data-testid="add-model-from-table">
            <Plus className="w-4 h-4 mr-2" />
            Add Model
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            data={models || []}
            columns={modelColumns}
            actions={modelActions}
            loading={modelsLoading}
          />
        </CardContent>
      </Card>

      {/* Recent Inferences */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Recent AI Inferences</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Coming soon - inference history and performance metrics
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
