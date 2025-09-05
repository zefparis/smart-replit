// <AI:BEGIN payouts-sync-service>
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { affiliatePayouts } from "../../shared/schema";
import { createHash } from "crypto";

export interface AmazonPayoutData {
  id: string;
  source: string;
  amount: number;
  currency: string;
  status: "detected" | "pending" | "paid" | "rejected" | "locked";
  date: Date;
  programType?: string;
  description?: string;
  rawData?: any;
}

// 🔁 Amazon Affiliate Scraper/Parser
export class AmazonPayoutsScraper {
  private email: string;
  private password: string;

  constructor() {
    this.email = process.env.AMAZON_EMAIL || "";
    this.password = process.env.AMAZON_PASSWORD || "";
    
    if (!this.email || !this.password) {
      throw new Error("Amazon credentials missing: AMAZON_EMAIL and AMAZON_PASSWORD required");
    }
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return createHash("sha256").update(str).digest("hex");
  }

  // Simulate Amazon Associates dashboard scraping
  async scrapePayoutsData(): Promise<AmazonPayoutData[]> {
    console.log("[AMAZON-SCRAPER] Starting Amazon payouts scraping...");
    
    try {
      // In a real implementation, this would use puppeteer or playwright
      // to login to Amazon Associates dashboard and scrape the payments table
      // For now, we'll simulate with structured data that would come from scraping
      
      const simulatedScrapedData = [
        {
          date: "2025-01-15",
          amount: "124.50",
          currency: "USD",
          status: "Paid",
          programType: "Associates",
          description: "January 2025 Commission Payment",
          paymentMethod: "Direct Deposit"
        },
        {
          date: "2025-01-01", 
          amount: "89.75",
          currency: "USD", 
          status: "Pending",
          programType: "Associates",
          description: "December 2024 Commission Payment",
          paymentMethod: "Direct Deposit"
        },
        {
          date: "2024-12-15",
          amount: "201.25", 
          currency: "USD",
          status: "Paid",
          programType: "Influencer Program",
          description: "November 2024 Commission Payment", 
          paymentMethod: "Direct Deposit"
        }
      ];

      // Transform scraped data to our format
      const payouts: AmazonPayoutData[] = simulatedScrapedData.map(item => {
        const hash = this.generateHash({
          date: item.date,
          amount: item.amount,
          programType: item.programType
        });

        return {
          id: hash,
          source: "amazon",
          amount: parseFloat(item.amount),
          currency: item.currency,
          status: item.status.toLowerCase() === "paid" ? "paid" : 
                  item.status.toLowerCase() === "pending" ? "pending" : "detected",
          date: new Date(item.date),
          programType: item.programType,
          description: item.description,
          rawData: item
        };
      });

      console.log(`[AMAZON-SCRAPER] Found ${payouts.length} payouts`);
      return payouts;

    } catch (error) {
      console.error("[AMAZON-SCRAPER] Scraping failed:", error);
      throw error;
    }
  }
}

// 💾 Database Storage Service
export class PayoutsStorageService {
  async savePayouts(payouts: AmazonPayoutData[]): Promise<{ saved: number; duplicates: number }> {
    let saved = 0;
    let duplicates = 0;

    for (const payout of payouts) {
      try {
        // Check if already exists
        const existing = await db.select()
          .from(affiliatePayouts)
          .where(and(
            eq(affiliatePayouts.source, payout.source),
            eq(affiliatePayouts.externalId, payout.id)
          ))
          .limit(1);

        if (existing.length > 0) {
          duplicates++;
          console.log(`[STORAGE] Duplicate payout skipped: ${payout.id}`);
          continue;
        }

        // Insert new payout
        await db.insert(affiliatePayouts).values({
          externalId: payout.id,
          source: payout.source,
          amount: payout.amount.toString(),
          currency: payout.currency,
          status: payout.status,
          paymentDate: payout.date,
          programType: payout.programType,
          description: payout.description,
          rawData: payout.rawData,
        });

        saved++;
        console.log(`[STORAGE] Saved payout: ${payout.id} - $${payout.amount}`);

      } catch (error) {
        console.error(`[STORAGE] Failed to save payout ${payout.id}:`, error);
      }
    }

    return { saved, duplicates };
  }

  async getPendingPayouts(): Promise<any[]> {
    return await db.select()
      .from(affiliatePayouts)
      .where(eq(affiliatePayouts.status, "pending"));
  }

  async markPayoutSynced(id: string, payoutId: string): Promise<void> {
    await db.update(affiliatePayouts)
      .set({ 
        status: "paid", 
        payoutId, 
        syncedAt: new Date() 
      })
      .where(eq(affiliatePayouts.id, id));
  }
}

// 💸 Payout Sync Service - Stripe/PayPal Integration  
export class PayoutSyncService {
  private useStripe: boolean;
  private usePayPal: boolean;
  private dryRun: boolean;

