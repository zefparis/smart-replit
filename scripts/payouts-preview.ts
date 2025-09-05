#!/usr/bin/env tsx
// <AI:BEGIN payouts-preview-cli>
import { PayoutsOrchestrator, AmazonPayoutsScraper, PayoutsStorageService } from "../server/finance/payouts_sync";

async function previewPayouts() {
  console.log("🔍 AMAZON AFFILIATE PAYOUTS PREVIEW");
  console.log("====================================");
  
  try {
    // Initialize services
    const scraper = new AmazonPayoutsScraper();
    const storage = new PayoutsStorageService();
    
    console.log("\n📊 Fetching latest payouts from Amazon...");
    const payouts = await scraper.scrapePayoutsData();
    
    console.log(`\n✅ Found ${payouts.length} payouts:`);
    console.log("─".repeat(80));
    
    let totalAmount = 0;
    
    payouts.forEach((payout, index) => {
      console.log(`${index + 1}. ${payout.date.toISOString().split('T')[0]} | $${payout.amount.toFixed(2)} ${payout.currency}`);
      console.log(`   Status: ${payout.status.toUpperCase()} | Program: ${payout.programType || 'N/A'}`);
      console.log(`   Description: ${payout.description || 'No description'}`);
      console.log(`   ID: ${payout.id}`);
      console.log("");
      
      totalAmount += payout.amount;
    });
    
    console.log("─".repeat(80));
    console.log(`💰 Total Amount: $${totalAmount.toFixed(2)} USD`);
    
    // Check pending payouts in database
    console.log("\n🔄 Checking pending payouts in database...");
    const pendingPayouts = await storage.getPendingPayouts();
    console.log(`📋 Found ${pendingPayouts.length} pending payouts ready for sync`);
    
    if (pendingPayouts.length > 0) {
      let pendingTotal = 0;
      pendingPayouts.forEach((payout, index) => {
        console.log(`${index + 1}. $${parseFloat(payout.amount).toFixed(2)} ${payout.currency} - ${payout.description}`);
        pendingTotal += parseFloat(payout.amount);
      });
      console.log(`💸 Total Pending: $${pendingTotal.toFixed(2)} USD`);
    }
    
    // Configuration status
    console.log("\n⚙️  CONFIGURATION STATUS");
    console.log("─".repeat(40));
    console.log(`🔑 Amazon Email: ${process.env.AMAZON_EMAIL ? "✅ Configured" : "❌ Missing"}`);
    console.log(`🔑 Amazon Password: ${process.env.AMAZON_PASSWORD ? "✅ Configured" : "❌ Missing"}`);
    console.log(`💳 Stripe Payouts: ${process.env.USE_STRIPE_PAYOUTS === "true" ? "✅ Enabled" : "❌ Disabled"}`);
    console.log(`💰 PayPal Payouts: ${process.env.USE_PAYPAL_PAYOUTS === "true" ? "✅ Enabled" : "❌ Disabled"}`);
    console.log(`🧪 Dry Run Mode: ${process.env.DRY_RUN === "true" ? "✅ Enabled" : "❌ Disabled"}`);
    console.log(`🚀 Payouts Enabled: ${process.env.FF_PAYOUTS_ENABLED === "true" ? "✅ Enabled" : "❌ Disabled"}`);
    
  } catch (error) {
    console.error("❌ Preview failed:", error);
    process.exit(1);
  }
}

async function runFullSync() {
  console.log("🚀 RUNNING FULL PAYOUTS SYNCHRONIZATION");
  console.log("========================================");
  
  try {
    const orchestrator = new PayoutsOrchestrator({ 
      dryRun: process.env.DRY_RUN === "true" 
    });
    
    const result = await orchestrator.runFullSync();
    
    console.log("\n✅ SYNCHRONIZATION COMPLETE");
    console.log("─".repeat(40));
    console.log(`📥 Scraped: ${result.scraped} payouts`);
    console.log(`💾 Saved: ${result.saved} new payouts`);
    console.log(`🔄 Duplicates: ${result.duplicates} skipped`);
    console.log(`💸 Synced: ${result.synced} payments sent`);
    console.log(`❌ Errors: ${result.errors} failed`);
    
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

// CLI interface
const command = process.argv[2];

if (command === "sync") {
  runFullSync();
} else {
  previewPayouts();
}
// <AI:END payouts-preview-cli>