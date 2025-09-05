import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Plus, TrendingUp, TrendingDown, DollarSign, Loader2, RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react";
import { useTransactions, useInvoices, useCreateTransaction } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} ${response.status}`);
  }
  return response.json();
}

async function apiPost<T>(url: string, data?: any): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`POST ${url} ${response.status}`);
  }
  return response.json();
}

export default function Finance() {
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const createTransaction = useCreateTransaction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Enhanced Finance queries
  const metrics = useQuery({
    queryKey: ["finance", "metrics", period],
    queryFn: () => apiGet(`/api/finance/metrics/${period}`),
    refetchInterval: 15000,
  });

  const paypalBalance = useQuery({
    queryKey: ["finance", "paypal"],
    queryFn: () => apiGet("/api/finance/paypal/balance"),
    enabled: true,
    retry: 1,
  });

  const stripeBalance = useQuery({
    queryKey: ["finance", "stripe"],
    queryFn: () => apiGet("/api/finance/stripe/balance"),
    enabled: true,
    retry: 1,
  });

  const payouts = useQuery({
    queryKey: ["finance", "payouts"],
    queryFn: () => apiGet("/api/payouts"),
    refetchInterval: 30000,
  });

  const payoutSync = useMutation({
    mutationFn: (dryRun: boolean) => apiPost("/api/payouts/sync", { dryRun }),
    onSuccess: async () => {
      toast({
        title: "Synchronisation terminée",
        description: "Tous les paiements d'affiliation ont été synchronisés.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
        paypalBalance.refetch(),
        stripeBalance.refetch(),
      ]);
    },
    onError: (error) => {
      toast({
        title: "Échec de la synchronisation",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Calculate financial metrics
  const totalIncome = transactions
    ?.filter((t: any) => t.transactionType === 'income' && t.status === 'completed')
    ?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0;
  
  const totalExpenses = transactions
    ?.filter((t: any) => t.transactionType === 'expense' && t.status === 'completed')
    ?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0;
  
  const netProfit = totalIncome - totalExpenses;

  const transactionColumns = [
    {
      key: "description",
      header: "Description",
      render: (value: string, row: any) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">{row.category}</div>
        </div>
      ),
    },
    {
      key: "transactionType",
      header: "Type",
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: string, row: any) => (
        <span className={`font-medium ${
          row.transactionType === 'income' ? 'text-green-600' : 'text-red-600'
        }`}>
          {row.transactionType === 'income' ? '+' : '-'}${value}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "createdAt",
      header: "Date",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
  ];

  const invoiceColumns = [
    {
      key: "description",
      header: "Description",
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: string) => `$${value}`,
    },
    {
      key: "status",
      header: "Status",
      render: (value: string) => <StatusBadge status={value} />,
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (value: string) => format(new Date(value), "MMM dd, yyyy"),
    },
  ];

  const transactionActions = [
    {
      label: "Edit",
      onClick: (row: any) => console.log("Edit transaction", row.id),
    },
    {
      label: "Delete",
      onClick: (row: any) => console.log("Delete transaction", row.id),
      variant: "destructive" as const,
    },
  ];

  const invoiceActions = [
    {
      label: "View",
      onClick: (row: any) => console.log("View invoice", row.id),
    },
    {
      label: "Edit",
      onClick: (row: any) => console.log("Edit invoice", row.id),
    },
    {
      label: "Delete",
      onClick: (row: any) => console.log("Delete invoice", row.id),
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-muted-foreground">
            Vue complète de vos finances, transactions et gains d'affiliation
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value: "7d" | "30d" | "90d" | "1y") => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
              <SelectItem value="1y">1 an</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setActiveTab("transactions")}>
            <Plus className="h-4 w-4 mr-2" />
            Transaction
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="payouts">Gains d'affiliation</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="accounts">Comptes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              title="Revenus Totaux"
              value={`$${totalIncome.toLocaleString()}`}
              change={{
                value: "+15.2%",
                type: "increase",
                period: "ce mois",
              }}
              icon={TrendingUp}
              iconColor="text-green-600 dark:text-green-400"
            />
            
            <MetricCard
              title="Dépenses"
              value={`$${totalExpenses.toLocaleString()}`}
              change={{
                value: "+8.4%",
                type: "increase",
                period: "ce mois",
              }}
              icon={TrendingDown}
              iconColor="text-red-600 dark:text-red-400"
            />
            
            <MetricCard
              title="Profit Net"
              value={`$${netProfit.toLocaleString()}`}
              change={{
                value: "+22.1%",
                type: "increase",
                period: "ce mois",
              }}
              icon={DollarSign}
              iconColor="text-blue-600 dark:text-blue-400"
            />

            <MetricCard
              title="Gains Affiliation"
              value={payouts?.data?.payouts ? `$${(payouts.data.payouts?.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0).toLocaleString()}` : "$0"}
              change={{
                value: "3 payouts",
                type: "neutral",
                period: "ce mois",
              }}
              icon={CheckCircle}
              iconColor="text-purple-600 dark:text-purple-400"
            />
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Gains d'affiliation Amazon</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => payoutSync.mutate(true)}
                disabled={payoutSync.isPending}
                variant="outline"
              >
                {payoutSync.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Test Sync
              </Button>
              <Button
                onClick={() => payoutSync.mutate(false)}
                disabled={payoutSync.isPending}
              >
                {payoutSync.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Sync Complet
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Détectés</p>
                    <p className="text-2xl font-bold">{(payouts?.data as any)?.totals?.detected || 0}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">En attente</p>
                    <p className="text-2xl font-bold">{(payouts?.data as any)?.totals?.pending || 0}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Payés</p>
                    <p className="text-2xl font-bold">{(payouts?.data as any)?.totals?.paid || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rejetés</p>
                    <p className="text-2xl font-bold">{(payouts?.data as any)?.totals?.rejected || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historique des Gains</CardTitle>
            </CardHeader>
            <CardContent>
              {payouts?.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {(payouts?.data as any)?.payouts?.map((payout: any) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold">${payout.amount} {payout.currency}</div>
                          <StatusBadge status={payout.status} />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {payout.programType} • {format(new Date(payout.paymentDate), "dd MMM yyyy")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payout.description}
                        </div>
                      </div>
                      <div className="text-right">
                        {payout.syncedAt && (
                          <div className="text-xs text-green-600">
                            Traité le {format(new Date(payout.syncedAt), "dd/MM/yyyy à HH:mm")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <h2 className="text-2xl font-semibold">Comptes Financiers</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Stripe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stripeBalance?.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement...
                  </div>
                ) : (stripeBalance?.data as any)?.success ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-green-600">
                      {(stripeBalance.data as any).balance.available?.map((balance: any) => 
                        `${(balance.amount / 100).toFixed(2)} ${balance.currency.toUpperCase()}`
                      ).join(', ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Disponible
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">Connexion échouée</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  PayPal
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paypalBalance?.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement...
                  </div>
                ) : (paypalBalance?.data as any)?.success ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-green-600">
                      {(paypalBalance.data as any).balances?.map((balance: any) => 
                        `${balance.total_balance.value} ${balance.total_balance.currency_code}`
                      ).join(', ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Solde total
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-red-600">Connexion échouée</div>
                    <div className="text-xs text-muted-foreground">
                      Vérifiez vos identifiants PayPal
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Toutes les Transactions</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter Transaction
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                data={transactions || []}
                columns={transactionColumns}
                actions={transactionActions}
                loading={transactionsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Invoices</CardTitle>
              <Button size="sm" data-testid="create-invoice-from-tab">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                data={invoices || []}
                columns={invoiceColumns}
                actions={invoiceActions}
                loading={invoicesLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
