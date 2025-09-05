import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function useApiWithFallback<T>(
  queryKey: string[],
  queryFn: () => Promise<T>
) {
  const { toast } = useToast();
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        console.error(`API call failed for ${queryKey.join('/')}:`, error);
        
        // Show a one-time error toast
        if (!sessionStorage.getItem(`api-error-${queryKey[0]}`)) {
          toast({
            title: "Connection Error",
            description: "Unable to load data. Please check your connection and try again.",
            variant: "destructive",
          });
          sessionStorage.setItem(`api-error-${queryKey[0]}`, "true");
        }
        
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export function useDashboardMetrics() {
  return useApiWithFallback(
    ["/api/dashboard/metrics"],
    () => apiClient.getDashboardMetrics()
  );
}

export function useTransactions() {
  return useApiWithFallback(
    ["/api/finance/transactions"],
    () => apiClient.getTransactions()
  );
}

export function useInvoices() {
  return useApiWithFallback(
    ["/api/finance/invoices"],
    () => apiClient.getInvoices()
  );
}

export function useAiModels() {
  return useApiWithFallback(
    ["/api/ai/models"],
    () => apiClient.getAiModels()
  );
}

export function useAiStatus() {
  return useApiWithFallback(
    ["/api/ai/status"],
    () => apiClient.getAiStatus()
  );
}

export function useScrapers() {
  return useApiWithFallback(
    ["/api/scraper/scrapers"],
    () => apiClient.getScrapers()
  );
}

export function useScraperStatus() {
  return useApiWithFallback(
    ["/api/scraper-factory/status"],
    () => apiClient.getScraperStatus()
  );
}

export function useSystemLogs() {
  return useApiWithFallback(
    ["/api/logs"],
    () => apiClient.getSystemLogs()
  );
}

export function useUsers() {
  return useApiWithFallback(
    ["/api/users"],
    () => apiClient.getUsers()
  );
}

export function useSettings() {
  return useApiWithFallback(
    ["/api/settings/structured"],
    () => apiClient.getStructuredSettings()
  );
}

// Mutation hooks
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: apiClient.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({ title: "Transaction created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create transaction", variant: "destructive" });
    },
  });
}

export function useCreateScraper() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: apiClient.createScraper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/scrapers"] });
      toast({ title: "Scraper created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create scraper", variant: "destructive" });
    },
  });
}

export function useRunScraper() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: apiClient.runScraper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scraper/logs"] });
      toast({ title: "Scraper started successfully" });
    },
    onError: () => {
      toast({ title: "Failed to start scraper", variant: "destructive" });
    },
  });
}