  constructor(options: { dryRun?: boolean } = {}) {
    this.useStripe = process.env.USE_STRIPE_PAYOUTS === "true";
    this.usePayPal = process.env.USE_PAYPAL_PAYOUTS === "true";
    this.dryRun = options.dryRun || process.env.DRY_RUN === "true";
  }

  async syncPayout(payout: any): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    if (this.dryRun) {
      console.log(`[PAYOUT-SYNC] DRY RUN - Would sync payout: ${payout.id} - $${payout.amount}`);
      return { success: true, payoutId: `dry-run-${Date.now()}` };
    }

    try {
      if (this.useStripe) {
        return await this.syncToStripe(payout);
      } else if (this.usePayPal) {
        return await this.syncToPayPal(payout);
      } else {
        return { success: false, error: "No payout provider configured" };
      }
    } catch (error) {
      console.error(`[PAYOUT-SYNC] Failed to sync payout ${payout.id}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async syncToStripe(payout: any): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey) {
      return { success: false, error: "STRIPE_API_KEY not configured" };
    }

    const transferData = {
      amount: Math.round(payout.amount * 100), // Convert to cents
      currency: payout.currency.toLowerCase(),
      destination: process.env.STRIPE_DESTINATION_ACCOUNT, // Connected account ID
      description: `Amazon affiliate payout: ${payout.description}`,
      metadata: {
        source: payout.source,
        external_id: payout.externalId,
        program_type: payout.programType || ""
      }
    };

    const response = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(transferData as any).toString()
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Stripe transfer failed: ${error}` };
    }

    const transfer = await response.json();
    console.log(`[STRIPE] Transfer created: ${transfer.id} - $${payout.amount}`);
    return { success: true, payoutId: transfer.id };
  }

  private async syncToPayPal(payout: any): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return { success: false, error: "PayPal credentials not configured" };
    }

    // Get access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = process.env.PAYPAL_ENV === "live" 
      ? "https://api.paypal.com"
      : "https://api.sandbox.paypal.com";

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!authResponse.ok) {
      return { success: false, error: "PayPal authentication failed" };
    }

    const auth = await authResponse.json();

    // Create payout
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `amazon-${payout.externalId}`,
        email_subject: "Amazon Affiliate Payout",
        email_message: `Your affiliate commission payment of $${payout.amount}`
      },
      items: [{
        recipient_type: "EMAIL",
        amount: {
          value: payout.amount.toFixed(2),
          currency: payout.currency
        },
        receiver: process.env.PAYPAL_RECIPIENT_EMAIL,
        note: payout.description,
        sender_item_id: payout.externalId
      }]
    };

    const payoutResponse = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: "POST", 
      headers: {
        "Authorization": `Bearer ${auth.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payoutData)
    });

    if (!payoutResponse.ok) {
      const error = await payoutResponse.text();
      return { success: false, error: `PayPal payout failed: ${error}` };
    }

    const payoutResult = await payoutResponse.json();
    console.log(`[PAYPAL] Payout created: ${payoutResult.batch_header.payout_batch_id} - $${payout.amount}`);
    return { success: true, payoutId: payoutResult.batch_header.payout_batch_id };
  }
}

// 🔄 Main Payouts Sync Orchestrator
export class PayoutsOrchestrator {
  private scraper: AmazonPayoutsScraper;
  private storage: PayoutsStorageService;
  private syncService: PayoutSyncService;

  constructor(options: { dryRun?: boolean } = {}) {
    this.scraper = new AmazonPayoutsScraper();
    this.storage = new PayoutsStorageService();
    this.syncService = new PayoutSyncService(options);
  }

  async runFullSync(): Promise<{
    scraped: number;
    saved: number;
    duplicates: number;
    synced: number;
    errors: number;
  }> {
    const startTime = Date.now();
    console.log("[PAYOUTS-SYNC] Starting full synchronization...");

    try {
      // 1. Scrape Amazon payouts
      const payouts = await this.scraper.scrapePayoutsData();
      
      // 2. Save to database
      const { saved, duplicates } = await this.storage.savePayouts(payouts);
      
      // 3. Sync pending payouts to Stripe/PayPal
      const pendingPayouts = await this.storage.getPendingPayouts();
      let synced = 0;
      let errors = 0;

      for (const payout of pendingPayouts) {
        const result = await this.syncService.syncPayout(payout);
        
        if (result.success && result.payoutId) {
          await this.storage.markPayoutSynced(payout.id, result.payoutId);
          synced++;
        } else {
          console.error(`[SYNC] Failed to sync payout ${payout.id}: ${result.error}`);
          errors++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[PAYOUTS-SYNC] Completed in ${duration}ms: ${saved} saved, ${synced} synced, ${errors} errors`);

      return {
        scraped: payouts.length,
        saved,
        duplicates,
        synced,
        errors
      };

    } catch (error) {
      console.error("[PAYOUTS-SYNC] Full sync failed:", error);
      throw error;
    }
  }
}
// <AI:END payouts-sync-service>