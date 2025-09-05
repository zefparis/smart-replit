import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Save, Settings as SettingsIcon, Shield, Bell, Database } from "lucide-react";
import { useSettings } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface SettingItem {
  key: string;
  value: string;
  category: string;
  description?: string;
  isPublic: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [hasChanges, setHasChanges] = useState(false);
  const { data: settings, isLoading } = useSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // In a real implementation, this would call the API
    toast({
      title: "Settings saved",
      description: "Your settings have been updated successfully.",
    });
    setHasChanges(false);
  };

  const handleBulkSave = () => {
    // In a real implementation, this would call the bulk update API
    toast({
      title: "Settings saved",
      description: "All settings have been updated successfully.",
    });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure application settings and preferences
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleBulkSave} data-testid="save-all-settings">
            <Save className="w-4 h-4 mr-2" />
            Save All Changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" data-testid="tab-general">
            <SettingsIcon className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">
            <Database className="w-4 h-4 mr-2" />
            API & Database
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="app-name">Application Name</Label>
                <Input
                  id="app-name"
                  defaultValue="SmartLinks Autopilot"
                  onChange={(e) => handleInputChange("app_name", e.target.value)}
                  data-testid="input-app-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Default Theme</Label>
                <Select defaultValue="system" onValueChange={(value) => handleInputChange("theme", value)}>
                  <SelectTrigger data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Auto (System)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="UTC" onValueChange={(value) => handleInputChange("timezone", value)}>
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Auto-refresh Interval (seconds)</Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  defaultValue="30"
                  min="10"
                  max="300"
                  onChange={(e) => handleInputChange("refresh_interval", e.target.value)}
                  data-testid="input-refresh-interval"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Show Tooltips</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Display helpful tooltips throughout the interface
                  </p>
                </div>
                <Switch defaultChecked data-testid="toggle-tooltips" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Compact Mode</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Use smaller spacing and elements
                  </p>
                </div>
                <Switch data-testid="toggle-compact-mode" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Show Animations</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enable smooth transitions and animations
                  </p>
                </div>
                <Switch defaultChecked data-testid="toggle-animations" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-url">Database URL</Label>
                <Input
                  id="db-url"
                  type="password"
                  defaultValue="postgresql://localhost:5432/smartlinks"
                  onChange={(e) => handleInputChange("db_url", e.target.value)}
                  data-testid="input-db-url"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pool-size">Pool Size</Label>
                  <Input
                    id="pool-size"
                    type="number"
                    defaultValue="20"
                    onChange={(e) => handleInputChange("pool_size", e.target.value)}
                    data-testid="input-pool-size"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="connection-timeout">Connection Timeout (s)</Label>
                  <Input
                    id="connection-timeout"
                    type="number"
                    defaultValue="30"
                    onChange={(e) => handleInputChange("connection_timeout", e.target.value)}
                    data-testid="input-connection-timeout"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-provider">Default AI Provider</Label>
                <Select defaultValue="openai" onValueChange={(value) => handleInputChange("ai_provider", value)}>
                  <SelectTrigger data-testid="select-ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  defaultValue="4096"
                  onChange={(e) => handleInputChange("max_tokens", e.target.value)}
                  data-testid="input-max-tokens"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-timeout">Request Timeout (s)</Label>
                <Input
                  id="request-timeout"
                  type="number"
                  defaultValue="60"
                  onChange={(e) => handleInputChange("request_timeout", e.target.value)}
                  data-testid="input-request-timeout"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  defaultValue="120"
                  onChange={(e) => handleInputChange("session_timeout", e.target.value)}
                  data-testid="input-session-timeout"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password-policy">Password Policy</Label>
                <Select defaultValue="standard" onValueChange={(value) => handleInputChange("password_policy", value)}>
                  <SelectTrigger data-testid="select-password-policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (8+ characters)</SelectItem>
                    <SelectItem value="strong">Strong (12+ characters, mixed case, numbers, symbols)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (16+ characters, all requirements)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Require Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Require 2FA for all admin users
                  </p>
                </div>
                <Switch data-testid="toggle-2fa" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Rate Limiting</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Limit API requests per user
                  </p>
                </div>
                <Switch defaultChecked data-testid="toggle-rate-limiting" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-limit">Requests per minute</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  defaultValue="100"
                  onChange={(e) => handleInputChange("rate_limit", e.target.value)}
                  data-testid="input-rate-limit"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">System Alerts</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive notifications for system errors and warnings
                  </p>
                </div>
                <Switch defaultChecked data-testid="toggle-system-alerts" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Invoice Reminders</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get notified about overdue invoices
                  </p>
                </div>
                <Switch defaultChecked data-testid="toggle-invoice-reminders" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Scraper Status Updates</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Notifications when scrapers fail or complete
                  </p>
                </div>
                <Switch data-testid="toggle-scraper-updates" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input
                  id="notification-email"
                  type="email"
                  placeholder="admin@smartlinks.com"
                  onChange={(e) => handleInputChange("notification_email", e.target.value)}
                  data-testid="input-notification-email"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-app.com/webhooks"
                  onChange={(e) => handleInputChange("webhook_url", e.target.value)}
                  data-testid="input-webhook-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook Secret</Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder="Enter webhook secret"
                  onChange={(e) => handleInputChange("webhook_secret", e.target.value)}
                  data-testid="input-webhook-secret"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Webhooks</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Send real-time notifications to external services
                  </p>
                </div>
                <Switch data-testid="toggle-webhooks" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
