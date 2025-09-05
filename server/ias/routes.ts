import { Request, Response, Router } from 'express';
import { iasClickTracker } from './click-tracking';
import { iasRewardCalculator } from './reward-calculator';
import { iasDistributionService } from './distribution-service';
import { z } from 'zod';

export const iasRouter = Router();

// Validation schemas
const clickTrackingSchema = z.object({
  smartLinkId: z.string().min(1, 'SmartLink ID is required'),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  referrer: z.string().optional(),
  country: z.string().length(2).optional(),
  city: z.string().optional(),
});

const rewardClaimSchema = z.object({
  epoch: z.string().min(1, 'Epoch is required'),
  amount: z.string().min(1, 'Amount is required'),
  signature: z.string().min(1, 'Signature is required'),
});

const batchDistributionSchema = z.object({
  affiliates: z.array(z.string()).min(1, 'At least one affiliate required'),
  amounts: z.array(z.string()).min(1, 'At least one amount required'),
  epoch: z.string().min(1, 'Epoch is required'),
});

/**
 * POST /api/ias/clicks/track
 * Enregistrer un nouveau click avec validation anti-fraude
 */
iasRouter.post('/clicks/track', async (req: Request, res: Response) => {
  try {
    const validatedData = clickTrackingSchema.parse(req.body);
    
    // Ajouter l'IP depuis les headers si pas fournie
    if (!validatedData.ipAddress) {
      validatedData.ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    }

    // Ajouter l'User-Agent si pas fourni
    if (!validatedData.userAgent) {
      validatedData.userAgent = req.get('User-Agent') || 'unknown';
    }

    const result = await iasClickTracker.trackClick(validatedData);

    res.json({
      success: result.success,
      clickId: result.clickId,
      isValid: result.fraudResult.isValid,
      isRewardEligible: result.fraudResult.isRewardEligible,
      rewardAmount: result.rewardAmount || 0,
      fraudScore: result.fraudResult.fraudScore,
      message: result.fraudResult.isRewardEligible ? 
        `Click tracked successfully! Reward: ${result.rewardAmount} IAS` :
        `Click tracked but not eligible for rewards (fraud score: ${result.fraudResult.fraudScore})`
    });

  } catch (error: any) {
    console.error('[IAS API] Click tracking failed:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Click tracking failed',
    });
  }
});

/**
 * GET /api/ias/clicks/stats
 * Obtenir les statistiques de clicks pour une période
 */
iasRouter.get('/clicks/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const stats = await iasClickTracker.getClickStats(start, end);

    res.json({
      success: true,
      period: { startDate: start, endDate: end },
      stats
    });

  } catch (error: any) {
    console.error('[IAS API] Click stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get click stats'
    });
  }
});

/**
 * POST /api/ias/rewards/calculate
 * Calculer les rewards pour une époque
 */
iasRouter.post('/rewards/calculate', async (req: Request, res: Response) => {
  try {
    const { epoch } = req.body;
    
    if (!epoch) {
      return res.status(400).json({
        error: 'Epoch is required'
      });
    }

    const result = await iasRewardCalculator.calculateEpochRewards(epoch);

    res.json({
      success: result.success,
      epoch: result.epoch,
      epochStats: result.epochStats,
      affiliateRewards: result.affiliateRewards,
      error: result.error
    });

  } catch (error: any) {
    console.error('[IAS API] Reward calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Reward calculation failed'
    });
  }
});

/**
 * GET /api/ias/rewards/pending/:userId
 * Obtenir les rewards en attente pour un utilisateur
 */
iasRouter.get('/rewards/pending/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const pendingRewards = await iasRewardCalculator.getPendingRewards(userId);

    res.json({
      success: true,
      userId,
      ...pendingRewards
    });

  } catch (error: any) {
    console.error('[IAS API] Get pending rewards failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending rewards'
    });
  }
});

/**
 * POST /api/ias/distribution/batch
 * Distribution en lot des rewards (admin seulement)
 */
