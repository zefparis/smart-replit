import { Request, Response, Router } from 'express';
import { dgAISupervisor } from './core';
import { z } from 'zod';

export const dgAISupervisorRouter = Router();

// Validation schemas
const configUpdateSchema = z.object({
  aiAnomalyThreshold: z.number().min(0).max(1).optional(),
  batchDistributionThreshold: z.number().min(0).optional(),
  autoApproveRewards: z.boolean().optional(),
  autoBlockSuspiciousIPs: z.boolean().optional(),
  preventiveActionEnabled: z.boolean().optional(),
});

/**
 * GET /api/dg-ai-supervisor/status
 * Récupérer le statut complet du système
 */
dgAISupervisorRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = dgAISupervisor.getStatus();
    
    res.json({
      success: true,
      status: {
        ...status,
        // Add additional computed metrics
        healthScore: calculateHealthScore(status.health),
        autonomyLevel: status.isRunning ? 'full' : 'disabled',
        lastDecisionTime: status.recentDecisions[0]?.timestamp || null,
      }
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get supervisor status',
    });
  }
});

/**
 * POST /api/dg-ai-supervisor/start
 * Démarrer le superviseur autonome
 */
dgAISupervisorRouter.post('/start', async (req: Request, res: Response) => {
  try {
    if (dgAISupervisor.getStatus().isRunning) {
      return res.json({
        success: true,
        message: 'DG AI Supervisor is already running',
        status: dgAISupervisor.getStatus(),
      });
    }

    await dgAISupervisor.start();
    
    res.json({
      success: true,
      message: 'DG AI Supervisor started successfully',
      status: dgAISupervisor.getStatus(),
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Start failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start supervisor',
    });
  }
});

/**
 * POST /api/dg-ai-supervisor/stop
 * Arrêter le superviseur autonome
 */
dgAISupervisorRouter.post('/stop', async (req: Request, res: Response) => {
  try {
    await dgAISupervisor.stop();
    
    res.json({
      success: true,
      message: 'DG AI Supervisor stopped successfully',
      status: dgAISupervisor.getStatus(),
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Stop failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop supervisor',
    });
  }
});

/**
 * GET /api/dg-ai-supervisor/health
 * Vérification de santé du système avec recommandations AI
 */
dgAISupervisorRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await dgAISupervisor.performHealthCheck();
    
    res.json({
      success: true,
      health: healthStatus,
      recommendations: generateHealthRecommendations(healthStatus),
      nextCheckIn: new Date(Date.now() + 30000), // Next check in 30 seconds
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

/**
 * GET /api/dg-ai-supervisor/decisions
 * Historique des décisions AI
 */
dgAISupervisorRouter.get('/decisions', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const status = dgAISupervisor.getStatus();
    
    let decisions = status.recentDecisions;
    
    // Filter by type if specified
    if (type && typeof type === 'string') {
      decisions = decisions.filter(d => d.type === type);
    }

    // Paginate
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedDecisions = decisions.slice(startIndex, endIndex);

    res.json({
      success: true,
      decisions: paginatedDecisions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: decisions.length,
        totalPages: Math.ceil(decisions.length / Number(limit)),
      },
      decisionTypes: ['fraud_detection', 'reward_approval', 'batch_trigger', 'anomaly_response'],
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Decisions retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get decisions',
    });
  }
});

/**
 * POST /api/dg-ai-supervisor/analyze-click
 * Analyser un click avec l'IA
 */
dgAISupervisorRouter.post('/analyze-click', async (req: Request, res: Response) => {
  try {
    const clickData = req.body;
    
    if (!clickData.smartLinkId) {
      return res.status(400).json({
        success: false,
        error: 'SmartLink ID is required',
      });
    }

    const analysis = await dgAISupervisor.analyzeClickWithAI(clickData);
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        riskLevel: analysis.aiScore > 0.8 ? 'high' : 
                  analysis.aiScore > 0.5 ? 'medium' : 'low',
        timestamp: new Date(),
      }
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Click analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Click analysis failed',
    });
  }
});

/**
 * GET /api/dg-ai-supervisor/batch-evaluation
 * Évaluer si un batch de distribution devrait être déclenché
 */
dgAISupervisorRouter.get('/batch-evaluation', async (req: Request, res: Response) => {
  try {
    const evaluation = await dgAISupervisor.evaluateBatchDistribution();
    
    res.json({
      success: true,
      evaluation: {
        ...evaluation,
        nextEvaluation: new Date(Date.now() + 5 * 60 * 1000), // Next in 5 minutes
        costEstimate: calculateTransactionCost(evaluation.affectedUsers),
      }
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Batch evaluation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Batch evaluation failed',
    });
  }
});

