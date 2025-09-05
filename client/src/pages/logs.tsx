import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, Search, Download, RefreshCw, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import { useSystemLogs } from "@/hooks/use-api";
import { format } from "date-fns";

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data: logs, isLoading, refetch } = useSystemLogs();

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    
    return matchesSearch && matchesLevel && matchesSource;
  }) || [];

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      case "debug":
        return <Bug className="w-4 h-4 text-gray-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200";
      case "info":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200";
      case "debug":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "API":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200";
      case "Scrapers":
        return "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200";
      case "AI":
        return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const handleExport = () => {
    const csvContent = [
      ["Timestamp", "Level", "Source", "Message"].join(","),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          System Logs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitor system activity and debug issues
        </p>
      </div>

      {/* Log Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="level-filter">Level</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger data-testid="level-filter">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-filter">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger data-testid="source-filter">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                  <SelectItem value="Scrapers">Scrapers</SelectItem>
                  <SelectItem value="AI">AI</SelectItem>
                  <SelectItem value="Database">Database</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-filter">Date Range</Label>
              <Select defaultValue="24h">
                <SelectTrigger data-testid="date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-logs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => {
                setSearchTerm("");
                setLevelFilter("all");
                setSourceFilter("all");
              }} data-testid="clear-filters">
                Clear Filters
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-logs">
                <Download className="w-4 h-4 mr-2" />
                Export Logs
              </Button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh:</Label>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  data-testid="auto-refresh-toggle"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="manual-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Logs</CardTitle>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredLogs.length} of {logs?.length || 0} entries
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No logs found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Try adjusting your filters or search terms
              </p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log, index) => (
                <div
                  key={log.id || index}
                  className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        {getLevelIcon(log.level)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className={getLevelColor(log.level)} data-testid={`log-level-${index}`}>
                            {log.level.toUpperCase()}
                          </Badge>
                          <Badge className={getSourceColor(log.source)} data-testid={`log-source-${index}`}>
                            {log.source}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400" data-testid={`log-timestamp-${index}`}>
                            {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white" data-testid={`log-message-${index}`}>
                          {log.message}
                        </p>
                        {expandedLogs.has(log.id || index.toString()) && log.modelName && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            {log.modelName && <div>Model: {log.modelName}</div>}
                            {log.source === 'Scrapers' && (
                              <div>Additional context available in scraper logs</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLogExpansion(log.id || index.toString())}
                      className="ml-4"
                      data-testid={`expand-log-${index}`}
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${
                        expandedLogs.has(log.id || index.toString()) ? 'rotate-180' : ''
                      }`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
