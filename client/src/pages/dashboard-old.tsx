import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, StatusBadge } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  DollarSign, 
  Globe, 
  File,
  Bot,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { useDashboardMetrics, useTransactions, useAiModels } from "@/hooks/use-api";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const { data: aiModels, isLoading: modelsLoading } = useAiModels();

  const recentTransactions = transactions?.slice(0, 5) || [];

  const transactionColumns = [
    {
      key: "description",
      header: "Transaction",
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

  if (metricsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to SmartLinks Autopilot
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <MetricCard
          title="Total Users"
          value={metrics?.totalUsers || 0}
          change={{
            value: "+12%",
            type: "increase",
            period: "this month",
          }}
          icon={Users}
          iconColor="text-blue-600 dark:text-blue-400"
        />
        
        <MetricCard
          title="Total Revenue"
          value={`$${metrics?.totalRevenue?.toLocaleString() || 0}`}
          change={{
            value: "+18%",
            type: "increase",
            period: "this month",
          }}
          icon={DollarSign}
          iconColor="text-green-600 dark:text-green-400"
        />
        
        <MetricCard
          title="Active Scrapers"
          value={metrics?.activeScrapers || 0}
          change={{
            value: "24 running",
            type: "neutral",
          }}
          icon={Globe}
          iconColor="text-purple-600 dark:text-purple-400"
        />
        
        <MetricCard
          title="Pending Invoices"
          value={metrics?.pendingInvoices || 0}
          change={{
            value: "2 overdue",
            type: "decrease",
          }}
          icon={File}
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Charts and AI Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Chart Placeholder */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-3">
            <CardTitle className="text-base sm:text-lg">Revenue Trends</CardTitle>
            <Button variant="ghost" size="sm" data-testid="view-revenue-details" className="self-start sm:self-auto">
              <span className="hidden sm:inline">View Details</span>
              <ArrowRight className="w-4 h-4 sm:ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Revenue Chart</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Chart implementation with Chart.js
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Model Performance */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-3">
            <CardTitle className="text-base sm:text-lg">AI Model Performance</CardTitle>
            <Button variant="ghost" size="sm" data-testid="view-ai-details" className="self-start sm:self-auto">
              <span className="hidden sm:inline">Manage Models</span>
              <Bot className="w-4 h-4 sm:mr-2" />
              <ArrowRight className="w-4 h-4 sm:ml-2" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {modelsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : aiModels && aiModels.length > 0 ? (
              aiModels?.slice(0, 3).map((model: any) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
                        {model.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {model.provider}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {model.accuracy}%
                    </span>
                    <div className={`w-2 h-2 rounded-full ${
                      model.status === 'active' ? 'bg-green-500' : 
                      model.status === 'training' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
                No AI models configured
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-3">
          <CardTitle className="text-base sm:text-lg">Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" data-testid="view-all-transactions" className="self-start sm:self-auto">
            <span className="hidden sm:inline">View All</span>
            <ArrowRight className="w-4 h-4 sm:ml-2" />
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <DataTable
              data={recentTransactions}
              columns={transactionColumns}
              loading={transactionsLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
