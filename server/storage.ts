import {
  users,
  transactions,
  invoices,
  aiModels,
  aiInferences,
  aiLogs,
  scrapers,
  scraperLogs,
  settings,
  smartLinks,
  smartLinkClicks,
  opportunities,
  externalRevenues,
  apiKeys,
  campaigns,
  campaignAnalytics,
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Invoice,
  type InsertInvoice,
  type AiModel,
  type InsertAiModel,
  type AiInference,
  type InsertAiInference,
  type AiLog,
  type InsertAiLog,
  type Scraper,
  type InsertScraper,
  type ScraperLog,
  type InsertScraperLog,
  type Setting,
  type InsertSetting,
  type SmartLink,
  type InsertSmartLink,
  type SmartLinkClick,
  type InsertSmartLinkClick,
  type Opportunity,
  type InsertOpportunity,
  type ExternalRevenue,
  type InsertExternalRevenue,
  type ApiKey,
  type InsertApiKey,
  type Campaign,
  type InsertCampaign,
  type CampaignAnalytics,
  type InsertCampaignAnalytics,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, like, count } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;

  // Invoice operations
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByUser(userId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // AI Model operations
  getAiModel(id: string): Promise<AiModel | undefined>;
  getAllAiModels(): Promise<AiModel[]>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateAiModel(id: string, model: Partial<InsertAiModel>): Promise<AiModel | undefined>;
  deleteAiModel(id: string): Promise<boolean>;

  // AI Inference operations
  getAllAiInferences(): Promise<AiInference[]>;
  createAiInference(inference: InsertAiInference): Promise<AiInference>;

  // AI Log operations
  getAllAiLogs(): Promise<AiLog[]>;
  createAiLog(log: InsertAiLog): Promise<AiLog>;

  // Scraper operations
  getScraper(id: string): Promise<Scraper | undefined>;
  getAllScrapers(): Promise<Scraper[]>;
  createScraper(scraper: InsertScraper): Promise<Scraper>;
  updateScraper(id: string, scraper: Partial<InsertScraper>): Promise<Scraper | undefined>;
  deleteScraper(id: string): Promise<boolean>;

  // Scraper Log operations
  getScraperLogs(scraperId: string): Promise<ScraperLog[]>;
  getAllScraperLogs(): Promise<ScraperLog[]>;
  createScraperLog(log: InsertScraperLog): Promise<ScraperLog>;

  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  getSettingsByCategory(category: string): Promise<Setting[]>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, setting: Partial<InsertSetting>): Promise<Setting | undefined>;
  deleteSetting(key: string): Promise<boolean>;

  // SmartLink operations
  getSmartLink(id: string): Promise<SmartLink | undefined>;
  getAllSmartLinks(): Promise<SmartLink[]>;
  getSmartLinksByUser(userId: string): Promise<SmartLink[]>;
  createSmartLink(smartLink: InsertSmartLink): Promise<SmartLink>;
  updateSmartLink(id: string, smartLink: Partial<InsertSmartLink>): Promise<SmartLink | undefined>;
  deleteSmartLink(id: string): Promise<boolean>;
  getSmartLinkByShortCode(shortCode: string): Promise<SmartLink | undefined>;

  // SmartLink Click operations  
  trackSmartLinkClick(click: InsertSmartLinkClick): Promise<SmartLinkClick>;
  getSmartLinkClicks(smartLinkId: string): Promise<SmartLinkClick[]>;
  getAllSmartLinkClicks(): Promise<SmartLinkClick[]>;

  // Opportunity operations
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getAllOpportunities(): Promise<Opportunity[]>;
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  updateOpportunity(id: string, opportunity: Partial<InsertOpportunity>): Promise<Opportunity | undefined>;
  deleteOpportunity(id: string): Promise<boolean>;

  // External Revenue operations
  getAllExternalRevenues(): Promise<ExternalRevenue[]>;
  createExternalRevenue(revenue: InsertExternalRevenue): Promise<ExternalRevenue>;
  getExternalRevenuesByProvider(provider: string): Promise<ExternalRevenue[]>;

  // API Key operations
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeysByChannel(channelType: string): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, apiKey: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  testApiKeyConnection(id: string): Promise<{ success: boolean; message: string }>;

  // Campaign operations
  getCampaign(id: string): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  getCampaignsByOpportunity(opportunityId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Campaign Analytics operations
  getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics[]>;
  createCampaignAnalytics(analytics: InsertCampaignAnalytics): Promise<CampaignAnalytics>;
  getAnalyticsByChannel(channel: string): Promise<CampaignAnalytics[]>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<any>;
  getMonetizationMetrics(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.passwordHash, 10);
    const [user] = await db
      .insert(users)
      .values({ ...userData, passwordHash: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { ...userData };
    if (updateData.passwordHash) {
      updateData.passwordHash = await bcrypt.hash(updateData.passwordHash, 10);
    }
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.fullName));
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async updateTransaction(id: string, transactionData: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set(transactionData)
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Invoice operations
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoicesByUser(userId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();
    return invoice;
  }

  async updateInvoice(id: string, invoiceData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db
      .update(invoices)
      .set(invoiceData)
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // AI Model operations
  async getAiModel(id: string): Promise<AiModel | undefined> {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id));
    return model;
  }

  async getAllAiModels(): Promise<AiModel[]> {
    return await db.select().from(aiModels).orderBy(asc(aiModels.name));
  }

  async createAiModel(modelData: InsertAiModel): Promise<AiModel> {
    const [model] = await db
      .insert(aiModels)
      .values(modelData)
      .returning();
    return model;
  }

  async updateAiModel(id: string, modelData: Partial<InsertAiModel>): Promise<AiModel | undefined> {
    const [model] = await db
      .update(aiModels)
      .set(modelData)
      .where(eq(aiModels.id, id))
      .returning();
    return model;
  }

  async deleteAiModel(id: string): Promise<boolean> {
    const result = await db.delete(aiModels).where(eq(aiModels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // AI Inference operations
  async getAllAiInferences(): Promise<AiInference[]> {
    return await db.select().from(aiInferences).orderBy(desc(aiInferences.createdAt)).limit(100);
  }

  async createAiInference(inferenceData: InsertAiInference): Promise<AiInference> {
    const [inference] = await db
      .insert(aiInferences)
      .values(inferenceData)
      .returning();
    return inference;
  }

  // AI Log operations
  async getAllAiLogs(): Promise<AiLog[]> {
    return await db.select().from(aiLogs).orderBy(desc(aiLogs.timestamp)).limit(500);
  }

  async createAiLog(logData: InsertAiLog): Promise<AiLog> {
    const [log] = await db
      .insert(aiLogs)
      .values(logData)
      .returning();
    return log;
  }

  // Scraper operations
  async getScraper(id: string): Promise<Scraper | undefined> {
    const [scraper] = await db.select().from(scrapers).where(eq(scrapers.id, id));
    return scraper;
  }

  async getAllScrapers(): Promise<Scraper[]> {
    return await db.select().from(scrapers).orderBy(asc(scrapers.name));
  }

  async createScraper(scraperData: InsertScraper): Promise<Scraper> {
    const [scraper] = await db
      .insert(scrapers)
      .values(scraperData)
      .returning();
    return scraper;
  }

  async updateScraper(id: string, scraperData: Partial<InsertScraper>): Promise<Scraper | undefined> {
    const [scraper] = await db
      .update(scrapers)
      .set(scraperData)
      .where(eq(scrapers.id, id))
      .returning();
    return scraper;
  }

  async deleteScraper(id: string): Promise<boolean> {
    const result = await db.delete(scrapers).where(eq(scrapers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Scraper Log operations
  async getScraperLogs(scraperId: string): Promise<ScraperLog[]> {
    return await db
      .select()
      .from(scraperLogs)
      .where(eq(scraperLogs.scraperId, scraperId))
      .orderBy(desc(scraperLogs.timestamp));
  }

  async getAllScraperLogs(): Promise<ScraperLog[]> {
    return await db.select().from(scraperLogs).orderBy(desc(scraperLogs.timestamp)).limit(500);
  }

  async createScraperLog(logData: InsertScraperLog): Promise<ScraperLog> {
    const [log] = await db
      .insert(scraperLogs)
      .values(logData)
      .returning();
    return log;
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings).orderBy(asc(settings.category), asc(settings.key));
  }

  async getSettingsByCategory(category: string): Promise<Setting[]> {
    return await db
      .select()
      .from(settings)
      .where(eq(settings.category, category))
      .orderBy(asc(settings.key));
  }

  async createSetting(settingData: InsertSetting): Promise<Setting> {
    const [setting] = await db
      .insert(settings)
      .values(settingData)
      .returning();
    return setting;
  }

  async updateSetting(key: string, settingData: Partial<InsertSetting>): Promise<Setting | undefined> {
    const [setting] = await db
      .update(settings)
      .set(settingData)
      .where(eq(settings.key, key))
      .returning();
    return setting;
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await db.delete(settings).where(eq(settings.key, key));
    return (result.rowCount ?? 0) > 0;
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<any> {
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalTransactions] = await db.select({ count: count() }).from(transactions);
    const [totalInvoices] = await db.select({ count: count() }).from(invoices);
    const [totalScrapers] = await db.select({ count: count() }).from(scrapers);
    const [activeScrapers] = await db.select({ count: count() }).from(scrapers).where(eq(scrapers.isActive, true));
    const [pendingInvoices] = await db.select({ count: count() }).from(invoices).where(eq(invoices.status, "pending"));

    // Calculate revenue
    const incomeTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.transactionType, "income"), eq(transactions.status, "completed")));
    
    const expenseTransactions = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.transactionType, "expense"), eq(transactions.status, "completed")));

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      totalUsers: totalUsers.count,
      totalRevenue: totalIncome,
      netProfit: totalIncome - totalExpenses,
      activeScrapers: activeScrapers.count,
      pendingInvoices: pendingInvoices.count,
      totalTransactions: totalTransactions.count,
      totalInvoices: totalInvoices.count,
      totalScrapers: totalScrapers.count,
    };
  }

  // SmartLink operations
  async getSmartLink(id: string): Promise<SmartLink | undefined> {
    const [smartLink] = await db.select().from(smartLinks).where(eq(smartLinks.id, id));
    return smartLink;
  }

  async getAllSmartLinks(): Promise<SmartLink[]> {
    return await db.select().from(smartLinks).orderBy(desc(smartLinks.createdAt));
  }

  async getSmartLinksByUser(userId: string): Promise<SmartLink[]> {
    return await db
      .select()
      .from(smartLinks)
      .where(eq(smartLinks.userId, userId))
      .orderBy(desc(smartLinks.createdAt));
  }

  async createSmartLink(smartLinkData: InsertSmartLink): Promise<SmartLink> {
    const [smartLink] = await db
      .insert(smartLinks)
      .values(smartLinkData)
      .returning();
    return smartLink;
  }

  async updateSmartLink(id: string, smartLinkData: Partial<InsertSmartLink>): Promise<SmartLink | undefined> {
    const [smartLink] = await db
      .update(smartLinks)
      .set(smartLinkData)
      .where(eq(smartLinks.id, id))
      .returning();
    return smartLink;
  }

  async deleteSmartLink(id: string): Promise<boolean> {
    const result = await db.delete(smartLinks).where(eq(smartLinks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSmartLinkByShortCode(shortCode: string): Promise<SmartLink | undefined> {
    const [smartLink] = await db.select().from(smartLinks).where(eq(smartLinks.shortCode, shortCode));
    return smartLink;
  }

  // SmartLink Click operations
  async trackSmartLinkClick(clickData: InsertSmartLinkClick): Promise<SmartLinkClick> {
    const [click] = await db
      .insert(smartLinkClicks)
      .values(clickData)
      .returning();
    return click;
  }

  async getSmartLinkClicks(smartLinkId: string): Promise<SmartLinkClick[]> {
    return await db
      .select()
      .from(smartLinkClicks)
      .where(eq(smartLinkClicks.smartLinkId, smartLinkId))
      .orderBy(desc(smartLinkClicks.clickedAt));
  }

  async getAllSmartLinkClicks(): Promise<SmartLinkClick[]> {
    return await db.select().from(smartLinkClicks).orderBy(desc(smartLinkClicks.clickedAt));
  }

  // Opportunity operations
  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    return opportunity;
  }

  async getAllOpportunities(): Promise<Opportunity[]> {
    return await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
  }

  async createOpportunity(opportunityData: InsertOpportunity): Promise<Opportunity> {
    const [opportunity] = await db
      .insert(opportunities)
      .values(opportunityData)
      .returning();
    return opportunity;
  }

  async updateOpportunity(id: string, opportunityData: Partial<InsertOpportunity>): Promise<Opportunity | undefined> {
    const [opportunity] = await db
      .update(opportunities)
      .set(opportunityData)
      .where(eq(opportunities.id, id))
      .returning();
    return opportunity;
  }

  async deleteOpportunity(id: string): Promise<boolean> {
    const result = await db.delete(opportunities).where(eq(opportunities.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // External Revenue operations
  async getAllExternalRevenues(): Promise<ExternalRevenue[]> {
    return await db.select().from(externalRevenues).orderBy(desc(externalRevenues.processedAt));
  }

  async createExternalRevenue(revenueData: InsertExternalRevenue): Promise<ExternalRevenue> {
    const [revenue] = await db
      .insert(externalRevenues)
      .values(revenueData)
      .returning();
    return revenue;
  }

  async getExternalRevenuesByProvider(provider: string): Promise<ExternalRevenue[]> {
    return await db
      .select()
      .from(externalRevenues)
      .where(eq(externalRevenues.provider, provider))
      .orderBy(desc(externalRevenues.processedAt));
  }

  // Monetization metrics
  async getMonetizationMetrics(): Promise<any> {
    const [totalSmartLinks] = await db.select({ count: count() }).from(smartLinks);
    const [activeSmartLinks] = await db.select({ count: count() }).from(smartLinks).where(eq(smartLinks.status, "active"));
    const [totalClicks] = await db.select({ count: count() }).from(smartLinkClicks);
    const [totalConversions] = await db.select({ count: count() }).from(smartLinkClicks).where(eq(smartLinkClicks.isConversion, true));
    const [totalOpportunities] = await db.select({ count: count() }).from(opportunities);
    const [activeOpportunities] = await db.select({ count: count() }).from(opportunities).where(eq(opportunities.status, "active"));

    // Calculate revenue from external sources
    const externalRevenueData = await db.select().from(externalRevenues);
    const totalExternalRevenue = externalRevenueData.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    // Calculate commission revenue from conversions
    const conversionData = await db
      .select()
      .from(smartLinkClicks)
      .where(eq(smartLinkClicks.isConversion, true));
    
    const totalCommissionRevenue = conversionData.reduce((sum, c) => {
      return sum + (c.conversionValue ? parseFloat(c.conversionValue) : 0);
    }, 0);

    // Get top performing SmartLinks
    const topLinks = await db
      .select({
        smartLinkId: smartLinkClicks.smartLinkId,
        clickCount: count(),
      })
      .from(smartLinkClicks)
      .groupBy(smartLinkClicks.smartLinkId)
      .orderBy(desc(count()))
      .limit(5);

    return {
      totalSmartLinks: totalSmartLinks.count,
      activeSmartLinks: activeSmartLinks.count,
      totalClicks: totalClicks.count,
      totalConversions: totalConversions.count,
      conversionRate: totalClicks.count > 0 ? (totalConversions.count / totalClicks.count) * 100 : 0,
      totalExternalRevenue,
      totalCommissionRevenue,
      totalMonetizationRevenue: totalExternalRevenue + totalCommissionRevenue,
      totalOpportunities: totalOpportunities.count,
      activeOpportunities: activeOpportunities.count,
      topPerformingLinks: topLinks,
    };
  }

  // API Key operations
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return apiKey;
  }

  async getApiKeysByChannel(channelType: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.channelType, channelType))
      .orderBy(asc(apiKeys.keyName));
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(asc(apiKeys.channelType), asc(apiKeys.keyName));
  }

  async createApiKey(apiKeyData: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db
      .insert(apiKeys)
      .values({ ...apiKeyData, updatedAt: new Date() })
      .returning();
    return apiKey;
  }

  async updateApiKey(id: string, apiKeyData: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .update(apiKeys)
      .set({ ...apiKeyData, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return apiKey;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async testApiKeyConnection(id: string): Promise<{ success: boolean; message: string }> {
    const apiKey = await this.getApiKey(id);
    if (!apiKey) {
      return { success: false, message: "Clé API non trouvée" };
    }

    try {
      // Simuler le test de connexion selon le type de canal
      switch (apiKey.channelType) {
        case "twitter":
          // Test Twitter API
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulation
          break;
        case "discord":
          // Test Discord API
          await new Promise(resolve => setTimeout(resolve, 300));
          break;
        case "telegram":
          // Test Telegram API
          await new Promise(resolve => setTimeout(resolve, 400));
          break;
        case "email":
          // Test Email service
          await new Promise(resolve => setTimeout(resolve, 200));
          break;
        case "medium":
          // Test Medium API
          await new Promise(resolve => setTimeout(resolve, 600));
          break;
        default:
          return { success: false, message: "Type de canal non supporté" };
      }

      // Mettre à jour le statut de test
      await this.updateApiKey(id, {
        testStatus: "success",
        lastTested: new Date(),
      });

      return { success: true, message: "Connexion réussie" };
    } catch (error) {
      await this.updateApiKey(id, {
        testStatus: "failed",
        lastTested: new Date(),
      });
      return { success: false, message: "Erreur de connexion" };
    }
  }

  // Campaign operations
  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaignsByOpportunity(opportunityId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.opportunityId, opportunityId))
      .orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db
      .insert(campaigns)
      .values({ ...campaignData, updatedAt: new Date() })
      .returning();
    return campaign;
  }

  async updateCampaign(id: string, campaignData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({ ...campaignData, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return campaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Campaign Analytics operations
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics[]> {
    return await db
      .select()
      .from(campaignAnalytics)
      .where(eq(campaignAnalytics.campaignId, campaignId))
      .orderBy(desc(campaignAnalytics.recordedAt));
  }

  async createCampaignAnalytics(analyticsData: InsertCampaignAnalytics): Promise<CampaignAnalytics> {
    const [analytics] = await db
      .insert(campaignAnalytics)
      .values(analyticsData)
      .returning();
    return analytics;
  }

  async getAnalyticsByChannel(channel: string): Promise<CampaignAnalytics[]> {
    return await db
      .select()
      .from(campaignAnalytics)
      .where(eq(campaignAnalytics.channel, channel))
      .orderBy(desc(campaignAnalytics.recordedAt));
  }
}

export const storage = new DatabaseStorage();
