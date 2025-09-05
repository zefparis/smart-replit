import express from "express";
import { storage } from "./storage";

const financeRouter = express.Router();

// Routes finance pour SmartLinks Autopilot - Données réelles uniquement
financeRouter.get("/api/finance/metrics/:period?", async (req, res) => {
  try {
    const { period = "30d" } = req.params;
    
    const revenues = await storage.getAllExternalRevenues();
    
    // Calculer la période de temps
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
      return revenueDate >= startDate;
    });
    
    const totalRevenue = filteredRevenues.reduce((sum, rev) => sum + parseFloat(rev.amount), 0);
    const pendingRevenues = filteredRevenues.filter(rev => rev.status === 'pending');
    const paidRevenues = filteredRevenues.filter(rev => rev.status === 'paid');
    const lockedRevenues = filteredRevenues.filter(rev => rev.status === 'locked');
    const rejectedRevenues = filteredRevenues.filter(rev => rev.status === 'rejected');
    
    const pendingAmount = pendingRevenues.reduce((sum, rev) => sum + parseFloat(rev.amount), 0);
    const paidAmount = paidRevenues.reduce((sum, rev) => sum + parseFloat(rev.amount), 0);
    
    const metrics = {
      roiPct: 0, // Calculé par l'utilisateur selon ses coûts réels
      profitNet: paidAmount, // Profit net = montant payé
      bySource: {
        affiliate: totalRevenue,
        other: 0
      },
      external: {
        pending: pendingRevenues.length,
        paid: paidRevenues.length,
        locked: lockedRevenues.length,
        rejected: rejectedRevenues.length,
        pending_amount: pendingAmount,
        paid_amount: paidAmount
      },
      total_revenue: totalRevenue,
      total_transactions: filteredRevenues.length
    };

    res.json(metrics);
  } catch (error) {
    console.error("Error fetching finance metrics:", error);
    res.status(500).json({ error: "Failed to fetch finance metrics" });
  }
});

financeRouter.get("/api/finance/transactions", async (req, res) => {
  try {
    const transactions = await storage.getAllTransactions();
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

financeRouter.get("/api/finance/invoices", async (req, res) => {
  try {
    const invoices = await storage.getAllInvoices();
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

financeRouter.get("/api/finance/campaign-revenues/:period?", async (req, res) => {
  try {
    // Retourner seulement les campagnes réelles avec leurs revenus réels
    const smartLinks = await storage.getAllSmartLinks();
    const revenues = await storage.getAllExternalRevenues();
    
    // Grouper par campagne si disponible
    const campaignMap = new Map();
    
    revenues.forEach(revenue => {
      const metadata = revenue.metadata as any;
      const campaignId = metadata?.campaign_id || 'no_campaign';
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          id: campaignId,
          name: campaignId === 'no_campaign' ? 'Direct Sales' : `Campaign ${campaignId}`,
          revenue: 0,
          count: 0
        });
      }
      const campaign = campaignMap.get(campaignId);
      campaign.revenue += parseFloat(revenue.amount);
      campaign.count += 1;
    });

    const campaignRevenues = Array.from(campaignMap.values());
    res.json(campaignRevenues);
  } catch (error) {
    console.error("Error fetching campaign revenues:", error);
    res.status(500).json({ error: "Failed to fetch campaign revenues" });
  }
});

financeRouter.get("/api/finance/export", async (req, res) => {
  try {
    const { format = "csv" } = req.query;
    
    if (format === "csv") {
      const transactions = await storage.getAllTransactions();
      
      // Générer un CSV avec les vraies données
      let csvContent = "Date,Type,Source,Description,Amount,Status\n";
      
      transactions.forEach(tx => {
        csvContent += `${tx.createdAt},${tx.transactionType},${tx.userId},${tx.description},${tx.amount},${tx.status}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_export.csv"`);
      res.send(csvContent);
    } else {
      res.status(400).json({ error: "Only CSV format is supported" });
    }
  } catch (error) {
    console.error("Error exporting transactions:", error);
    res.status(500).json({ error: "Failed to export transactions" });
  }
});

export default financeRouter;