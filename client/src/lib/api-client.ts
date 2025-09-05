import { apiRequest } from "./queryClient";

class ApiClient {
  // Dashboard
  async getDashboardMetrics() {
    const response = await apiRequest("GET", "/api/dashboard/metrics");
    return response.json();
  }

  // Users
  async getUsers() {
    const response = await apiRequest("GET", "/api/users");
    return response.json();
  }

  async createUser(userData: any) {
    const response = await apiRequest("POST", "/api/users", userData);
    return response.json();
  }

  async updateUser(id: string, userData: any) {
    const response = await apiRequest("PUT", `/api/users/${id}`, userData);
    return response.json();
  }

  async deleteUser(id: string) {
    await apiRequest("DELETE", `/api/users/${id}`);
  }

  // Transactions
  async getTransactions() {
    const response = await apiRequest("GET", "/api/finance/transactions");
    return response.json();
  }

  async createTransaction(transactionData: any) {
    const response = await apiRequest("POST", "/api/finance/transactions", transactionData);
    return response.json();
  }

  async updateTransaction(id: string, transactionData: any) {
    const response = await apiRequest("PUT", `/api/finance/transactions/${id}`, transactionData);
    return response.json();
  }

  async deleteTransaction(id: string) {
    await apiRequest("DELETE", `/api/finance/transactions/${id}`);
  }

  // Invoices
  async getInvoices() {
    const response = await apiRequest("GET", "/api/finance/invoices");
    return response.json();
  }

  async createInvoice(invoiceData: any) {
    const response = await apiRequest("POST", "/api/finance/invoices", invoiceData);
    return response.json();
  }

  async updateInvoice(id: string, invoiceData: any) {
    const response = await apiRequest("PUT", `/api/finance/invoices/${id}`, invoiceData);
    return response.json();
  }

  async deleteInvoice(id: string) {
    await apiRequest("DELETE", `/api/finance/invoices/${id}`);
  }

  // AI Models
  async getAiModels() {
    const response = await apiRequest("GET", "/api/ai/models");
    return response.json();
  }

  async getAiStatus() {
    const response = await apiRequest("GET", "/api/ai/status");
    return response.json();
  }

  async getAiInferences() {
    const response = await apiRequest("GET", "/api/ai/inferences");
    return response.json();
  }

  async getAiLogs() {
    const response = await apiRequest("GET", "/api/ai/logs");
    return response.json();
  }

  async createAiModel(modelData: any) {
    const response = await apiRequest("POST", "/api/ai/models", modelData);
    return response.json();
  }

  async updateAiModel(id: string, modelData: any) {
    const response = await apiRequest("PUT", `/api/ai/models/${id}`, modelData);
    return response.json();
  }

  async deleteAiModel(id: string) {
    await apiRequest("DELETE", `/api/ai/models/${id}`);
  }

  // Scrapers
  async getScrapers() {
    const response = await apiRequest("GET", "/api/scraper/scrapers");
    return response.json();
  }

  async getScraperStatus() {
    const response = await apiRequest("GET", "/api/scraper-factory/status");
    return response.json();
  }

  async getScraperLogs() {
    const response = await apiRequest("GET", "/api/scraper/logs");
    return response.json();
  }

  async createScraper(scraperData: any) {
    const response = await apiRequest("POST", "/api/scraper/scrapers", scraperData);
    return response.json();
  }

  async updateScraper(id: string, scraperData: any) {
    const response = await apiRequest("PUT", `/api/scraper/scrapers/${id}`, scraperData);
    return response.json();
  }

  async deleteScraper(id: string) {
    await apiRequest("DELETE", `/api/scraper/scrapers/${id}`);
  }

  async runScraper(id: string) {
    const response = await apiRequest("POST", `/api/scraper/scrapers/${id}/run`);
    return response.json();
  }

  // Settings
  async getSettings() {
    const response = await apiRequest("GET", "/api/settings");
    return response.json();
  }

  async getStructuredSettings() {
    const response = await apiRequest("GET", "/api/settings/structured");
    return response.json();
  }

  async createSetting(settingData: any) {
    const response = await apiRequest("POST", "/api/settings", settingData);
    return response.json();
  }

  async updateSetting(key: string, settingData: any) {
    const response = await apiRequest("PUT", `/api/settings/${key}`, settingData);
    return response.json();
  }

  async bulkUpdateSettings(settings: any[]) {
    const response = await apiRequest("POST", "/api/settings/bulk", { settings });
    return response.json();
  }

  // System Logs
  async getSystemLogs() {
    const response = await apiRequest("GET", "/api/logs");
    return response.json();
  }
}

export const apiClient = new ApiClient();
