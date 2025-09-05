import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  json,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid", "overdue", "cancelled"]);
export const aiProviderEnum = pgEnum("ai_provider", ["openai", "anthropic", "google"]);
export const aiModelStatusEnum = pgEnum("ai_model_status", ["active", "inactive", "training"]);
export const logLevelEnum = pgEnum("log_level", ["debug", "info", "warning", "error"]);
export const smartLinkStatusEnum = pgEnum("smart_link_status", ["active", "paused", "expired", "disabled"]);
export const opportunityStatusEnum = pgEnum("opportunity_status", ["detected", "analyzing", "active", "completed", "rejected"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  description: text("description").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull().default("pending"),
  dueDate: timestamp("due_date").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Models table
export const aiModels = pgTable("ai_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  status: aiModelStatusEnum("status").notNull().default("inactive"),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }),
  provider: aiProviderEnum("provider").notNull(),
  lastTrained: timestamp("last_trained"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Inferences table
export const aiInferences = pgTable("ai_inferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelName: varchar("model_name", { length: 255 }).notNull(),
  inputText: text("input_text").notNull(),
  outputText: text("output_text").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  cost: decimal("cost", { precision: 8, scale: 5 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Logs table
export const aiLogs = pgTable("ai_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: logLevelEnum("level").notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  modelName: varchar("model_name", { length: 255 }),
});

// Scrapers table
export const scrapers = pgTable("scrapers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  scraperType: varchar("scraper_type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  intervalMinutes: integer("interval_minutes").notNull().default(60),
  priority: integer("priority").notNull().default(1),
  timeoutSeconds: integer("timeout_seconds").notNull().default(30),
  maxRetries: integer("max_retries").notNull().default(3),
  headers: json("headers"),
  selectors: json("selectors"),
  configuration: json("configuration"),
  transformationScript: text("transformation_script"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scraper Logs table
export const scraperLogs = pgTable("scraper_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scraperId: varchar("scraper_id").notNull().references(() => scrapers.id),
  level: logLevelEnum("level").notNull(),
  message: text("message").notNull(),
  entriesFound: integer("entries_found"),
  executionTime: integer("execution_time"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// SmartLinks table - Liens monétisés avec tracking
export const smartLinks = pgTable("smart_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  originalUrl: text("original_url").notNull(),
  shortCode: varchar("short_code", { length: 50 }).notNull().unique(),
  affiliateUrl: text("affiliate_url"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  status: smartLinkStatusEnum("status").notNull().default("active"),
  description: text("description"),
  tags: json("tags"),
  scraperId: varchar("scraper_id").references(() => scrapers.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Tracking des clics sur SmartLinks
export const smartLinkClicks = pgTable("smart_link_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  smartLinkId: varchar("smart_link_id").notNull().references(() => smartLinks.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  country: varchar("country", { length: 2 }),
  city: varchar("city", { length: 100 }),
  isConversion: boolean("is_conversion").default(false),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
});

// Opportunités détectées par l'IA
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  potentialRevenue: decimal("potential_revenue", { precision: 10, scale: 2 }),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100%
  status: opportunityStatusEnum("status").notNull().default("detected"),
  sourceUrl: text("source_url"),
  scrapingData: json("scraping_data"),
  aiAnalysis: json("ai_analysis"),
  smartLinkId: varchar("smart_link_id").references(() => smartLinks.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  analyzedAt: timestamp("analyzed_at"),
});

// Revenus externes (Stripe, PayPal, etc.)
// <AI:BEGIN drizzle-extrev-status>
export const externalRevenues = pgTable("external_revenues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider", { length: 50 }).notNull(), // stripe, paypal, etc.
  externalTransactionId: varchar("external_transaction_id", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  description: text("description"),
  smartLinkId: varchar("smart_link_id").references(() => smartLinks.id),
  metadata: json("metadata"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  paidAt: timestamp("paid_at"),
}, (t) => ({
  uExtProviderTxn: uniqueIndex("u_extrev_provider_tx").on(t.provider, t.externalTransactionId),
  idxProviderTime: index("idx_extrev_provider_time").on(t.provider, t.processedAt),
  idxStatusTime: index("idx_extrev_status_time").on(t.status, t.processedAt),
}));
// <AI:END drizzle-extrev-status>

// Settings table
export const settings = pgTable("settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
});

// API Keys table - Configuration sécurisée des connecteurs
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelType: varchar("channel_type", { length: 50 }).notNull(), // twitter, discord, telegram, email, medium
  keyName: varchar("key_name", { length: 100 }).notNull(), // API_KEY, TOKEN, SECRET_KEY, etc.
  keyValue: text("key_value").notNull(), // Valeur cryptée
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  lastTested: timestamp("last_tested"),
  testStatus: varchar("test_status", { length: 20 }).default("pending"), // success, failed, pending
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Campaigns table - Campagnes multi-canal avec tracking ROI
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id").notNull().references(() => opportunities.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, active, paused, completed
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0.00"),
  targetChannels: json("target_channels"), // ["twitter", "discord", "email"]
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Campaign Analytics - Métriques détaillées par campagne
export const campaignAnalytics = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id),
  channel: varchar("channel", { length: 50 }).notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0.00"),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0.00"),
  ctr: decimal("ctr", { precision: 5, scale: 4 }).default("0.0000"), // Click-through rate
  cvr: decimal("cvr", { precision: 5, scale: 4 }).default("0.0000"), // Conversion rate
  roi: decimal("roi", { precision: 10, scale: 4 }).default("0.0000"), // Return on Investment
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

// Affiliate Payouts - Tracking des paiements affiliés depuis Amazon, etc.
export const payoutStatusEnum = pgEnum("payout_status", ["detected", "pending", "paid", "rejected", "locked"]);

export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar("external_id", { length: 255 }).notNull(), // Hash unique depuis le provider
  source: varchar("source", { length: 50 }).notNull(), // amazon, cj, partnerstack, etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  status: payoutStatusEnum("status").notNull().default("detected"),
  paymentDate: timestamp("payment_date"), // Date de paiement prévue/réelle
  programType: varchar("program_type", { length: 100 }), // Associates, Influencer, etc.
  description: text("description"),
  rawData: json("raw_data"), // Données brutes du scraping
  payoutId: varchar("payout_id", { length: 255 }), // ID de paiement Stripe/PayPal
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  syncedAt: timestamp("synced_at"), // Quand le paiement a été envoyé
}, (t) => ({
  uAffiliatePayoutExt: uniqueIndex("u_affiliate_payout_ext").on(t.source, t.externalId),
  idxPayoutStatus: index("idx_payout_status").on(t.status),
  idxPayoutDate: index("idx_payout_date").on(t.paymentDate),
  idxPayoutSource: index("idx_payout_source").on(t.source),
}));

// IAS Wallets - Association wallet address <-> user
export const iasWallets = pgTable("ias_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(), // Ethereum address
  isActive: boolean("is_active").notNull().default(true),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxWalletAddress: index("idx_ias_wallet_address").on(t.walletAddress),
  idxUserWallet: index("idx_ias_user_wallet").on(t.userId),
}));

// IAS Rewards - Récompenses calculées par époque pour chaque affilié
export const iasRewards = pgTable("ias_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  epoch: varchar("epoch", { length: 50 }).notNull(), // Format: YYYY-MM-DD ou timestamp
  clicksCount: integer("clicks_count").notNull().default(0),
  validClicksCount: integer("valid_clicks_count").notNull().default(0), // Après filtrage
  rewardAmount: decimal("reward_amount", { precision: 18, scale: 8 }).notNull(), // Montant IAS
  status: varchar("status", { length: 20 }).notNull().default("calculated"), // calculated, pending, distributed, claimed, failed
  transactionHash: varchar("transaction_hash", { length: 66 }), // 0x + 64 chars
  signature: text("signature"), // Pour claim off-chain
  distributedAt: timestamp("distributed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uUserEpoch: uniqueIndex("u_ias_reward_user_epoch").on(t.userId, t.epoch),
  idxRewardStatus: index("idx_ias_reward_status").on(t.status),
  idxWalletEpoch: index("idx_ias_wallet_epoch").on(t.walletAddress, t.epoch),
}));

// IAS Transactions - Historique des transactions blockchain
export const iasTransactions = pgTable("ias_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }).notNull().unique(),
  blockNumber: integer("block_number"),
  transactionType: varchar("transaction_type", { length: 30 }).notNull(), // reward_distribution, claim, staking, unstaking, burn
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  gasUsed: integer("gas_used"),
  gasPriceGwei: decimal("gas_price_gwei", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, failed
  metadata: json("metadata"), // Données supplémentaires selon le type
  createdAt: timestamp("created_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
}, (t) => ({
  idxTransactionHash: index("idx_ias_tx_hash").on(t.transactionHash),
  idxWalletType: index("idx_ias_wallet_type").on(t.walletAddress, t.transactionType),
  idxBlockNumber: index("idx_ias_block_number").on(t.blockNumber),
}));

// IAS Staking - Staking/Unstaking des tokens pour fonctionnalités premium
export const iasStaking = pgTable("ias_staking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  stakedAmount: decimal("staked_amount", { precision: 18, scale: 8 }).notNull(),
  stakingPeriod: integer("staking_period").notNull(), // En jours
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(), // Annual Percentage Yield
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, withdrawn, expired
  stakeTransactionHash: varchar("stake_transaction_hash", { length: 66 }),
  unstakeTransactionHash: varchar("unstake_transaction_hash", { length: 66 }),
  rewardsEarned: decimal("rewards_earned", { precision: 18, scale: 8 }).default("0"),
  stakedAt: timestamp("staked_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  unstakedAt: timestamp("unstaked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxStakingWallet: index("idx_ias_staking_wallet").on(t.walletAddress),
  idxStakingStatus: index("idx_ias_staking_status").on(t.status),
  idxStakingExpiry: index("idx_ias_staking_expiry").on(t.expiresAt),
}));

// Click Tracking pour IAS - Extension avec validation pour rewards
export const iasClickTracking = pgTable("ias_click_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  smartLinkId: varchar("smart_link_id").notNull().references(() => smartLinks.id),
  userId: varchar("user_id").references(() => users.id), // Propriétaire du SmartLink
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  country: varchar("country", { length: 2 }),
  city: varchar("city", { length: 100 }),
  isValid: boolean("is_valid").default(true), // Validation anti-fraude
  isRewardEligible: boolean("is_reward_eligible").default(false), // Eligible pour reward IAS
  fraudScore: decimal("fraud_score", { precision: 5, scale: 2 }).default("0"), // 0-100
  sessionId: varchar("session_id", { length: 255 }),
  clickedAt: timestamp("clicked_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"), // Quand le click a été traité pour rewards
}, (t) => ({
  idxClickSmartLink: index("idx_ias_click_smartlink").on(t.smartLinkId),
  idxClickUser: index("idx_ias_click_user").on(t.userId),
  idxClickEligible: index("idx_ias_click_eligible").on(t.isRewardEligible),
  idxClickTime: index("idx_ias_click_time").on(t.clickedAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  invoices: many(invoices),
  smartLinks: many(smartLinks),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
}));

export const scrapersRelations = relations(scrapers, ({ many }) => ({
  logs: many(scraperLogs),
  smartLinks: many(smartLinks),
  opportunities: many(opportunities),
}));

export const scraperLogsRelations = relations(scraperLogs, ({ one }) => ({
  scraper: one(scrapers, {
    fields: [scraperLogs.scraperId],
    references: [scrapers.id],
  }),
}));

export const smartLinksRelations = relations(smartLinks, ({ one, many }) => ({
  user: one(users, {
    fields: [smartLinks.userId],
    references: [users.id],
  }),
  scraper: one(scrapers, {
    fields: [smartLinks.scraperId],
    references: [scrapers.id],
  }),
  clicks: many(smartLinkClicks),
  externalRevenues: many(externalRevenues),
  opportunities: many(opportunities),
}));

export const smartLinkClicksRelations = relations(smartLinkClicks, ({ one }) => ({
  smartLink: one(smartLinks, {
    fields: [smartLinkClicks.smartLinkId],
    references: [smartLinks.id],
  }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  smartLink: one(smartLinks, {
    fields: [opportunities.smartLinkId],
    references: [smartLinks.id],
  }),
}));

export const externalRevenuesRelations = relations(externalRevenues, ({ one }) => ({
  smartLink: one(smartLinks, {
    fields: [externalRevenues.smartLinkId],
    references: [smartLinks.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [campaigns.opportunityId],
    references: [opportunities.id],
  }),
  analytics: many(campaignAnalytics),
}));

export const campaignAnalyticsRelations = relations(campaignAnalytics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAnalytics.campaignId],
    references: [campaigns.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export const insertAiModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
});

export const insertAiInferenceSchema = createInsertSchema(aiInferences).omit({
  id: true,
  createdAt: true,
});

export const insertAiLogSchema = createInsertSchema(aiLogs).omit({
  id: true,
  timestamp: true,
});

export const insertScraperSchema = createInsertSchema(scrapers).omit({
  id: true,
  createdAt: true,
});

export const insertScraperLogSchema = createInsertSchema(scraperLogs).omit({
  id: true,
  timestamp: true,
});

export const insertSettingSchema = createInsertSchema(settings);

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignAnalyticsSchema = createInsertSchema(campaignAnalytics).omit({
  id: true,
  recordedAt: true,
});

export const insertSmartLinkSchema = createInsertSchema(smartLinks).omit({
  id: true,
  createdAt: true,
});

export const insertSmartLinkClickSchema = createInsertSchema(smartLinkClicks).omit({
  id: true,
  clickedAt: true,
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
});

export const insertExternalRevenueSchema = createInsertSchema(externalRevenues).omit({
  id: true,
  processedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;

export type AiInference = typeof aiInferences.$inferSelect;
export type InsertAiInference = z.infer<typeof insertAiInferenceSchema>;

export type AiLog = typeof aiLogs.$inferSelect;
export type InsertAiLog = z.infer<typeof insertAiLogSchema>;

export type Scraper = typeof scrapers.$inferSelect;
export type InsertScraper = z.infer<typeof insertScraperSchema>;

export type ScraperLog = typeof scraperLogs.$inferSelect;
export type InsertScraperLog = z.infer<typeof insertScraperLogSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type SmartLink = typeof smartLinks.$inferSelect;
export type InsertSmartLink = z.infer<typeof insertSmartLinkSchema>;

export type SmartLinkClick = typeof smartLinkClicks.$inferSelect;
export type InsertSmartLinkClick = z.infer<typeof insertSmartLinkClickSchema>;

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;

export type ExternalRevenue = typeof externalRevenues.$inferSelect;
export type InsertExternalRevenue = z.infer<typeof insertExternalRevenueSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;
export type InsertCampaignAnalytics = z.infer<typeof insertCampaignAnalyticsSchema>;

// IAS Integration Relations
export const iasWalletsRelations = relations(iasWallets, ({ one, many }) => ({
  user: one(users, {
    fields: [iasWallets.userId],
    references: [users.id],
  }),
  rewards: many(iasRewards),
  transactions: many(iasTransactions),
  staking: many(iasStaking),
}));

export const iasRewardsRelations = relations(iasRewards, ({ one }) => ({
  user: one(users, {
    fields: [iasRewards.userId],
    references: [users.id],
  }),
}));

export const iasTransactionsRelations = relations(iasTransactions, ({ one }) => ({
  user: one(users, {
    fields: [iasTransactions.userId],
    references: [users.id],
  }),
}));

export const iasStakingRelations = relations(iasStaking, ({ one }) => ({
  user: one(users, {
    fields: [iasStaking.userId],
    references: [users.id],
  }),
}));

export const iasClickTrackingRelations = relations(iasClickTracking, ({ one }) => ({
  smartLink: one(smartLinks, {
    fields: [iasClickTracking.smartLinkId],
    references: [smartLinks.id],
  }),
  user: one(users, {
    fields: [iasClickTracking.userId],
    references: [users.id],
  }),
}));

// IAS Integration Insert Schemas
export const insertIasWalletSchema = createInsertSchema(iasWallets).omit({
  id: true,
  createdAt: true,
});

export const insertIasRewardSchema = createInsertSchema(iasRewards).omit({
  id: true,
  createdAt: true,
});

export const insertIasTransactionSchema = createInsertSchema(iasTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertIasStakingSchema = createInsertSchema(iasStaking).omit({
  id: true,
  createdAt: true,
});

export const insertIasClickTrackingSchema = createInsertSchema(iasClickTracking).omit({
  id: true,
  clickedAt: true,
});

// IAS Integration Types
export type IasWallet = typeof iasWallets.$inferSelect;
export type InsertIasWallet = z.infer<typeof insertIasWalletSchema>;

export type IasReward = typeof iasRewards.$inferSelect;
export type InsertIasReward = z.infer<typeof insertIasRewardSchema>;

export type IasTransaction = typeof iasTransactions.$inferSelect;
export type InsertIasTransaction = z.infer<typeof insertIasTransactionSchema>;

export type IasStaking = typeof iasStaking.$inferSelect;
export type InsertIasStaking = z.infer<typeof insertIasStakingSchema>;

export type IasClickTracking = typeof iasClickTracking.$inferSelect;
export type InsertIasClickTracking = z.infer<typeof insertIasClickTrackingSchema>;