iasRouter.post('/distribution/batch', async (req: Request, res: Response) => {
  try {
    const validatedData = batchDistributionSchema.parse(req.body);
    
    if (validatedData.affiliates.length !== validatedData.amounts.length) {
      return res.status(400).json({
        error: 'Affiliates and amounts arrays must have the same length'
      });
    }

    const result = await iasDistributionService.batchDistributeRewards(
      validatedData.affiliates,
      validatedData.amounts,
      validatedData.epoch
    );

    res.json({
      success: result.success,
      transactionHash: result.transactionHash,
      distributedAmount: result.distributedAmount,
      affiliatesCount: result.affiliatesCount,
      error: result.error
    });

  } catch (error: any) {
    console.error('[IAS API] Batch distribution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Batch distribution failed'
    });
  }
});

/**
 * POST /api/ias/signature/generate
 * Générer une signature pour claim off-chain (admin seulement)
 */
iasRouter.post('/signature/generate', async (req: Request, res: Response) => {
  try {
    const { userAddress, amount, epoch } = req.body;
    
    if (!userAddress || !amount || !epoch) {
      return res.status(400).json({
        error: 'userAddress, amount, and epoch are required'
      });
    }

    const signature = await iasDistributionService.generateClaimSignature(
      userAddress,
      amount,
      epoch
    );

    res.json({
      success: true,
      signature,
      userAddress,
      amount,
      epoch,
      message: 'Signature generated successfully. User can now claim rewards.'
    });

  } catch (error: any) {
    console.error('[IAS API] Signature generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Signature generation failed'
    });
  }
});

/**
 * GET /api/ias/wallet/:userAddress/balance
 * Obtenir le solde IAS d'un wallet
 */
iasRouter.get('/wallet/:userAddress/balance', async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.params;
    
    const balance = await iasDistributionService.getWalletBalance(userAddress);

    res.json({
      success: true,
      userAddress,
      balance: balance.toString(),
      balanceFormatted: balance.toString() + ' IAS'
    });

  } catch (error: any) {
    console.error('[IAS API] Get wallet balance failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get wallet balance'
    });
  }
});

/**
 * GET /api/ias/dashboard/stats
 * Statistiques globales pour le dashboard admin
 */
iasRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const currentEpoch = iasRewardCalculator.getCurrentEpoch();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [dailyStats, weeklyStats, contractInfo] = await Promise.all([
      iasClickTracker.getClickStats(yesterday, new Date()),
      iasClickTracker.getClickStats(weekAgo, new Date()),
      iasDistributionService.getContractInfo()
    ]);

    res.json({
      success: true,
      currentEpoch,
      dailyStats: {
        ...dailyStats,
        period: '24h'
      },
      weeklyStats: {
        ...weeklyStats,
        period: '7d'
      },
      contractInfo
    });

  } catch (error: any) {
    console.error('[IAS API] Dashboard stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get dashboard stats'
    });
  }
});

/**
 * GET /api/ias/config
 * Configuration publique du système IAS
 */
iasRouter.get('/config', async (req: Request, res: Response) => {
  try {
    const config = {
      rewardPerClick: parseFloat(process.env.IAS_REWARD_PER_CLICK || '0.25'),
      epochDuration: parseInt(process.env.REWARDS_EPOCH_DURATION || '86400'),
      contractAddress: process.env.IAS_CONTRACT_ADDRESS || '',
      distributorAddress: process.env.IAS_DISTRIBUTOR_ADDRESS || '',
      networkName: process.env.IAS_NETWORK_NAME || 'sepolia',
      rpcUrl: process.env.IAS_RPC_URL || '',
      symbol: 'IAS',
      decimals: 18,
      maxClicksPerHour: parseInt(process.env.IAS_MAX_CLICKS_PER_IP_HOUR || '10')
    };

    res.json({
      success: true,
      config
    });

  } catch (error: any) {
    console.error('[IAS API] Get config failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get config'
    });
  }
});

export default iasRouter;