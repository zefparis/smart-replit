// <AI:BEGIN finance-payout-routes>
import { Router } from "express";
import { runAllPayoutPollers } from "./affiliates/payout-pollers";
import { paypalBalance } from "./providers/paypal";
import { stripeBalance } from "./providers/stripe";

const router = Router();

router.post("/api/finance/payouts/sync", async (_req, res) => {
  try {
    console.log(`[PAYOUT-API] Starting payout synchronization...`);
    const result = await runAllPayoutPollers();
    
    res.json({
      success: true,
      message: "Payout synchronization completed",
      ...result
    });
  } catch (error) {
    console.error(`[PAYOUT-API] Sync failed:`, error);
    res.status(500).json({
      success: false,
      error: "Payout sync failed",
      message: (error as Error).message
    });
  }
});

router.get("/api/finance/paypal/balance", async (_req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return res.status(501).json({ 
      success: false,
      error: "not_configured", 
      message: "PayPal credentials not configured" 
    });
  }
  
  try {
    const balance = await paypalBalance();
    res.json({
      success: true,
      balance,
      retrieved_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[PAYOUT-API] PayPal balance failed:`, error);
    
    // Provide helpful error context for PayPal setup
    const errorMessage = (error as Error).message;
    const isAuthError = errorMessage.includes("401") || errorMessage.includes("Unauthorized");
    
    res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: isAuthError ? "paypal_auth_failed" : "paypal_balance_failed",
      message: isAuthError 
        ? "PayPal credentials invalid or app not configured properly. Check PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and app permissions."
        : errorMessage,
      hint: isAuthError 
        ? "Ensure PayPal app has 'View account activities' permission and is configured for the correct environment (sandbox/live)"
        : undefined
    });
  }
});

router.get("/api/finance/stripe/balance", async (_req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ 
      success: false,
      error: "not_configured", 
      message: "Stripe API key not configured" 
    });
  }
  
  try {
    const balance = await stripeBalance();
    res.json({
      success: true,
      balance,
      retrieved_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[PAYOUT-API] Stripe balance failed:`, error);
    res.status(500).json({
      success: false,
      error: "stripe_balance_failed",
      message: (error as Error).message
    });
  }
});

export default router;
// <AI:END finance-payout-routes>