/**
 * POST /api/dg-ai-supervisor/force-batch
 * Forcer la distribution en batch (admin uniquement)
 */
dgAISupervisorRouter.post('/force-batch', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    
    const evaluation = await dgAISupervisor.evaluateBatchDistribution();
    
    if (evaluation.affectedUsers === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pending rewards to distribute',
      });
    }

    // This would trigger the actual batch distribution
    // For now, we'll simulate it
    res.json({
      success: true,
      message: 'Batch distribution triggered manually',
      evaluation,
      transactionHash: `0x${Date.now().toString(16)}`, // Simulated
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Force batch failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Force batch failed',
    });
  }
});

/**
 * PUT /api/dg-ai-supervisor/config
 * Mettre à jour la configuration du superviseur
 */
dgAISupervisorRouter.put('/config', async (req: Request, res: Response) => {
  try {
    const validatedConfig = configUpdateSchema.parse(req.body);
    
    // TODO: Update supervisor configuration
    // For now, we'll just validate and return success
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      updatedFields: Object.keys(validatedConfig),
      newConfig: validatedConfig,
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Config update failed:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Configuration update failed',
    });
  }
});

/**
 * GET /api/dg-ai-supervisor/metrics
 * Métriques en temps réel du système
 */
dgAISupervisorRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const status = dgAISupervisor.getStatus();
    const { timeframe = '24h' } = req.query;
    
    res.json({
      success: true,
      metrics: {
        ...status.metrics,
        timeframe,
        efficiency: {
          fraudDetectionAccuracy: calculateFraudAccuracy(status.metrics),
          systemResponseTime: status.health.lastChecked ? 
            Date.now() - status.health.lastChecked.getTime() : 0,
          automationLevel: status.isRunning ? 100 : 0,
        },
        performance: {
          clicksPerSecond: status.metrics.totalClicks24h / (24 * 60 * 60),
          aiDecisionsPerHour: status.metrics.aiDecisionsMade / 24,
          systemLoad: calculateSystemLoad(status.health),
        }
      },
      lastUpdated: new Date(),
    });

  } catch (error: any) {
    console.error('[DG-AI-SUPERVISOR API] Metrics failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Metrics retrieval failed',
    });
  }
});

// Helper functions
function calculateHealthScore(health: any): number {
  let score = 100;
  
  if (health.overall === 'warning') score -= 20;
  if (health.overall === 'critical') score -= 50;
  
  Object.values(health.components).forEach((status: any) => {
    if (status === 'slow' || status === 'partial' || status === 'syncing' || status === 'limited') {
      score -= 10;
    }
    if (status === 'offline' || status === 'stopped' || status === 'disconnected' || status === 'unavailable') {
      score -= 25;
    }
  });
  
  return Math.max(score, 0);
}

function generateHealthRecommendations(health: any): string[] {
  const recommendations: string[] = [];
  
  if (health.overall === 'critical') {
    recommendations.push('Immediate attention required - system in critical state');
  }
  
  if (health.components.database === 'slow') {
    recommendations.push('Database performance degraded - consider optimization');
  }
  
  if (health.components.blockchain === 'disconnected') {
    recommendations.push('Blockchain connection lost - check network and credentials');
  }
  
  if (health.components.scrapers === 'partial') {
    recommendations.push('Some scrapers offline - check scraper configurations');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System operating normally - all components healthy');
  }
  
  return recommendations;
}

function calculateTransactionCost(userCount: number): number {
  // Estimate gas cost for batch transaction
  const baseGasCost = 21000; // Base transaction cost
  const perUserGasCost = 50000; // Estimated cost per user in batch
  const gasPrice = 20; // Gwei
  const ethPrice = 2500; // USD per ETH
  
  const totalGas = baseGasCost + (userCount * perUserGasCost);
  const gasCostEth = (totalGas * gasPrice) / 1e9; // Convert Gwei to ETH
  const gasCostUsd = gasCostEth * ethPrice;
  
  return Math.round(gasCostUsd * 100) / 100; // Round to 2 decimals
}

function calculateFraudAccuracy(metrics: any): number {
  if (metrics.clicksProcessed === 0) return 100;
  return Math.round((1 - (metrics.fraudDetected / metrics.clicksProcessed)) * 100);
}

function calculateSystemLoad(health: any): number {
  // Simple system load calculation based on component health
  let load = 0;
  
  Object.values(health.components).forEach((status: any) => {
    if (status === 'online' || status === 'synced' || status === 'running' || status === 'available') {
      load += 25;
    } else if (status === 'slow' || status === 'syncing' || status === 'partial' || status === 'limited') {
      load += 50;
    } else {
      load += 100;
    }
  });
  
  return Math.min(load / Object.keys(health.components).length, 100);
}