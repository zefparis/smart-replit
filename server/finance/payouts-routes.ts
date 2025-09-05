// <AI:BEGIN payouts-api-routes>
import { Router } from "express";
import { db } from "../db";
import { affiliatePayouts } from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { PayoutsOrchestrator } from "./payouts_sync";

const router = Router();

/**
 * @swagger
 * /api/payouts:
 *   get:
 *     summary: Get all affiliate payouts
 *     description: Retrieve list of all affiliate payouts with filtering options
 *     parameters:
 *       - name: status
 *         in: query
 *         description: Filter by payout status
 *         schema:
 *           type: string
 *           enum: [detected, pending, paid, rejected, locked]
 *       - name: source
 *         in: query
 *         description: Filter by payout source
 *         schema:
 *           type: string
 *           example: amazon
 *       - name: limit
 *         in: query
 *         description: Limit number of results
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of payouts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payouts:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get("/api/payouts", async (req, res) => {
  try {
    const { status, source, limit = "50" } = req.query;
    
    let query = db.select().from(affiliatePayouts);
    
    const conditions = [];
    if (status) {
      conditions.push(eq(affiliatePayouts.status, status as any));
    }
    if (source) {
      conditions.push(eq(affiliatePayouts.source, source as string));
    }
    
    const payouts = await db.select()
      .from(affiliatePayouts)
      .orderBy(desc(affiliatePayouts.processedAt))
      .limit(parseInt(limit as string));
    
    // Calculate totals by status
    const totals = await db
      .select({
        status: affiliatePayouts.status,
        count: affiliatePayouts.id,
        totalAmount: affiliatePayouts.amount
      })
      .from(affiliatePayouts);
    
    res.json({
      success: true,
      payouts,
      totals: {
        detected: totals.filter(t => t.status === "detected").length,
        pending: totals.filter(t => t.status === "pending").length,
        paid: totals.filter(t => t.status === "paid").length,
        rejected: totals.filter(t => t.status === "rejected").length,
        locked: totals.filter(t => t.status === "locked").length,
      }
    });
  } catch (error) {
    console.error("[PAYOUTS-API] Failed to fetch payouts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch payouts"
    });
  }
});

/**
 * @swagger
 * /api/payouts/sync:
 *   post:
 *     summary: Trigger manual payouts synchronization
 *     description: Manually start the payouts sync process to scrape Amazon and sync to payment providers
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 description: If true, only preview without actual payments
 *                 default: false
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: object
 *                   properties:
 *                     scraped:
 *                       type: integer
 *                     saved:
 *                       type: integer
 *                     synced:
 *                       type: integer
 *                     errors:
 *                       type: integer
 */
router.post("/api/payouts/sync", async (req, res) => {
  try {
    const { dryRun = false } = req.body;
    
    if (process.env.FF_PAYOUTS_ENABLED !== "true") {
      return res.status(400).json({
        success: false,
        error: "Payouts feature is disabled. Set FF_PAYOUTS_ENABLED=true to enable."
      });
    }
    
    console.log(`[PAYOUTS-API] Starting manual sync (dry_run=${dryRun})`);
    
    const orchestrator = new PayoutsOrchestrator({ dryRun });
    const results = await orchestrator.runFullSync();
    
    res.json({
      success: true,
      message: "Payouts synchronization completed",
      results
    });
  } catch (error) {
    console.error("[PAYOUTS-API] Sync failed:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/payouts/status/{id}:
 *   get:
 *     summary: Get specific payout status
 *     description: Retrieve detailed status information for a specific payout
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Payout ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payout status details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payout:
 *                   type: object
 *       404:
 *         description: Payout not found
 */
router.get("/api/payouts/status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const payout = await db.select()
      .from(affiliatePayouts)
      .where(eq(affiliatePayouts.id, id))
      .limit(1);
    
    if (payout.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Payout not found"
      });
    }
    
    res.json({
      success: true,
      payout: payout[0]
    });
  } catch (error) {
    console.error(`[PAYOUTS-API] Failed to get payout status:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get payout status"
    });
  }
});

/**
 * @swagger
 * /api/payouts/stats:
 *   get:
 *     summary: Get payouts statistics and aggregates
 *     description: Retrieve summary statistics for affiliate payouts
 *     responses:
 *       200:
 *         description: Payouts statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalPayouts:
 *                       type: integer
 *                     totalAmount:
 *                       type: string
 *                     pendingAmount:
 *                       type: string
 *                     paidAmount:
 *                       type: string
 *                     bySource:
 *                       type: object
 *                     byStatus:
 *                       type: object
 */
router.get("/api/payouts/stats", async (req, res) => {
  try {
    const totalResults = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`sum(${affiliatePayouts.amount}::numeric)`
      })
      .from(affiliatePayouts);
    
    const byStatus = await db
      .select({
        status: affiliatePayouts.status,
        count: sql<number>`count(*)`,
        amount: sql<number>`sum(${affiliatePayouts.amount}::numeric)`
      })
      .from(affiliatePayouts)
      .groupBy(affiliatePayouts.status);
    
    const bySource = await db
      .select({
        source: affiliatePayouts.source,
        count: sql<number>`count(*)`,
        amount: sql<number>`sum(${affiliatePayouts.amount}::numeric)`
      })
      .from(affiliatePayouts)
      .groupBy(affiliatePayouts.source);
    
    // Calculate aggregates
    const statusStats = byStatus.reduce((acc: any, row) => {
      acc[row.status] = {
        count: row.count,
        amount: row.amount || 0
      };
      return acc;
    }, {});
    
    const sourceStats = bySource.reduce((acc: any, row) => {
      acc[row.source] = {
        count: row.count,
        amount: row.amount || 0
      };
      return acc;
    }, {});
    
    res.json({
      success: true,
      stats: {
        totalPayouts: totalResults[0]?.count || 0,
        totalAmount: parseFloat(totalResults[0]?.totalAmount || "0").toFixed(2),
        pendingAmount: parseFloat(statusStats.pending?.amount || "0").toFixed(2),
        paidAmount: parseFloat(statusStats.paid?.amount || "0").toFixed(2),
        bySource: sourceStats,
        byStatus: statusStats
      }
    });
  } catch (error) {
    console.error("[PAYOUTS-API] Failed to get stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get payouts statistics"
    });
  }
});

export default router;
// <AI:END payouts-api-routes>