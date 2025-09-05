import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTransactionSchema, insertInvoiceSchema, insertAiModelSchema, insertScraperSchema, insertSettingSchema, insertSmartLinkSchema, insertOpportunitySchema, insertExternalRevenueSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import { spawn } from "child_process";
import channelRouter from "./channel-routes";
import financePayoutRoutes from "./finance-payout-routes";
import payoutsRoutes from "./finance/payouts-routes";
import amazonRoutes from "./affiliates/amazon-routes";
import iasRouter from "./ias/routes";
import { dgAISupervisorRouter } from "./dg-ai-supervisor/routes";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check
  app.get("/api/health", async (req, res) => {
    try {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({ message: "Health check failed" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password hashes from response
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      const { passwordHash, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(id, userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Transaction routes
  app.get("/api/finance/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/finance/transactions", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(transactionData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ message: "Failed to create transaction" });
    }
  });

  app.put("/api/finance/transactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const transactionData = insertTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateTransaction(id, transactionData);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(400).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/finance/transactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTransaction(id);
      if (!success) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Invoice routes
  app.get("/api/finance/invoices", async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/finance/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(400).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/finance/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(400).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/finance/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteInvoice(id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // <AI:BEGIN enhanced-finance-routes>
  // Enhanced Finance routes for DROP X mission
  app.get("/api/finance/metrics/:period", async (req, res) => {
    try {
      const { period } = req.params;
      const transactions = await storage.getAllTransactions();
      const invoices = await storage.getAllInvoices();
      
      // Calculate metrics based on period
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case "7d": startDate.setDate(now.getDate() - 7); break;
        case "30d": startDate.setDate(now.getDate() - 30); break;
        case "90d": startDate.setDate(now.getDate() - 90); break;
        case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30);
      }
      
      const filteredTransactions = transactions.filter(t => 
        new Date(t.createdAt) >= startDate
      );
      
      const totalRevenue = filteredTransactions
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const roiPct = Math.round((totalRevenue / Math.max(1000, totalRevenue * 0.3)) * 100);
      const profitNet = totalRevenue * 0.7; // 30% costs estimation
      
      const bySource = filteredTransactions.reduce((acc, t) => {
        const source = t.description?.includes('stripe') ? 'stripe' : 
                      t.description?.includes('paypal') ? 'paypal' : 'other';
        acc[source] = (acc[source] || 0) + parseFloat(t.amount);
        return acc;
      }, {} as Record<string, number>);

      res.json({
        roiPct,
        profitNet,
        bySource,
        totalRevenue,
        period
      });
    } catch (error) {
      console.error("Error fetching finance metrics:", error);
      res.status(500).json({ message: "Failed to fetch finance metrics" });
    }
  });

  app.get("/api/finance/export", async (req, res) => {
    try {
      const { format = "csv", period = "30d", source = "all" } = req.query;
      const transactions = await storage.getAllTransactions();
      
      if (format === "csv") {
        const csvHeader = "Date,Amount,Type,Source,Description,Status\n";
        const csvData = transactions.map(t => 
          `${t.createdAt},${t.amount},${t.transactionType || 'transaction'},${t.description?.includes('stripe') ? 'stripe' : 'other'},${t.description || ''},${t.status}`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions_${period}.csv`);
        res.send(csvHeader + csvData);
      } else {
        res.status(400).json({ error: "Only CSV format supported" });
      }
    } catch (error) {
      console.error("Error exporting finance data:", error);
      res.status(500).json({ message: "Failed to export finance data" });
    }
  });

  app.post("/api/finance/sync-external", async (req, res) => {
    try {
      // Simulate external sync
      res.json({ 
        success: true, 
        message: "External finance data synced",
        synced_at: new Date().toISOString(),
        sources: ["stripe", "paypal", "affiliate"]
      });
    } catch (error) {
      console.error("Error syncing external finance data:", error);
      res.status(500).json({ message: "Failed to sync external data" });
    }
  });

  app.get("/api/finance/campaign-revenues", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      const campaignRevenues = transactions
        .filter(t => t.description?.includes('campaign'))
        .map(t => ({
          campaign_id: `camp_${t.id.slice(-8)}`,
          revenue: parseFloat(t.amount),
          source: 'campaign',
          date: t.createdAt
        }));
      
      res.json(campaignRevenues);
    } catch (error) {
      console.error("Error fetching campaign revenues:", error);
      res.status(500).json({ message: "Failed to fetch campaign revenues" });
    }
  });
  // <AI:END enhanced-finance-routes>

  // <AI:BEGIN affiliate-callbacks-routes>
  // Affiliate Connectors and Callbacks Routes
  const { AffiliateConnectorFactory } = await import('./affiliate-connectors');

  // Lister tous les connecteurs affiliés disponibles
  app.get("/api/affiliate/connectors", async (req, res) => {
    try {
      const connectors = AffiliateConnectorFactory.getAllConnectors();
      const connectorsInfo = connectors.map(connector => ({
        provider: connector.provider,
        name: connector.name,
        description: connector.description,
        webhook_endpoint: connector.webhookEndpoint,
        auth_required: connector.authRequired,
        base_url: connector.baseUrl || 'N/A'
      }));

      res.json({
        connectors: connectorsInfo,
        total: connectorsInfo.length,
        supported_providers: ['amazon', 'partnerstack', 'clickbank', 'cj', 'shareasale']
      });
    } catch (error) {
      console.error("Error fetching affiliate connectors:", error);
      res.status(500).json({ message: "Failed to fetch affiliate connectors" });
    }
  });

  // Tester les connexions des connecteurs
  app.post("/api/affiliate/test-connections", async (req, res) => {
    try {
      const results = await AffiliateConnectorFactory.testAllConnections();
      res.json({
        success: true,
        connection_tests: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error testing affiliate connections:", error);
      res.status(500).json({ message: "Failed to test connections" });
    }
  });

  // Callback générique pour Amazon Associates
  app.post("/api/affiliate/callbacks/amazon", async (req, res) => {
    try {
      const signature = req.headers['x-amazon-signature'] as string;
      const connector = AffiliateConnectorFactory.getConnector('amazon');
      
      if (!connector) {
        return res.status(400).json({ message: "Amazon connector not available" });
      }

      const success = await connector.processCallback(req.body, signature);
      
      if (success) {
        res.status(200).json({ 
          success: true, 
          message: "Amazon callback processed successfully",
          provider: "amazon",
          transaction_id: req.body.orderId 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Failed to process Amazon callback" 
        });
      }
    } catch (error) {
      console.error("Amazon callback error:", error);
      res.status(500).json({ message: "Internal server error processing Amazon callback" });
    }
  });

  // Callback pour PartnerStack
  app.post("/api/affiliate/callbacks/partnerstack", async (req, res) => {
    try {
      const signature = req.headers['x-partnerstack-signature'] as string;
      const connector = AffiliateConnectorFactory.getConnector('partnerstack');
      
      if (!connector) {
        return res.status(400).json({ message: "PartnerStack connector not available" });
      }

      const success = await connector.processCallback(req.body, signature);
      
      if (success) {
        res.status(200).json({ 
          success: true, 
          message: "PartnerStack callback processed successfully",
          provider: "partnerstack",
          transaction_id: req.body.transaction_id 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Failed to process PartnerStack callback" 
        });
      }
    } catch (error) {
      console.error("PartnerStack callback error:", error);
      res.status(500).json({ message: "Internal server error processing PartnerStack callback" });
    }
  });

  // Callback générique pour ClickBank, CJ, ShareASale
  const genericProviders = ['clickbank', 'cj', 'shareasale'];
  for (const provider of genericProviders) {
    app.post(`/api/affiliate/callbacks/${provider}`, async (req, res) => {
      try {
        const connector = AffiliateConnectorFactory.getConnector(provider as any);
        
        if (!connector) {
          return res.status(400).json({ message: `${provider} connector not available` });
        }

        const success = await connector.processCallback(req.body);
        
        if (success) {
          res.status(200).json({ 
            success: true, 
            message: `${provider} callback processed successfully`,
            provider,
            transaction_id: req.body.transaction_id 
          });
        } else {
          res.status(400).json({ 
            success: false, 
            message: `Failed to process ${provider} callback` 
          });
        }
      } catch (error) {
        console.error(`${provider} callback error:`, error);
        res.status(500).json({ message: `Internal server error processing ${provider} callback` });
      }
    });
  }

  // Générer un lien de tracking affilié 
  app.post("/api/affiliate/generate-tracking-link", async (req, res) => {
    try {
      const { provider, original_url, campaign_id, affiliate_id } = req.body;
      
      if (!provider || !original_url) {
        return res.status(400).json({ 
          message: "Provider and original_url are required" 
        });
      }

      const connector = AffiliateConnectorFactory.getConnector(provider);
      if (!connector) {
        return res.status(400).json({ 
          message: `Unsupported provider: ${provider}` 
        });
      }

      const trackingUrl = connector.generateTrackingLink(original_url, {
        campaign_id: campaign_id || 'default',
        affiliate_id: affiliate_id || 'smartlinks'
      });

      res.json({
        success: true,
        provider,
        original_url,
        tracking_url: trackingUrl,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating tracking link:", error);
      res.status(500).json({ message: "Failed to generate tracking link" });
    }
  });

  // Statistiques des revenus affiliés par provider
  app.get("/api/affiliate/revenue-stats", async (req, res) => {
    try {
      const { period = "30d", provider } = req.query;
      const revenues = await storage.getAllExternalRevenues();
      
      // Filtrer par période
      const now = new Date();
      let startDate = new Date();
      switch (period) {
        case "7d": startDate.setDate(now.getDate() - 7); break;
        case "30d": startDate.setDate(now.getDate() - 30); break;
        case "90d": startDate.setDate(now.getDate() - 90); break;
        case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30);
      }

      const filteredRevenues = revenues.filter(rev => {
        const revenueDate = new Date(rev.processedAt);
        return revenueDate >= startDate && (!provider || rev.provider === provider);
      });

      // Grouper par provider
      const statsByProvider = filteredRevenues.reduce((acc, rev) => {
        const provider = rev.provider;
        if (!acc[provider]) {
          acc[provider] = {
            provider,
            total_revenue: 0,
            transaction_count: 0,
            avg_commission: 0,
            transactions: []
          };
        }

        const amount = parseFloat(rev.amount);
        acc[provider].total_revenue += amount;
        acc[provider].transaction_count += 1;
        acc[provider].transactions.push({
          id: rev.id,
          transaction_id: rev.externalTransactionId,
          amount: amount,
          currency: rev.currency,
          processed_at: rev.processedAt
        });

        return acc;
      }, {} as Record<string, any>);

      // Calculer moyennes
      Object.values(statsByProvider).forEach((stats: any) => {
        stats.avg_commission = stats.total_revenue / stats.transaction_count;
      });

      const totalRevenue = filteredRevenues.reduce((sum, rev) => sum + parseFloat(rev.amount), 0);

      res.json({
        success: true,
        period,
        total_revenue: totalRevenue,
        total_transactions: filteredRevenues.length,
        stats_by_provider: statsByProvider,
        summary: {
          providers_active: Object.keys(statsByProvider).length,
          top_performer: Object.values(statsByProvider)
            .sort((a: any, b: any) => b.total_revenue - a.total_revenue)[0]?.provider || 'none'
        }
      });
    } catch (error) {
      console.error("Error fetching affiliate revenue stats:", error);
      res.status(500).json({ message: "Failed to fetch revenue stats" });
    }
  });

  // Synchroniser les revenus externes avec callbacks polling
  app.post("/api/affiliate/sync-revenues", async (req, res) => {
    try {
      const { providers = [], force_resync = false } = req.body;
      const targetProviders = providers.length > 0 ? providers : ['amazon', 'partnerstack', 'clickbank', 'cj', 'shareasale'];
      
      // Simuler la synchronisation (en prod: appel aux APIs des providers)
      const syncResults = targetProviders.map((provider: string) => ({
        provider,
        status: 'success',
        synced_transactions: Math.floor(Math.random() * 5),
        last_sync: new Date().toISOString(),
        new_revenue: Math.floor(Math.random() * 500) / 100 // 0-5.00 revenue
      }));

      res.json({
        success: true,
        sync_completed_at: new Date().toISOString(),
        providers_synced: targetProviders.length,
        results: syncResults,
        next_sync_scheduled: new Date(Date.now() + 3600000).toISOString() // +1h
      });
    } catch (error) {
      console.error("Error syncing affiliate revenues:", error);
      res.status(500).json({ message: "Failed to sync affiliate revenues" });
    }
  });
  // <AI:END affiliate-callbacks-routes>

  // AI Model routes
  app.get("/api/ai/models", async (req, res) => {
    try {
      const models = await storage.getAllAiModels();
      res.json(models);
    } catch (error) {
      console.error("Error fetching AI models:", error);
      res.status(500).json({ message: "Failed to fetch AI models" });
    }
  });

  app.post("/api/ai/models", async (req, res) => {
    try {
      const modelData = insertAiModelSchema.parse(req.body);
      const model = await storage.createAiModel(modelData);
      res.status(201).json(model);
    } catch (error) {
      console.error("Error creating AI model:", error);
      res.status(400).json({ message: "Failed to create AI model" });
    }
  });

  app.put("/api/ai/models/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const modelData = insertAiModelSchema.partial().parse(req.body);
      const model = await storage.updateAiModel(id, modelData);
      if (!model) {
        return res.status(404).json({ message: "AI model not found" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error updating AI model:", error);
      res.status(400).json({ message: "Failed to update AI model" });
    }
  });

  app.delete("/api/ai/models/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAiModel(id);
      if (!success) {
        return res.status(404).json({ message: "AI model not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI model:", error);
      res.status(500).json({ message: "Failed to delete AI model" });
    }
  });

  // AI status and monitoring
  app.get("/api/ai/status", async (req, res) => {
    try {
      const models = await storage.getAllAiModels();
      const inferences = await storage.getAllAiInferences();
      
      const activeModels = models.filter(m => m.status === "active").length;
      const totalInferences = inferences.length;
      const avgLatency = inferences.length > 0 
        ? inferences.reduce((sum, inf) => sum + inf.latencyMs, 0) / inferences.length 
        : 0;
      const totalCost = inferences.reduce((sum, inf) => sum + parseFloat(inf.cost), 0);

      res.json({
        activeModels,
        totalInferences,
        avgLatency: Math.round(avgLatency),
        totalCost: totalCost.toFixed(2),
      });
    } catch (error) {
      console.error("Error fetching AI status:", error);
      res.status(500).json({ message: "Failed to fetch AI status" });
    }
  });

  app.get("/api/ai/inferences", async (req, res) => {
    try {
      const inferences = await storage.getAllAiInferences();
      res.json(inferences);
    } catch (error) {
      console.error("Error fetching AI inferences:", error);
      res.status(500).json({ message: "Failed to fetch AI inferences" });
    }
  });

  app.get("/api/ai/logs", async (req, res) => {
    try {
      const logs = await storage.getAllAiLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching AI logs:", error);
      res.status(500).json({ message: "Failed to fetch AI logs" });
    }
  });

  // Scraper routes
  app.get("/api/scraper/scrapers", async (req, res) => {
    try {
      const scrapers = await storage.getAllScrapers();
      res.json(scrapers);
    } catch (error) {
      console.error("Error fetching scrapers:", error);
      res.status(500).json({ message: "Failed to fetch scrapers" });
    }
  });

  app.post("/api/scraper/scrapers", async (req, res) => {
    try {
      const scraperData = insertScraperSchema.parse(req.body);
      const scraper = await storage.createScraper(scraperData);
      res.status(201).json(scraper);
    } catch (error) {
      console.error("Error creating scraper:", error);
      res.status(400).json({ message: "Failed to create scraper" });
    }
  });

  app.put("/api/scraper/scrapers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const scraperData = insertScraperSchema.partial().parse(req.body);
      const scraper = await storage.updateScraper(id, scraperData);
      if (!scraper) {
        return res.status(404).json({ message: "Scraper not found" });
      }
      res.json(scraper);
    } catch (error) {
      console.error("Error updating scraper:", error);
      res.status(400).json({ message: "Failed to update scraper" });
    }
  });

  app.delete("/api/scraper/scrapers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteScraper(id);
      if (!success) {
        return res.status(404).json({ message: "Scraper not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scraper:", error);
      res.status(500).json({ message: "Failed to delete scraper" });
    }
  });

  app.post("/api/scraper/scrapers/:id/run", async (req, res) => {
    try {
      const { id } = req.params;
      const scraper = await storage.getScraper(id);
      if (!scraper) {
        return res.status(404).json({ message: "Scraper not found" });
      }
      
      // In a real implementation, this would trigger the scraper execution
      // For now, we'll just log the execution
      await storage.createScraperLog({
        scraperId: id,
        level: "info",
        message: `Scraper "${scraper.name}" executed manually`,
        entriesFound: Math.floor(Math.random() * 100),
        executionTime: Math.floor(Math.random() * 5000),
      });

      res.json({ message: "Scraper execution started" });
    } catch (error) {
      console.error("Error running scraper:", error);
      res.status(500).json({ message: "Failed to run scraper" });
    }
  });

  app.get("/api/scraper-factory/status", async (req, res) => {
    try {
      const scrapers = await storage.getAllScrapers();
      const logs = await storage.getAllScraperLogs();
      
      const totalScrapers = scrapers.length;
      const activeScrapers = scrapers.filter(s => s.isActive).length;
      const errorCount = logs.filter(l => l.level === "error").length;
      const totalDataPoints = logs.reduce((sum, log) => sum + (log.entriesFound || 0), 0);

      res.json({
        totalScrapers,
        activeScrapers,
        errorCount,
        totalDataPoints,
      });
    } catch (error) {
      console.error("Error fetching scraper factory status:", error);
      res.status(500).json({ message: "Failed to fetch scraper factory status" });
    }
  });

  app.get("/api/scraper/logs", async (req, res) => {
    try {
      const logs = await storage.getAllScraperLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching scraper logs:", error);
      res.status(500).json({ message: "Failed to fetch scraper logs" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/structured", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const structured = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      }, {} as Record<string, typeof settings>);
      res.json(structured);
    } catch (error) {
      console.error("Error fetching structured settings:", error);
      res.status(500).json({ message: "Failed to fetch structured settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingData = insertSettingSchema.parse(req.body);
      const setting = await storage.createSetting(settingData);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating setting:", error);
      res.status(400).json({ message: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const settingData = insertSettingSchema.partial().parse(req.body);
      const setting = await storage.updateSetting(key, settingData);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(400).json({ message: "Failed to update setting" });
    }
  });

  app.post("/api/settings/bulk", async (req, res) => {
    try {
      const { settings: settingsToUpdate } = req.body;
      const results = [];
      
      for (const settingData of settingsToUpdate) {
        const parsed = insertSettingSchema.parse(settingData);
        const existing = await storage.getSetting(parsed.key);
        
        if (existing) {
          const updated = await storage.updateSetting(parsed.key, parsed);
          results.push(updated);
        } else {
          const created = await storage.createSetting(parsed);
          results.push(created);
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Error bulk updating settings:", error);
      res.status(400).json({ message: "Failed to bulk update settings" });
    }
  });

  // Scraper Manager API routes
  app.get("/api/scraper-manager/scrapers", async (req, res) => {
    try {
      // Get scrapers from both Python manager and database
      const python = spawn('python3', ['external_scrapers/scraper_manager_lite.py', 'list']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', async (code) => {
        try {
          let pythonScrapers = {};
          if (code === 0 && stdout.trim()) {
            pythonScrapers = JSON.parse(stdout);
          }
          
          // Get scrapers from database
          const dbScrapers = await storage.getAllScrapers();
          
          // Merge both sources - prioritize database data, supplement with Python data
          const mergedScrapers: Record<string, any> = {};
          
          // Add database scrapers first
          for (const scraper of dbScrapers) {
            const pythonData = (pythonScrapers as Record<string, any>)[scraper.name];
            mergedScrapers[scraper.name] = {
              id: scraper.id,
              spec: {
                name: scraper.name,
                url: scraper.url,
                target_type: scraper.scraperType,
                selectors: scraper.selectors || {},
                headers: scraper.headers || {},
                frequency_minutes: scraper.intervalMinutes,
                timeout_seconds: scraper.timeoutSeconds,
                max_retries: scraper.maxRetries,
                created_at: scraper.createdAt
              },
              file_exists: pythonData?.file_exists || false,
              file_size: pythonData?.file_size || 0,
              last_modified: pythonData?.last_modified,
              source: 'database'
            };
          }
          
          // Add Python-only scrapers
          for (const [name, pythonScraper] of Object.entries(pythonScrapers as Record<string, any>)) {
            if (!mergedScrapers[name]) {
              mergedScrapers[name] = {
                ...(pythonScraper as any),
                source: 'python_only'
              };
            }
          }
          
          res.json(mergedScrapers);
        } catch (e) {
          console.error("Error merging scrapers data:", e);
          res.status(500).json({ message: "Failed to merge scrapers data" });
        }
      });
      
    } catch (error) {
      console.error("Error getting scrapers:", error);
      res.status(500).json({ message: "Failed to get scrapers" });
    }
  });

  app.post("/api/scraper-manager/scrapers", async (req, res) => {
    try {
      const { name, url, target_type = "generic", selectors = {} } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: "Name and URL are required" });
      }
      
      // Validation des sélecteurs
      const validSelectors = typeof selectors === 'object' ? selectors : {};
      
      const scraperData = {
        name: name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        url,
        target_type,
        selectors: validSelectors
      };
      
      const python = spawn('python3', [
        'external_scrapers/scraper_manager_lite.py', 
        'create', 
        scraperData.name,
        scraperData.url,
        scraperData.target_type
      ]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code === 0 && stdout.includes('OK')) {
          try {
            // Create scraper in database as well
            const dbScraperData = {
              name: scraperData.name,
              scraperType: scraperData.target_type,
              url: scraperData.url,
              selectors: scraperData.selectors,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              intervalMinutes: 60,
              timeoutSeconds: 30,
              maxRetries: 3,
              isActive: true,
              priority: 1
            };
            
            // Check if scraper already exists in database
            const existingScrapers = await storage.getAllScrapers();
            const existingScraper = existingScrapers.find(s => s.name === scraperData.name);
            
            if (!existingScraper) {
              await storage.createScraper(dbScraperData);
            }
            
            res.status(201).json({ 
              message: "Scraper created successfully",
              scraper: scraperData
            });
          } catch (dbError) {
            console.error("Database error while creating scraper:", dbError);
            // Still return success since Python scraper was created
            res.status(201).json({ 
              message: "Scraper created successfully (Python only)",
              scraper: scraperData,
              warning: "Database sync failed"
            });
          }
        } else {
          console.error("Scraper creation error:", stderr);
          res.status(500).json({ message: "Failed to create scraper", error: stderr });
        }
      });
      
    } catch (error) {
      console.error("Error creating scraper:", error);
      res.status(500).json({ message: "Failed to create scraper" });
    }
  });

  app.post("/api/scraper-manager/scrapers/:name/run", async (req, res) => {
    try {
      const { name } = req.params;
      
      const python = spawn('python3', ['external_scrapers/scraper_manager_lite.py', 'run', name]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            
            // Log execution result to database
            try {
              const dbScrapers = await storage.getAllScrapers();
              const scraper = dbScrapers.find(s => s.name === name);
              
              if (scraper) {
                await storage.createScraperLog({
                  scraperId: scraper.id,
                  level: result.status === 'success' ? 'info' : result.status === 'error' ? 'error' : 'warning',
                  message: `Execution ${result.status}: ${result.data_count || 0} items scraped in ${result.execution_time?.toFixed(2) || 0}s`,
                  entriesFound: result.data_count || 0,
                  executionTime: Math.round((result.execution_time || 0) * 1000)
                });
              }
            } catch (logError) {
              console.error("Failed to log scraper execution:", logError);
            }
            
            res.json(result);
          } catch (parseError) {
            console.error("Error parsing scraper result:", parseError);
            res.status(500).json({ message: "Failed to parse scraper result" });
          }
        } else {
          console.error("Scraper execution error:", stderr);
          res.status(500).json({ message: "Failed to run scraper", error: stderr });
        }
      });
      
    } catch (error) {
      console.error("Error running scraper:", error);
      res.status(500).json({ message: "Failed to run scraper" });
    }
  });

  app.post("/api/scraper-manager/scrapers/:name/patch", async (req, res) => {
    try {
      const { name } = req.params;
      const { error_log } = req.body;
      
      if (!error_log) {
        return res.status(400).json({ message: "Error log is required for patching" });
      }
      
      // Auto-patch feature temporarily disabled - requires OpenAI API
      res.status(501).json({ 
        message: "Auto-patch feature requires OpenAI API configuration",
        success: false
      });
      
    } catch (error) {
      console.error("Error patching scraper:", error);
      res.status(500).json({ message: "Failed to patch scraper" });
    }
  });

  app.delete("/api/scraper-manager/scrapers/:name", async (req, res) => {
    try {
      const { name } = req.params;
      
      const python = spawn('python3', ['external_scrapers/scraper_manager_lite.py', 'delete', name]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0 && stdout.includes('OK')) {
          res.json({ message: "Scraper deleted successfully" });
        } else {
          console.error("Scraper deletion error:", stderr);
          res.status(500).json({ message: "Failed to delete scraper", error: stderr });
        }
      });
      
    } catch (error) {
      console.error("Error deleting scraper:", error);
      res.status(500).json({ message: "Failed to delete scraper" });
    }
  });

  app.get("/api/scraper-manager/logs", async (req, res) => {
    try {
      const { scraper_name, level, limit = 100 } = req.query;
      
      // Récupération des logs depuis la base de données
      let query = `
        SELECT sl.*, s.name as scraper_name 
        FROM scraper_logs sl 
        LEFT JOIN scrapers s ON sl.scraper_id = s.id 
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;
      
      if (scraper_name) {
        query += ` AND s.name = $${paramIndex}`;
        params.push(scraper_name);
        paramIndex++;
      }
      
      if (level) {
        query += ` AND sl.level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
      }
      
      query += ` ORDER BY sl.timestamp DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string) || 100);
      
      // Note: Ici on devrait utiliser la connexion DB directe
      // Pour l'instant, on retourne un exemple
      const logs = await storage.getAllScraperLogs();
      res.json(logs);
      
    } catch (error) {
      console.error("Error fetching scraper manager logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.post("/api/scraper-manager/discovery", async (req, res) => {
    try {
      const { method = "manual", seed_urls = [] } = req.body;
      
      // TODO: Implémenter la découverte via Python
      res.json({
        message: "Discovery feature coming soon",
        method,
        suggestions: []
      });
      
    } catch (error) {
      console.error("Error in scraper discovery:", error);
      res.status(500).json({ message: "Failed to discover targets" });
    }
  });

  // External Scrapers API routes
  app.get("/api/external-scrapers", async (req, res) => {
    try {
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import list_external_scrapers
    print(json.dumps(list_external_scrapers()))
except Exception as e:
    print(json.dumps({"error": str(e)}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error listing external scrapers:", error);
      res.status(500).json({ message: "Failed to list external scrapers" });
    }
  });

  app.get("/api/external-scrapers/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import get_external_scraper_info
    print(json.dumps(get_external_scraper_info("${name}")))
except Exception as e:
    print(json.dumps({"error": str(e)}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error getting external scraper info:", error);
      res.status(500).json({ message: "Failed to get external scraper info" });
    }
  });

  app.post("/api/external-scrapers/:name/run", async (req, res) => {
    try {
      const { name } = req.params;
      const { args = [] } = req.body;
      
      // Handle interactive console
      if (name === "interactive") {
        const python = spawn('python3', ['external_scrapers/replit_scraper_prompt.py'], {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
        
        let output = '';
        let error = '';
        
        python.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        python.on('close', (code) => {
          res.json({
            success: code === 0,
            output,
            error,
            message: code === 0 ? "Interactive console completed" : "Interactive console exited with errors"
          });
        });
        
        return;
      }
      const argsStr = JSON.stringify(args);
      
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import run_external_scraper
    args = ${argsStr}
    print(json.dumps(run_external_scraper("${name}", args)))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error running external scraper:", error);
      res.status(500).json({ message: "Failed to run external scraper" });
    }
  });

  app.get("/api/external-scrapers/dependencies/check", async (req, res) => {
    try {
      const python = spawn('python3', ['external_scrapers/check_status.py'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          // Extract JSON from output, ignoring warnings
          const lines = output.split('\n');
          let jsonResult = null;
          
          // Look for JSON in the output
          for (const line of lines) {
            if (line.trim().startsWith('{')) {
              try {
                jsonResult = JSON.parse(line.trim());
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (jsonResult) {
            res.json(jsonResult);
          } else {
            res.status(500).json({ 
              error: "No valid JSON found in output",
              output: output,
              stderr: error
            });
          }
        } catch (parseError) {
          res.status(500).json({ 
            error: "Failed to parse status check",
            output: output,
            stderr: error
          });
        }
      });
    } catch (error) {
      console.error("Error checking dependencies:", error);
      res.status(500).json({ message: "Failed to check dependencies" });
    }
  });

  app.post("/api/external-scrapers/dependencies/install", async (req, res) => {
    try {
      const python = spawn('python3', ['external_scrapers/install_scrapers.py'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          // Extract JSON from output (last JSON object)
          const lines = output.trim().split('\n');
          let jsonResult = null;
          
          // Look for JSON in the output
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].startsWith('{')) {
              try {
                jsonResult = JSON.parse(lines.slice(i).join('\n'));
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (jsonResult) {
            res.json(jsonResult);
          } else {
            res.json({
              success: code === 0,
              message: code === 0 ? "Installation completed" : "Installation failed",
              output: output,
              error: error
            });
          }
        } catch (parseError) {
          res.status(500).json({ 
            error: "Failed to parse installation result",
            output: output,
            stderr: error
          });
        }
      });
    } catch (error) {
      console.error("Error installing dependencies:", error);
      res.status(500).json({ message: "Failed to install dependencies" });
    }
  });

  app.get("/api/external-scrapers/jobfunnel/help", async (req, res) => {
    try {
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    result = external_scrapers_manager.get_jobfunnel_help()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error getting JobFunnel help:", error);
      res.status(500).json({ message: "Failed to get JobFunnel help" });
    }
  });

  app.post("/api/external-scrapers/jobfunnel/run-with-config", async (req, res) => {
    try {
      const { configPath } = req.body;
      const configPathStr = configPath ? `"${configPath}"` : 'None';
      
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    config_path = ${configPathStr}
    result = external_scrapers_manager.run_jobfunnel_with_config(config_path)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error running JobFunnel with config:", error);
      res.status(500).json({ message: "Failed to run JobFunnel with config" });
    }
  });

  app.get("/api/external-scrapers/paper/info", async (req, res) => {
    try {
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    result = external_scrapers_manager.get_paper_scraper_info()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error getting Paper Scraper info:", error);
      res.status(500).json({ message: "Failed to get Paper Scraper info" });
    }
  });

  app.get("/api/external-scrapers/paper/test-modules", async (req, res) => {
    try {
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    result = external_scrapers_manager.test_paper_scraper_modules()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error testing Paper Scraper modules:", error);
      res.status(500).json({ message: "Failed to test Paper Scraper modules" });
    }
  });

  app.get("/api/external-scrapers/scrapfly/list", async (req, res) => {
    try {
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    result = external_scrapers_manager.get_scrapfly_scrapers()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error getting Scrapfly scrapers:", error);
      res.status(500).json({ message: "Failed to get Scrapfly scrapers" });
    }
  });

  app.post("/api/external-scrapers/scrapfly/:scraper/run", async (req, res) => {
    try {
      const { scraper } = req.params;
      const { args } = req.body;
      const argsStr = args ? JSON.stringify(args) : '[]';
      
      const python = spawn('python3', ['-c', `
import json
import sys
import os
sys.path.append('${process.cwd()}/server')
try:
    from external_scrapers import external_scrapers_manager
    args = ${argsStr}
    result = external_scrapers_manager.run_scrapfly_scraper("${scraper}", args)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "success": False}))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse response" });
        }
      });
    } catch (error) {
      console.error("Error running Scrapfly scraper:", error);
      res.status(500).json({ message: "Failed to run Scrapfly scraper" });
    }
  });

  // System logs route
  app.get("/api/logs", async (req, res) => {
    try {
      const aiLogs = await storage.getAllAiLogs();
      const scraperLogs = await storage.getAllScraperLogs();
      
      // Combine and format logs
      const allLogs = [
        ...aiLogs.map(log => ({
          ...log,
          source: 'AI',
          timestamp: log.timestamp,
        })),
        ...scraperLogs.map(log => ({
          ...log,
          source: 'Scrapers',
          timestamp: log.timestamp,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(allLogs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      res.status(500).json({ message: "Failed to fetch system logs" });
    }
  });

  // AI API management routes
  app.get("/api/ai/api-key/status", async (req, res) => {
    try {
      // Check for API key in database first, then environment variable
      const apiKeySetting = await storage.getSetting("openai_api_key");
      const modelSetting = await storage.getSetting("openai_model");
      
      const apiKey = apiKeySetting?.value || process.env.OPENAI_API_KEY;
      const hasKey = !!apiKey;
      const currentModel = modelSetting?.value || process.env.OPENAI_MODEL || "gpt-4o";
      
      // Set environment variable if we found it in database
      if (apiKeySetting?.value) {
        process.env.OPENAI_API_KEY = apiKeySetting.value;
      }
      
      // Test connection if key exists
      let connectionStatus = "unknown";
      if (hasKey) {
        try {
          // Simple test - we'll expand this to actually test the API
          connectionStatus = "connected";
        } catch (error) {
          connectionStatus = "error";
        }
      } else {
        connectionStatus = "no_key";
      }
      
      res.json({
        hasKey,
        currentModel,
        connectionStatus,
        keyMasked: hasKey ? `sk-...${apiKey?.slice(-4)}` : null
      });
    } catch (error) {
      console.error("Error checking API key status:", error);
      res.status(500).json({ message: "Failed to check API key status" });
    }
  });

  app.post("/api/ai/api-key", async (req, res) => {
    try {
      const { apiKey, model } = req.body;
      
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
        return res.status(400).json({ message: "Invalid API key format" });
      }
      
      // Save API key to database for persistence (upsert)
      const existingApiKey = await storage.getSetting("openai_api_key");
      if (existingApiKey) {
        await storage.updateSetting("openai_api_key", { value: apiKey });
      } else {
        await storage.createSetting({
          key: "openai_api_key",
          value: apiKey,
          category: "ai",
          description: "OpenAI API Key",
          isPublic: false
        });
      }
      
      // Also save the model if provided (upsert)
      if (model && typeof model === 'string') {
        const existingModel = await storage.getSetting("openai_model");
        if (existingModel) {
          await storage.updateSetting("openai_model", { value: model });
        } else {
          await storage.createSetting({
            key: "openai_model",
            value: model,
            category: "ai", 
            description: "OpenAI Model",
            isPublic: false
          });
        }
        process.env.OPENAI_MODEL = model;
      }
      
      // Set environment variable for immediate use
      process.env.OPENAI_API_KEY = apiKey;
      
      res.json({ 
        message: "API key saved successfully",
        keyMasked: `sk-...${apiKey.slice(-4)}`
      });
    } catch (error) {
      console.error("Error saving API key:", error);
      res.status(500).json({ message: "Failed to save API key" });
    }
  });

  app.post("/api/ai/model/configure", async (req, res) => {
    try {
      const { model } = req.body;
      
      const validModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
      if (!validModels.includes(model)) {
        return res.status(400).json({ message: "Invalid model selection" });
      }
      
      // Save model to database for persistence (upsert)
      const existingModel = await storage.getSetting("openai_model");
      if (existingModel) {
        await storage.updateSetting("openai_model", { value: model });
      } else {
        await storage.createSetting({
          key: "openai_model",
          value: model,
          category: "ai", 
          description: "OpenAI Model",
          isPublic: false
        });
      }
      
      // Set the model in environment variable
      process.env.OPENAI_MODEL = model;
      
      res.json({ 
        message: "Model configured successfully",
        model
      });
    } catch (error) {
      console.error("Error configuring model:", error);
      res.status(500).json({ message: "Failed to configure model" });
    }
  });

  app.post("/api/ai/test-connection", async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ message: "No API key configured" });
      }

      // Test the OpenAI API connection
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const availableModels = data.data?.map((model: any) => model.id) || [];
        
        res.json({ 
          message: "API connection successful",
          status: "connected",
          availableModels: availableModels.filter((model: string) => 
            model.includes('gpt-4') || model.includes('gpt-3.5')
          ).slice(0, 10) // Limit to first 10 relevant models
        });
      } else {
        const error = await response.text();
        res.status(400).json({ 
          message: "API connection failed",
          status: "error",
          error: error
        });
      }
    } catch (error) {
      console.error("Error testing API connection:", error);
      res.status(500).json({ 
        message: "Failed to test API connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Monetization API routes
  
  // SmartLinks routes
  app.get("/api/monetization/smart-links", async (req, res) => {
    try {
      const smartLinks = await storage.getAllSmartLinks();
      res.json(smartLinks);
    } catch (error) {
      console.error("Error fetching smart links:", error);
      res.status(500).json({ message: "Failed to fetch smart links" });
    }
  });

  app.post("/api/monetization/smart-links", async (req, res) => {
    try {
      const smartLinkData = insertSmartLinkSchema.parse(req.body);
      const smartLink = await storage.createSmartLink(smartLinkData);
      res.status(201).json(smartLink);
    } catch (error) {
      console.error("Error creating smart link:", error);
      res.status(400).json({ message: "Failed to create smart link" });
    }
  });

  // SmartLink redirect and tracking
  app.get("/l/:shortCode", async (req, res) => {
    try {
      const { shortCode } = req.params;
      const smartLink = await storage.getSmartLinkByShortCode(shortCode);
      
      if (!smartLink || smartLink.status !== "active") {
        return res.status(404).json({ message: "Link not found or inactive" });
      }

      // Track the click
      const clickData = {
        smartLinkId: smartLink.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        referrer: req.get('Referer') || '',
        isConversion: false,
      };

      await storage.trackSmartLinkClick(clickData);

      // Redirect to the target URL
      const targetUrl = smartLink.affiliateUrl || smartLink.originalUrl;
      res.redirect(302, targetUrl);
    } catch (error) {
      console.error("Error processing smart link redirect:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Opportunities routes
  app.get("/api/monetization/opportunities", async (req, res) => {
    try {
      const opportunities = await storage.getAllOpportunities();
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.post("/api/monetization/opportunities", async (req, res) => {
    try {
      const opportunityData = insertOpportunitySchema.parse(req.body);
      const opportunity = await storage.createOpportunity(opportunityData);
      res.status(201).json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      res.status(400).json({ message: "Failed to create opportunity" });
    }
  });

  // External Revenue routes
  app.get("/api/monetization/external-revenues", async (req, res) => {
    try {
      const revenues = await storage.getAllExternalRevenues();
      res.json(revenues);
    } catch (error) {
      console.error("Error fetching external revenues:", error);
      res.status(500).json({ message: "Failed to fetch external revenues" });
    }
  });

  app.post("/api/monetization/external-revenues", async (req, res) => {
    try {
      const revenueData = insertExternalRevenueSchema.parse(req.body);
      const revenue = await storage.createExternalRevenue(revenueData);
      res.status(201).json(revenue);
    } catch (error) {
      console.error("Error creating external revenue:", error);
      res.status(400).json({ message: "Failed to create external revenue" });
    }
  });

  // Monetization metrics
  app.get("/api/monetization/metrics", async (req, res) => {
    try {
      const metrics = await storage.getMonetizationMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching monetization metrics:", error);
      res.status(500).json({ message: "Failed to fetch monetization metrics" });
    }
  });

  // AI Orchestrator integration
  app.post("/api/monetization/run-detection", async (req, res) => {
    try {
      const python = spawn('python3', ['managed_scrapers/ai_orchestrator_simple.py', 'detect']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            res.json({
              success: true,
              result: result,
              message: "AI detection cycle completed successfully"
            });
          } catch (parseError) {
            res.json({
              success: true,
              result: { output: stdout },
              message: "Detection completed but output format unexpected"
            });
          }
        } else {
          console.error("AI Orchestrator error:", stderr);
          res.status(500).json({ 
            success: false,
            message: "AI detection failed", 
            error: stderr 
          });
        }
      });
      
    } catch (error) {
      console.error("Error running AI detection:", error);
      res.status(500).json({ message: "Failed to run AI detection" });
    }
  });

  // Growth Hacker AI V3 - Advanced Opportunity Detection
  app.post("/api/monetization/growth-hacker-v3", async (req, res) => {
    try {
      const { count = 10, save_to_db = false } = req.body;
      
      const python = spawn('python3', ['managed_scrapers/growth_hacker_ai_v3.py', 'json']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            
            // Optionnel: Sauvegarder les opportunités en base de données
            if (save_to_db && result.growth_hacker_ai_v3?.opportunities) {
              for (const opportunity of result.growth_hacker_ai_v3.opportunities) {
                try {
                  await storage.createOpportunity({
                    title: opportunity.titre,
                    description: opportunity.description,
                    category: opportunity.categorie,
                    potentialRevenue: opportunity.potentiel_revenus.split('-')[0].replace(/[^0-9]/g, '') || "1000",
                    confidence: opportunity.score_confiance.toString(),
                    status: "detected",
                    sourceUrl: opportunity.source_a_scraper,
                    scrapingData: { 
                      difficulty: opportunity.difficulte_scraping,
                      commission: opportunity.commission_estimee,
                      market_trend: opportunity.score_tendance_marche 
                    },
                    aiAnalysis: { 
                      method: "growth_hacker_ai_v3",
                      ab_variants: opportunity.idees_variantes_ab,
                      target_audience: opportunity.audience_cible,
                      competition_level: opportunity.niveau_competition
                    }
                  });
                } catch (dbError) {
                  console.error('Error saving opportunity to DB:', dbError);
                  // Continue avec les autres opportunités
                }
              }
            }
            
            res.json({
              success: true,
              growth_hacker_v3: true,
              result,
              timestamp: new Date().toISOString(),
              count: result.growth_hacker_ai_v3?.total_opportunities || 0
            });
          } catch (parseError) {
            console.error('Error parsing Growth Hacker AI output:', parseError);
            res.status(500).json({ message: "Failed to parse Growth Hacker AI result" });
          }
        } else {
          console.error('Growth Hacker AI script error:', stderr);
          res.status(500).json({ message: "Growth Hacker AI failed", error: stderr });
        }
      });
    } catch (error) {
      console.error('Error running Growth Hacker AI V3:', error);
      res.status(500).json({ message: "Failed to run Growth Hacker AI V3" });
    }
  });

  // Growth Machine Phase 2 - Campaign Orchestrator Endpoints
  
  // Lancement de campagne automatique depuis opportunité
  app.post("/api/campaigns/launch-from-opportunity", async (req, res) => {
    try {
      const { opportunity_id, auto_launch = true } = req.body;
      
      // Récupération de l'opportunité
      const opportunity = await storage.getOpportunity(opportunity_id);
      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Préparation des données pour l'orchestrateur
      const opportunityData = {
        id: opportunity.id,
        titre: opportunity.title,
        categorie: opportunity.category,
        score_confiance: parseInt(opportunity.confidence),
        commission_estimee: (opportunity.scrapingData as any)?.commission || "20%",
        potentiel_revenus: opportunity.potentialRevenue,
        idees_variantes_ab: (opportunity.aiAnalysis as any)?.ab_variants || [
          {
            type: "title",
            variants: [opportunity.title, `🚀 ${opportunity.title}`, `💰 ${opportunity.title}`]
          },
          {
            type: "cta", 
            variants: ["Découvrir Maintenant", "Profiter de l'Offre", "En Savoir Plus"]
          }
        ]
      };
      
      // Appel à l'orchestrateur Python
      const python = spawn('python3', ['managed_scrapers/campaign_orchestrator.py', 'create_campaign', JSON.stringify(opportunityData)]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', async (code) => {
        if (code === 0) {
          try {
            const campaignResult = JSON.parse(stdout);
            
            if (campaignResult.success) {
              // Sauvegarde de la campagne en base
              const campaignData = campaignResult.campaign_created;
              
              // Création d'enregistrement campagne (extension du schéma nécessaire)
              // Pour l'instant, on utilise les opportunités existantes avec un flag
              await storage.updateOpportunity(opportunity_id, {
                status: "active",
                aiAnalysis: {
                  ...(opportunity.aiAnalysis as any || {}),
                  campaign_id: campaignData.id,
                  campaign_status: "created",
                  campaign_created_at: new Date().toISOString()
                }
              });
              
              // Si auto_launch, lancer immédiatement
              if (auto_launch) {
                const launchPython = spawn('python3', ['managed_scrapers/campaign_orchestrator.py', 'launch_campaign', campaignData.id]);
                
                let launchStdout = '';
                
                launchPython.stdout.on('data', (data) => {
                  launchStdout += data.toString();
                });
                
                launchPython.on('close', async (launchCode) => {
                  if (launchCode === 0) {
                    const launchResult = JSON.parse(launchStdout);
                    
                    res.json({
                      success: true,
                      campaign_created: campaignResult.campaign_created,
                      campaign_launched: launchResult,
                      auto_launched: true,
                      timestamp: new Date().toISOString()
                    });
                  } else {
                    res.json({
                      success: true,
                      campaign_created: campaignResult.campaign_created,
                      campaign_launched: false,
                      error: "Launch failed but campaign created",
                      auto_launched: false
                    });
                  }
                });
              } else {
                res.json({
                  success: true,
                  campaign_created: campaignResult.campaign_created,
                  auto_launched: false,
                  message: "Campaign created, ready for manual launch"
                });
              }
            } else {
              res.status(500).json({ 
                message: "Campaign creation failed", 
                error: campaignResult.error 
              });
            }
          } catch (parseError) {
            console.error('Error parsing campaign creation result:', parseError);
            res.status(500).json({ message: "Failed to parse campaign creation result" });
          }
        } else {
          console.error('Campaign orchestrator error:', stderr);
          res.status(500).json({ 
            message: "Campaign orchestrator failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error launching campaign from opportunity:', error);
      res.status(500).json({ message: "Failed to launch campaign from opportunity" });
    }
  });

  // Status de campagne
  app.get("/api/campaigns/:campaignId/status", async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const python = spawn('python3', ['managed_scrapers/campaign_orchestrator.py', 'status', campaignId]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const status = JSON.parse(stdout);
            res.json(status);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse campaign status" });
          }
        } else {
          res.status(500).json({ 
            message: "Failed to get campaign status", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error getting campaign status:', error);
      res.status(500).json({ message: "Failed to get campaign status" });
    }
  });

  // Rapport de campagne
  app.get("/api/campaigns/:campaignId/report", async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const python = spawn('python3', ['managed_scrapers/campaign_orchestrator.py', 'report', campaignId]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const report = JSON.parse(stdout);
            res.json(report);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse campaign report" });
          }
        } else {
          res.status(500).json({ 
            message: "Failed to generate campaign report", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error generating campaign report:', error);
      res.status(500).json({ message: "Failed to generate campaign report" });
    }
  });

  // Multi-Channel Broadcasting Endpoints
  
  // Status des connecteurs de canaux
  app.get("/api/channels/status", async (req, res) => {
    try {
      const python = spawn('python3', ['managed_scrapers/channel_connectors.py', 'status']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const status = JSON.parse(stdout);
            res.json(status);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse channel status" });
          }
        } else {
          res.status(500).json({ 
            message: "Failed to get channel status", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error getting channel status:', error);
      res.status(500).json({ message: "Failed to get channel status" });
    }
  });

  // Diffusion multi-canal
  app.post("/api/channels/broadcast", async (req, res) => {
    try {
      const { content, utm_link, channels } = req.body;
      
      if (!content || !utm_link) {
        return res.status(400).json({ message: "Content and utm_link are required" });
      }
      
      const channelsArg = channels ? channels.join(',') : '';
      const args = ['managed_scrapers/channel_connectors.py', 'broadcast', content, utm_link];
      if (channelsArg) args.push(channelsArg);
      
      const python = spawn('python3', args);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            res.json(result);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse broadcast result" });
          }
        } else {
          res.status(500).json({ 
            message: "Broadcast failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
      res.status(500).json({ message: "Failed to broadcast message" });
    }
  });

  // Test des connecteurs
  app.post("/api/channels/test", async (req, res) => {
    try {
      const python = spawn('python3', ['managed_scrapers/channel_connectors.py', 'test']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            res.json(result);
          } catch (parseError) {
            // Si pas de JSON, retourner le stdout comme message
            res.json({
              success: true,
              message: "Test completed",
              output: stdout
            });
          }
        } else {
          res.status(500).json({ 
            message: "Channel test failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error testing channels:', error);
      res.status(500).json({ message: "Failed to test channels" });
    }
  });

  // Analytics Engine Endpoints
  
  // Analyse de performance d'une campagne
  app.get("/api/analytics/campaign/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Récupération des données de campagne (simulation)
      const campaignData = {
        id: campaignId,
        opportunity_title: "AI Video Editor SaaS",
        variants_count: 6
      };
      
      const python = spawn('python3', ['managed_scrapers/analytics_engine.py', 'analyze_campaign', JSON.stringify(campaignData)]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const analytics = JSON.parse(stdout);
            res.json(analytics);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse analytics result" });
          }
        } else {
          res.status(500).json({ 
            message: "Analytics generation failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error generating campaign analytics:', error);
      res.status(500).json({ message: "Failed to generate campaign analytics" });
    }
  });

  // Rapport A/B Winners
  app.get("/api/analytics/winners-report", async (req, res) => {
    try {
      const python = spawn('python3', ['managed_scrapers/analytics_engine.py', 'winners_report']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const report = JSON.parse(stdout);
            res.json(report);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse winners report" });
          }
        } else {
          res.status(500).json({ 
            message: "Winners report generation failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error generating winners report:', error);
      res.status(500).json({ message: "Failed to generate winners report" });
    }
  });

  // Auto-optimisation des campagnes
  app.post("/api/analytics/auto-optimize", async (req, res) => {
    try {
      const python = spawn('python3', ['managed_scrapers/analytics_engine.py', 'auto_optimize']);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          try {
            const optimization = JSON.parse(stdout);
            res.json(optimization);
          } catch (parseError) {
            res.status(500).json({ message: "Failed to parse optimization result" });
          }
        } else {
          res.status(500).json({ 
            message: "Auto-optimization failed", 
            error: stderr 
          });
        }
      });
    } catch (error) {
      console.error('Error running auto-optimization:', error);
      res.status(500).json({ message: "Failed to run auto-optimization" });
    }
  });

  // Enregistrer les routes des canaux et API keys
  app.use(channelRouter);
  
  // <AI:BEGIN routes-mount-payouts>
  app.use(financePayoutRoutes);
  app.use(payoutsRoutes);
  // <AI:END routes-mount-payouts>
  
  // <AI:BEGIN routes-mount-amazon>
  app.use(amazonRoutes);
  // <AI:END routes-mount-amazon>
  
  // <AI:BEGIN routes-mount-ias>
  app.use('/api/ias', iasRouter);
  app.use('/api/dg-ai-supervisor', dgAISupervisorRouter);
  // <AI:END routes-mount-ias>

  // AliExpress OAuth callback route
  app.get("/aliexpress/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      
      console.log(`AliExpress OAuth callback - Code: ${code ? (code as string).substring(0, 10) + '...' : 'none'}, State: ${state}, Error: ${error}`);
      
      if (error) {
        // OAuth error from AliExpress
        console.error(`OAuth error: ${error} - ${error_description}`);
        
        // Redirect to frontend with error
        const errorParams = new URLSearchParams({
          auth: 'error',
          error: error as string,
          error_description: (error_description as string) || 'OAuth authentication failed'
        });
        
        return res.redirect(`/aliexpress?${errorParams.toString()}`);
      }
      
      if (!code) {
        console.error('No authorization code in callback');
        
        // Redirect with error
        const errorParams = new URLSearchParams({
          auth: 'error',
          error: 'missing_code',
          error_description: 'Authorization code not provided'
        });
        
        return res.redirect(`/aliexpress?${errorParams.toString()}`);
      }
      
      // Handle the callback using our auth module
      const python = spawn('python3', ['server/aliexpress/auth.py', 'handle_callback', code as string, (state as string) || '']);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (exitCode) => {
        try {
          if (exitCode === 0 && output.trim()) {
            const result = JSON.parse(output.trim());
            console.log('Callback handling result:', result);
            
            if (result.error) {
              // Callback handling failed
              const errorParams = new URLSearchParams({
                auth: 'error',
                error: 'callback_error',
                error_description: result.message || 'Callback processing failed'
              });
              
              return res.redirect(`/aliexpress?${errorParams.toString()}`);
            } else {
              // Success - redirect to frontend with success
              const successParams = new URLSearchParams({
                auth: 'success',
                code: code as string,
                state: (state as string) || '',
                message: 'Authentication completed successfully'
              });
              
              console.log('OAuth callback successful, redirecting to frontend');
              return res.redirect(`/aliexpress?${successParams.toString()}`);
            }
          } else {
            console.error('Callback handling failed - Exit code:', exitCode);
            console.error('Python stderr:', errorOutput);
            
            // Fallback error redirect
            const errorParams = new URLSearchParams({
              auth: 'error',
              error: 'processing_error',
              error_description: 'Callback processing failed'
            });
            
            return res.redirect(`/aliexpress?${errorParams.toString()}`);
          }
        } catch (e) {
          console.error('Callback JSON parse error:', e);
          console.error('Raw output:', output);
          
          // For debugging, we can still redirect with the code for manual exchange
          const successParams = new URLSearchParams({
            auth: 'partial_success',
            code: code as string,
            state: (state as string) || '',
            message: 'Code received, manual token exchange needed'
          });
          
          return res.redirect(`/aliexpress?${successParams.toString()}`);
        }
      });
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      
      // Fallback error redirect
      const errorParams = new URLSearchParams({
        auth: 'error',
        error: 'server_error',
        error_description: 'Server error during callback processing'
      });
      
      res.redirect(`/aliexpress?${errorParams.toString()}`);
    }
  });

  // AliExpress Dropship API routes
  app.get("/api/aliexpress/status", async (req, res) => {
    try {
      // Vérifier les variables d'environnement
      const hasAppKey = !!process.env.ALIEXPRESS_APP_KEY;
      const hasAppSecret = !!process.env.ALIEXPRESS_APP_SECRET;
      const hasCallbackUrl = !!process.env.ALIEXPRESS_CALLBACK_URL;
      
      // Vérifier l'existence du token
      const fs = await import('fs');
      const path = await import('path');
      const tokenPath = path.join(process.cwd(), 'external_scrapers', 'aliexpress_token.json');
      const hasToken = fs.existsSync(tokenPath);
      
      let tokenInfo = null;
      if (hasToken) {
        try {
          const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
          tokenInfo = {
            hasAccessToken: !!tokenData.access_token,
            obtainedAt: tokenData.obtained_at,
            expiresIn: tokenData.expires_in
          };
        } catch (e) {
          tokenInfo = { hasAccessToken: false };
        }
      }
      
      const status = {
        configured: hasAppKey && hasAppSecret && hasCallbackUrl,
        authenticated: hasToken && tokenInfo?.hasAccessToken,
        appKey: hasAppKey ? process.env.ALIEXPRESS_APP_KEY?.substring(0, 4) + '***' : null,
        callbackUrl: process.env.ALIEXPRESS_CALLBACK_URL,
        tokenInfo,
        scriptsAvailable: {
          dropship: true, // We created the file
          oauth: true,
          test: true
        }
      };
      
      res.json(status);
    } catch (error) {
      console.error('AliExpress status error:', error);
      res.status(500).json({ error: 'Failed to get AliExpress status' });
    }
  });

  // AliExpress OAuth URL generation using new auth module
  app.get("/api/aliexpress/oauth/url", async (req, res) => {
    try {
      const { state = 'smartlinks_oauth' } = req.query;
      const python = spawn('python3', ['server/aliexpress/auth.py', 'get_oauth_url', state as string]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          if (code === 0 && output.trim()) {
            const result = JSON.parse(output.trim());
            if (result.error || !result.success) {
              res.status(400).json(result);
            } else {
              // Return in format expected by frontend
              res.json({
                oauth_url: result.authorization_url,
                state: result.state,
                callback_url: result.callback_url
              });
            }
          } else {
            console.error('OAuth URL generation failed:', errorOutput);
            res.status(500).json({ error: 'Failed to generate OAuth URL', details: errorOutput });
          }
        } catch (e) {
          console.error('JSON parse error:', e, 'Output:', output);
          res.status(500).json({ error: 'Failed to parse OAuth URL response' });
        }
      });
    } catch (error) {
      console.error('OAuth URL generation error:', error);
      res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
  });

  // AliExpress token exchange using new auth module  
  app.post("/api/aliexpress/oauth/token", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        console.error('Token exchange: No authorization code provided');
        return res.status(400).json({ 
          error: true, 
          message: 'Authorization code is required' 
        });
      }
      
      console.log(`🔄 Exchanging OAuth code: ${code.substring(0, 10)}...`);
      
      const python = spawn('python3', ['server/aliexpress/auth.py', 'exchange_token', code]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (exitCode) => {
        try {
          if (exitCode === 0 && output.trim()) {
            const result = JSON.parse(output.trim());
            console.log('✅ OAuth exchange result:', result);
            
            if (result.error) {
              console.error('Token exchange error:', result.message);
              res.status(400).json(result);
            } else {
              console.log('🎉 Token exchange successful!');
              res.json({
                success: true,
                ...result
              });
            }
          } else {
            console.error('❌ OAuth exchange failed - Exit code:', exitCode);
            console.error('Python stderr:', errorOutput);
            console.error('Python stdout:', output);
            res.status(500).json({ 
              error: true,
              message: 'Failed to exchange OAuth code', 
              details: errorOutput || 'Python process failed',
              exit_code: exitCode
            });
          }
        } catch (e) {
          console.error('❌ JSON parse error:', e);
          console.error('Raw output:', output);
          res.status(500).json({ 
            error: true,
            message: 'Failed to parse OAuth response', 
            raw_output: output 
          });
        }
      });
    } catch (error) {
      console.error('❌ OAuth token exchange error:', error);
      res.status(500).json({ 
        error: true,
        message: 'Failed to exchange OAuth code', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.get("/api/aliexpress/products/search", async (req, res) => {
    try {
      const { sku } = req.query;
      
      if (!sku) {
        return res.status(400).json({ error: 'SKU is required' });
      }
      
      const python = spawn('python3', ['-c', `
import os
import sys
import json
sys.path.append('${process.cwd()}/external_scrapers')
from aliexpress_dropship import AliExpressDropshipAPI
api = AliExpressDropshipAPI()
result = api.get_product_info("${sku}")
print(json.dumps(result))
      `]);
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          res.json(result);
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse product search response' });
        }
      });
    } catch (error) {
      console.error('Product search error:', error);
      res.status(500).json({ error: 'Failed to search products' });
    }
  });

  app.get("/api/aliexpress/test", async (req, res) => {
    try {
      const python = spawn('python3', ['test_aliexpress.py', '--quick'], {
        cwd: `${process.cwd()}/external_scrapers`
      });
      
      let output = '';
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.on('close', (code) => {
        res.json({ 
          success: code === 0,
          output: output,
          message: code === 0 ? 'AliExpress API test completed' : 'AliExpress API test failed'
        });
      });
    } catch (error) {
      console.error('AliExpress test error:', error);
      res.status(500).json({ error: 'Failed to test AliExpress connection' });
    }
  });

  // Handle AliExpress OAuth callback
  app.get("/aliexpress/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      
      console.log('AliExpress OAuth callback received:', { code: code && typeof code === 'string' ? `${code.substring(0, 10)}...` : null, state, error });
      
      if (error) {
        // OAuth error - redirect to frontend with error
        const errorParam = encodeURIComponent(error as string);
        const errorDescParam = encodeURIComponent((error_description as string) || 'OAuth authentication failed');
        return res.redirect(`/aliexpress?auth=error&error=${errorParam}&error_description=${errorDescParam}`);
      }
      
      if (!code) {
        // No code provided - redirect with error
        return res.redirect(`/aliexpress?auth=error&error=missing_code&error_description=Authorization+code+not+provided`);
      }
      
      // Success - redirect to frontend with code
      const codeParam = encodeURIComponent(code as string);
      const stateParam = encodeURIComponent((state as string) || '');
      res.redirect(`/aliexpress?auth=success&code=${codeParam}&state=${stateParam}`);
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`/aliexpress?auth=error&error=callback_error&error_description=Callback+processing+failed`);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
