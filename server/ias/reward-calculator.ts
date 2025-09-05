import { db } from '../db';
import { iasRewards, iasClickTracking, users, iasWallets } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { ethers } from 'ethers';

export interface EpochStats {
  epoch: string;
  startDate: Date;
  endDate: Date;
  totalClicks: number;
  eligibleClicks: number;
  totalRewardAmount: number;
  affiliatesCount: number;
}

export interface AffiliateReward {
  userId: string;
  userEmail: string;
  walletAddress: string;
  clicksCount: number;
  validClicksCount: number;
  rewardAmount: number;
}

export interface RewardCalculationResult {
  epoch: string;
  epochStats: EpochStats;
  affiliateRewards: AffiliateReward[];
  success: boolean;
  error?: string;
}

export class IASRewardCalculator {
  private readonly rewardPerClick: number;
  private readonly epochDuration: number; // en secondes

  constructor() {
    this.rewardPerClick = parseFloat(process.env.IAS_REWARD_PER_CLICK || '0.25');
    this.epochDuration = parseInt(process.env.REWARDS_EPOCH_DURATION || '86400'); // 24h par défaut
  }

  /**
   * Calculer les rewards pour une époque donnée
   */
  async calculateEpochRewards(epochDate: string): Promise<RewardCalculationResult> {
    try {
      console.log(`[IAS] Calculating rewards for epoch: ${epochDate}`);

      // Déterminer les dates de début/fin de l'époque
      const { startDate, endDate } = this.getEpochDateRange(epochDate);

      // Vérifier si les rewards ont déjà été calculés pour cette époque
      const existingRewards = await this.checkExistingRewards(epochDate);
      if (existingRewards.length > 0) {
        console.log(`[IAS] Rewards already calculated for epoch ${epochDate}`);
        return {
          epoch: epochDate,
          epochStats: await this.getEpochStats(epochDate, startDate, endDate),
          affiliateRewards: await this.getExistingRewards(epochDate),
          success: true
        };
      }

      // Obtenir tous les clicks éligibles pour cette période
      const eligibleClicks = await this.getEligibleClicksForEpoch(startDate, endDate);
      
      if (eligibleClicks.length === 0) {
        console.log(`[IAS] No eligible clicks found for epoch ${epochDate}`);
        return {
          epoch: epochDate,
          epochStats: await this.getEpochStats(epochDate, startDate, endDate),
          affiliateRewards: [],
          success: true
        };
      }

      // Grouper les clicks par utilisateur/affilié
      const affiliateClicksMap = await this.groupClicksByAffiliate(eligibleClicks);

      // Calculer les rewards pour chaque affilié
      const affiliateRewards: AffiliateReward[] = [];
      
      for (const [userId, clicksData] of affiliateClicksMap.entries()) {
        const rewardAmount = clicksData.validClicks * this.rewardPerClick;
        
        affiliateRewards.push({
          userId,
          userEmail: clicksData.userEmail,
          walletAddress: clicksData.walletAddress,
          clicksCount: clicksData.totalClicks,
          validClicksCount: clicksData.validClicks,
          rewardAmount
        });
      }

      // Sauvegarder les rewards calculés en base
      await this.saveCalculatedRewards(epochDate, affiliateRewards);

      // Créer les statistiques d'époque
      const epochStats: EpochStats = {
        epoch: epochDate,
        startDate,
        endDate,
        totalClicks: eligibleClicks.length,
        eligibleClicks: eligibleClicks.length,
        totalRewardAmount: affiliateRewards.reduce((sum, r) => sum + r.rewardAmount, 0),
        affiliatesCount: affiliateRewards.length
      };

      console.log(`[IAS] Calculated rewards for ${affiliateRewards.length} affiliates, total: ${epochStats.totalRewardAmount} IAS`);

      return {
        epoch: epochDate,
        epochStats,
        affiliateRewards,
        success: true
      };

    } catch (error: any) {
      console.error(`[IAS] Reward calculation failed for epoch ${epochDate}:`, error);
      return {
        epoch: epochDate,
        epochStats: {
          epoch: epochDate,
          startDate: new Date(),
          endDate: new Date(),
          totalClicks: 0,
          eligibleClicks: 0,
          totalRewardAmount: 0,
          affiliatesCount: 0
        },
        affiliateRewards: [],
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir les dates de début et fin pour une époque
   */
  private getEpochDateRange(epochDate: string): { startDate: Date, endDate: Date } {
    // Format epoch: YYYY-MM-DD
    const epochStart = new Date(epochDate + 'T00:00:00Z');
    const epochEnd = new Date(epochStart.getTime() + (this.epochDuration * 1000));
    
    return {
      startDate: epochStart,
      endDate: epochEnd
    };
  }

  /**
   * Vérifier si des rewards existent déjà pour une époque
   */
  private async checkExistingRewards(epoch: string): Promise<any[]> {
    return await db
      .select()
      .from(iasRewards)
      .where(eq(iasRewards.epoch, epoch))
      .limit(1);
  }

  /**
   * Obtenir les rewards existants pour une époque
   */
  private async getExistingRewards(epoch: string): Promise<AffiliateReward[]> {
    const results = await db
      .select({
        userId: iasRewards.userId,
        userEmail: users.email,
        walletAddress: iasRewards.walletAddress,
        clicksCount: iasRewards.clicksCount,
        validClicksCount: iasRewards.validClicksCount,
        rewardAmount: iasRewards.rewardAmount
      })
      .from(iasRewards)
      .innerJoin(users, eq(iasRewards.userId, users.id))
      .where(eq(iasRewards.epoch, epoch));

    return results.map(r => ({
      userId: r.userId,
      userEmail: r.userEmail,
      walletAddress: r.walletAddress,
      clicksCount: r.clicksCount,
      validClicksCount: r.validClicksCount,
      rewardAmount: parseFloat(r.rewardAmount)
    }));
  }

  /**
   * Obtenir les clicks éligibles pour une période
   */
  private async getEligibleClicksForEpoch(startDate: Date, endDate: Date): Promise<any[]> {
    return await db
      .select({
        id: iasClickTracking.id,
        userId: iasClickTracking.userId,
        smartLinkId: iasClickTracking.smartLinkId,
        isValid: iasClickTracking.isValid,
        isRewardEligible: iasClickTracking.isRewardEligible,
        clickedAt: iasClickTracking.clickedAt
      })
      .from(iasClickTracking)
      .where(and(
        eq(iasClickTracking.isRewardEligible, true),
        gte(iasClickTracking.clickedAt, startDate),
        lte(iasClickTracking.clickedAt, endDate)
      ));
  }

  /**
   * Grouper les clicks par affilié avec informations utilisateur
   */
  private async groupClicksByAffiliate(clicks: any[]): Promise<Map<string, {
    userEmail: string;
    walletAddress: string;
    totalClicks: number;
    validClicks: number;
  }>> {
    const groupedData = new Map();

    for (const click of clicks) {
      if (!click.userId) continue; // Skip clicks sans userId

      if (!groupedData.has(click.userId)) {
        // Récupérer les infos utilisateur et wallet
        const userInfo = await this.getUserInfo(click.userId);
        if (!userInfo) continue; // Skip si user pas trouvé

        groupedData.set(click.userId, {
          userEmail: userInfo.email,
          walletAddress: userInfo.walletAddress,
          totalClicks: 0,
          validClicks: 0
        });
      }

      const userData = groupedData.get(click.userId);
      userData.totalClicks++;
      
      if (click.isValid && click.isRewardEligible) {
        userData.validClicks++;
      }
    }

    return groupedData;
  }

  /**
   * Récupérer les informations utilisateur et wallet
   */
  private async getUserInfo(userId: string): Promise<{
    email: string;
    walletAddress: string;
  } | null> {
    const result = await db
      .select({
        email: users.email,
        walletAddress: iasWallets.walletAddress
      })
      .from(users)
      .leftJoin(iasWallets, and(
        eq(iasWallets.userId, users.id),
        eq(iasWallets.isActive, true)
      ))
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) return null;

    return {
      email: result[0].email,
      walletAddress: result[0].walletAddress || 'no_wallet_configured'
    };
  }

  /**
   * Sauvegarder les rewards calculés en base
   */
  private async saveCalculatedRewards(epoch: string, rewards: AffiliateReward[]): Promise<void> {
    if (rewards.length === 0) return;

    const rewardRecords = rewards.map(reward => ({
      userId: reward.userId,
      walletAddress: reward.walletAddress,
      epoch: epoch,
      clicksCount: reward.clicksCount,
      validClicksCount: reward.validClicksCount,
      rewardAmount: reward.rewardAmount.toString(),
      status: 'calculated' as const,
      createdAt: new Date()
    }));

    await db.insert(iasRewards).values(rewardRecords);
    console.log(`[IAS] Saved ${rewardRecords.length} reward records for epoch ${epoch}`);
  }

  /**
   * Obtenir les statistiques d'une époque
   */
  private async getEpochStats(epoch: string, startDate: Date, endDate: Date): Promise<EpochStats> {
    // Stats des clicks pour la période
    const clickStats = await db
      .select({
        totalClicks: sql<number>`count(*)`,
        eligibleClicks: sql<number>`count(*) filter (where is_reward_eligible = true)`,
      })
      .from(iasClickTracking)
      .where(and(
        gte(iasClickTracking.clickedAt, startDate),
        lte(iasClickTracking.clickedAt, endDate)
      ));

    // Stats des rewards calculés
    const rewardStats = await db
      .select({
        totalRewardAmount: sql<number>`coalesce(sum(cast(reward_amount as decimal)), 0)`,
        affiliatesCount: sql<number>`count(*)`
      })
      .from(iasRewards)
      .where(eq(iasRewards.epoch, epoch));

    return {
      epoch,
      startDate,
      endDate,
      totalClicks: Number(clickStats[0]?.totalClicks || 0),
      eligibleClicks: Number(clickStats[0]?.eligibleClicks || 0),
      totalRewardAmount: Number(rewardStats[0]?.totalRewardAmount || 0),
      affiliatesCount: Number(rewardStats[0]?.affiliatesCount || 0)
    };
  }

  /**
   * Obtenir l'époque actuelle (aujourd'hui)
   */
  getCurrentEpoch(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // Format YYYY-MM-DD
  }

  /**
   * Obtenir les rewards en attente de distribution pour un utilisateur
   */
  async getPendingRewards(userId: string): Promise<{
    rewards: Array<{
      epoch: string;
      amount: number;
      status: string;
      clicksCount: number;
    }>;
    totalPending: number;
  }> {
    const pendingRewards = await db
      .select({
        epoch: iasRewards.epoch,
        amount: iasRewards.rewardAmount,
        status: iasRewards.status,
        clicksCount: iasRewards.validClicksCount
      })
      .from(iasRewards)
      .where(and(
        eq(iasRewards.userId, userId),
        eq(iasRewards.status, 'calculated')
      ))
      .orderBy(desc(iasRewards.createdAt));

    const rewards = pendingRewards.map(r => ({
      epoch: r.epoch,
      amount: parseFloat(r.amount),
      status: r.status,
      clicksCount: r.clicksCount
    }));

    const totalPending = rewards.reduce((sum, r) => sum + r.amount, 0);

    return { rewards, totalPending };
  }
}

export const iasRewardCalculator = new IASRewardCalculator();