import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import Dashboard from "@/pages/dashboard";
import Finance from "@/pages/finance";

import ChannelsConfigPage from "@/pages/channels-config";
import ApiKeysConfig from "@/pages/api-keys-config";
import AiMonitoring from "@/pages/ai-monitoring";
import Scrapers from "@/pages/scrapers";
import AliExpress from "@/pages/aliexpress";

import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Monetization from "@/pages/monetization";
import NotFound from "@/pages/not-found";
import IASDashboard from "@/pages/IASDashboard";
import IASAdmin from "@/pages/IASAdmin";
import DGAISupervisorDashboard from "@/pages/DGAISupervisorDashboard";

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/finance" component={Finance} />

        <Route path="/channels-config" component={ChannelsConfigPage} />
        <Route path="/api-keys-config" component={ApiKeysConfig} />
        <Route path="/monetization" component={Monetization} />
        <Route path="/ai-monitoring" component={AiMonitoring} />
        <Route path="/scrapers" component={Scrapers} />
        <Route path="/aliexpress" component={AliExpress} />
        <Route path="/ias" component={IASDashboard} />
        <Route path="/ias/admin" component={IASAdmin} />
        <Route path="/dg-ai-supervisor" component={DGAISupervisorDashboard} />

        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route path="/users" component={Users} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="smartlinks-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
