import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  Package, 
  ShoppingCart,
  Key,
  RefreshCw
} from "lucide-react";

interface AliExpressStatus {
  configured: boolean;
  authenticated: boolean;
  appKey: string | null;
  callbackUrl: string;
  tokenInfo: {
    hasAccessToken: boolean;
    obtainedAt?: string;
    expiresIn?: number;
  } | null;
  scriptsAvailable: {
    dropship: boolean;
    oauth: boolean;
    test: boolean;
  };
}

interface ProductSearchResult {
  error?: boolean;
  message?: string;
  product_id?: string;
  title?: string;
  price?: string;
  currency?: string;
  availability?: string;
}

export default function AliExpressPage() {
  const [searchSku, setSearchSku] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const queryClient = useQueryClient();

  // Handle OAuth callback parameters from URL and auto-exchange tokens
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (auth === 'success' && code) {
      console.log('✅ OAuth callback success - Code received:', code.substring(0, 10) + '...');
      // Auto-fill the OAuth code field
      setOauthCode(code);
      
      // Automatically exchange the token
      exchangeTokenMutation.mutate(code);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (auth === 'error') {
      console.error('❌ OAuth error:', error, urlParams.get('error_description'));
      // Clear URL parameters  
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code && !auth) {
      // Direct code parameter (fallback case)
      console.log('📥 Direct OAuth code received:', code.substring(0, 10) + '...');
      setOauthCode(code);
      exchangeTokenMutation.mutate(code);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery<AliExpressStatus>({
    queryKey: ["/api/aliexpress/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: oauthUrl } = useQuery<{ oauth_url: string }>({
    queryKey: ["/api/aliexpress/oauth/url"],
    enabled: status?.configured && !status?.authenticated,
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/aliexpress/test", {
        method: "GET",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aliexpress/status"] });
    },
  });

  const exchangeTokenMutation = useMutation({
    mutationFn: async (code: string) => {
      console.log('🔄 Exchanging OAuth code for access token...');
      const response = await fetch("/api/aliexpress/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Token exchange successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/aliexpress/status"] });
      setOauthCode("");
    },
    onError: (error) => {
      console.error('❌ Token exchange failed:', error);
    },
  });

  const productSearchMutation = useMutation({
    mutationFn: async (sku: string) => {
      const response = await fetch(`/api/aliexpress/products/search?sku=${encodeURIComponent(sku)}`);
      return response.json();
    },
  });

  const handleOAuthExchange = () => {
    if (oauthCode.trim()) {
      exchangeTokenMutation.mutate(oauthCode.trim());
    }
  };

  const handleProductSearch = () => {
    if (searchSku.trim()) {
      productSearchMutation.mutate(searchSku.trim());
    }
  };

  const getStatusBadge = (status: AliExpressStatus | undefined) => {
    if (!status) return <Badge variant="outline">Loading...</Badge>;
    
    if (!status.configured) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Not Configured</Badge>;
    }
    
    if (!status.authenticated) {
      return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Needs Authentication</Badge>;
    }
    
    return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
  };

  if (statusLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Package className="h-6 w-6" />
          <h1 className="text-3xl font-bold">AliExpress Dropshipping</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading AliExpress status...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h1 className="text-3xl font-bold">AliExpress Dropshipping</h1>
        </div>
        {getStatusBadge(status)}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Configuration</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.configured ? "✓" : "✗"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {status?.configured ? "API Keys Set" : "Needs Setup"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Authentication</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.authenticated ? "✓" : "✗"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {status?.authenticated ? "OAuth Token Active" : "Needs OAuth"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scripts</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.scriptsAvailable ? 
                    Object.values(status.scriptsAvailable).filter(Boolean).length : 0}/3
                </div>
                <p className="text-xs text-muted-foreground">
                  Python Modules Ready
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Status</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {status?.configured && status?.authenticated ? "Ready" : "Pending"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dropship Operations
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">App Key</h4>
                  <p className="text-sm text-muted-foreground">
                    {status?.appKey || "Not configured"}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold">Callback URL</h4>
                  <p className="text-sm text-muted-foreground">
                    {status?.callbackUrl || "Not configured"}
                  </p>
                </div>
              </div>
              
              {status?.tokenInfo && (
                <div>
                  <h4 className="font-semibold">OAuth Token</h4>
                  <p className="text-sm text-muted-foreground">
                    {status.tokenInfo.hasAccessToken ? 
                      `Active (obtained: ${status.tokenInfo.obtainedAt})` : 
                      "No active token"}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  variant="outline"
                >
                  {testConnectionMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>

              {testConnectionMutation.data && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Test Result: {testConnectionMutation.data.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>OAuth Authentication Setup</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure OAuth authentication with AliExpress Developer Console
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {!status?.authenticated ? (
                  <div className="space-y-6">
                    {status?.configured ? (
                      <>
                        {/* Configuration Overview */}
                        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Current Configuration</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="font-medium">App Key:</span> {status.appKey}
                            </div>
                            <div>
                              <span className="font-medium">Callback URL:</span> 
                              <code className="ml-1 text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                {status.callbackUrl}
                              </code>
                            </div>
                          </div>
                        </div>

                        {/* Step-by-step guide */}
                        <div className="space-y-4">
                          <div className="border-l-4 border-blue-500 pl-4">
                            <h4 className="font-semibold">Step 1: Configure AliExpress App Console</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Go to AliExpress App Console → Auth Management and configure:
                            </p>
                            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                              <li><strong>Authorized Policy:</strong> Allow login user to authorize</li>
                              <li><strong>Authorized Page:</strong> Show Auth Page</li>
                              <li><strong>Authorized Agreement:</strong> OAuth2.0 Server-side</li>
                              <li><strong>Access Token Duration:</strong> 1 day</li>
                              <li><strong>Refresh Token Duration:</strong> 2 day</li>
                            </ul>
                            <Button asChild variant="outline" className="mt-3">
                              <a 
                                href="https://open.aliexpress.com/console/app" 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open AliExpress App Console
                              </a>
                            </Button>
                          </div>

                          <div className="border-l-4 border-green-500 pl-4">
                            <h4 className="font-semibold">Step 2: Start OAuth Authorization</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Once your app is configured, click the button below to start the OAuth flow:
                            </p>
                            {oauthUrl?.oauth_url && (
                              <Button asChild className="mt-3">
                                <a href={oauthUrl.oauth_url} target="_blank" rel="noopener noreferrer">
                                  <Key className="h-4 w-4 mr-2" />
                                  Authorize SmartLinks with AliExpress
                                </a>
                              </Button>
                            )}
                          </div>

                          <div className="border-l-4 border-orange-500 pl-4">
                            <h4 className="font-semibold">Step 3: Enter Authorization Code</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              After authorization, you'll be redirected back here automatically with the code. 
                              The code field below will be filled automatically, then click "Exchange Token":
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Input
                                placeholder="Authorization code will appear here automatically..."
                                value={oauthCode}
                                onChange={(e) => setOauthCode(e.target.value)}
                                className="font-mono text-sm"
                              />
                              <Button 
                                onClick={handleOAuthExchange}
                                disabled={exchangeTokenMutation.isPending || !oauthCode.trim()}
                              >
                                {exchangeTokenMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Exchange Token
                              </Button>
                            </div>
                            {oauthCode && (
                              <p className="text-xs text-green-600 mt-2">
                                ✓ Authorization code received! Click "Exchange Token" to complete authentication.
                              </p>
                            )}
                          </div>
                        </div>

                        {exchangeTokenMutation.data && (
                          <Alert className={exchangeTokenMutation.data.success ? "border-green-500" : "border-red-500"}>
                            {exchangeTokenMutation.data.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <AlertDescription>
                              {exchangeTokenMutation.data.success ? 
                                "Authentication successful! You can now use all AliExpress API features." : 
                                `Authentication failed: ${exchangeTokenMutation.data.error || 'Unknown error'}`}
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Alert className="border-red-500">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p><strong>Missing Configuration:</strong> AliExpress API credentials are not configured.</p>
                            <p className="text-sm">Required environment variables:</p>
                            <ul className="text-sm list-disc list-inside ml-4">
                              <li>ALIEXPRESS_APP_KEY</li>
                              <li>ALIEXPRESS_APP_SECRET</li>
                              <li>ALIEXPRESS_CALLBACK_URL</li>
                            </ul>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-green-500">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <strong>Authentication Successful!</strong> Your SmartLinks application is now connected to AliExpress API.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Active Token Information</h4>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        <div><strong>Status:</strong> Active</div>
                        {status?.tokenInfo?.obtainedAt && (
                          <div><strong>Obtained:</strong> {new Date(status.tokenInfo.obtainedAt).toLocaleString()}</div>
                        )}
                        {status?.tokenInfo?.expiresIn && (
                          <div><strong>Expires in:</strong> {Math.round(status.tokenInfo.expiresIn / 3600)} hours</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/aliexpress/status"] })}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Setup Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Setup Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <h4>Need help with AliExpress App Console?</h4>
                  <ol className="text-sm">
                    <li>Login to <a href="https://open.aliexpress.com/console" target="_blank" className="text-blue-600 underline">AliExpress Open Platform</a></li>
                    <li>Go to "App Console" → "Auth Management"</li>
                    <li>Set "Authorized Policy" to "Allow login user to authorize"</li>
                    <li>Configure token durations (1 day access, 2 day refresh recommended)</li>
                    <li>Save settings and return here to complete OAuth flow</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Search</CardTitle>
              <p className="text-sm text-muted-foreground">
                Search for products using AliExpress SKU or product ID
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.authenticated ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter product SKU or ID"
                      value={searchSku}
                      onChange={(e) => setSearchSku(e.target.value)}
                    />
                    <Button 
                      onClick={handleProductSearch}
                      disabled={productSearchMutation.isPending || !searchSku.trim()}
                    >
                      {productSearchMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Package className="h-4 w-4 mr-2" />
                      )}
                      Search
                    </Button>
                  </div>

                  {productSearchMutation.data && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Search Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                          {JSON.stringify(productSearchMutation.data, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please complete OAuth authentication first to search products.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage dropshipping orders and track shipments
              </p>
            </CardHeader>
            <CardContent>
              {status?.authenticated ? (
                <div className="space-y-4">
                  <Alert>
                    <ShoppingCart className="h-4 w-4" />
                    <AlertDescription>
                      Order management features will be available once you have active products and orders.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Pending Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">Awaiting processing</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Shipped Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">In transit</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Completed Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground">Delivered</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please complete OAuth authentication first to manage orders.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}