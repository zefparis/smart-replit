import { db } from '../db';
import { storage } from '../storage';
import { iasClickTracking, smartLinks, users } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { dgAISupervisor } from '../dg-ai-supervisor/core';

export interface ClickTrackingData {
  smartLinkId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  city?: string;
}

export interface FraudDetectionResult {
  isValid: boolean;
  isRewardEligible: boolean;
  fraudScore: number;
  reasons: string[];
}

// Configuration pour la détection de fraude
const FRAUD_CONFIG = {
  MAX_CLICKS_PER_IP_HOUR: parseInt(process.env.IAS_MAX_CLICKS_PER_IP_HOUR || '10'),
  MAX_CLICKS_PER_SESSION_HOUR: parseInt(process.env.IAS_MAX_CLICKS_PER_SESSION_HOUR || '5'),
  MIN_TIME_BETWEEN_CLICKS: parseInt(process.env.IAS_MIN_TIME_BETWEEN_CLICKS || '30'), // secondes
  SUSPICIOUS_USER_AGENTS: [
    'bot', 'crawler', 'spider', 'scraper', 'headless',
    'phantom', 'selenium', 'automated', 'python', 'curl'
  ],
};

export class IASClickTracker {
  
  /**
   * Enregistrer un nouveau click avec validation anti-fraude
   */
  async trackClick(data: ClickTrackingData): Promise<{
    success: boolean;
    clickId?: string;
    fraudResult: FraudDetectionResult;
    rewardAmount?: number;
  }> {
    try {
      // Générer un sessionId si pas fourni
      const sessionId = this.generateSessionId(data.ipAddress, data.userAgent);
      
      // Validation anti-fraude avec AI
      const fraudResult = await this.detectFraud(data, sessionId);
      
      // Enhanced AI analysis si le superviseur est actif
      let aiAnalysis = null;
      if (dgAISupervisor.getStatus().isRunning) {
        try {
          aiAnalysis = await dgAISupervisor.analyzeClickWithAI({
            ...data,
            sessionId,
            fraudScore: fraudResult.fraudScore,
          });
          
          // Override fraud result if AI is more confident
          if (aiAnalysis.confidence > 0.8 && aiAnalysis.shouldBlock) {
            fraudResult.isValid = false;
            fraudResult.isRewardEligible = false;
            fraudResult.fraudScore = Math.max(fraudResult.fraudScore, aiAnalysis.aiScore * 100);
            fraudResult.reasons.push(...aiAnalysis.recommendations);
          }
        } catch (error) {
          console.warn('[IAS] AI analysis failed, using standard fraud detection:', error);
        }
      }
      
      // Calculer le montant de reward si éligible
      let rewardAmount = 0;
      if (fraudResult.isRewardEligible) {
        rewardAmount = parseFloat(process.env.IAS_REWARD_PER_CLICK || '0.25');
      }

      // Enregistrer le click dans la base
      const [clickRecord] = await db.insert(iasClickTracking).values({
        smartLinkId: data.smartLinkId,
        userId: data.userId,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent,
        referrer: data.referrer,
        country: data.country,
        city: data.city,
        isValid: fraudResult.isValid,
        isRewardEligible: fraudResult.isRewardEligible,
        fraudScore: fraudResult.fraudScore,
        sessionId: sessionId,
        clickedAt: new Date(),
      }).returning();

      console.log(`[IAS] Click tracked: ${clickRecord.id} - Valid: ${fraudResult.isValid}, Eligible: ${fraudResult.isRewardEligible}, Reward: ${rewardAmount}`);

      return {
        success: true,
        clickId: clickRecord.id,
        fraudResult,
        rewardAmount: fraudResult.isRewardEligible ? rewardAmount : 0,
      };

    } catch (error) {
      console.error('[IAS] Click tracking failed:', error);
      return {
        success: false,
        fraudResult: {
          isValid: false,
          isRewardEligible: false,
          fraudScore: 100,
          reasons: ['Database error']
        }
      };
    }
  }

  /**
   * Détection de fraude pour un click
   */
  private async detectFraud(data: ClickTrackingData, sessionId: string): Promise<FraudDetectionResult> {
    let fraudScore = 0;
    const reasons: string[] = [];
    
    try {
      // 1. Vérifier les clicks répétitifs par IP
      if (data.ipAddress) {
        const recentClicksFromIP = await this.getRecentClicksFromIP(data.ipAddress, 60); // dernière heure
        if (recentClicksFromIP > FRAUD_CONFIG.MAX_CLICKS_PER_IP_HOUR) {
          fraudScore += 40;
          reasons.push(`Too many clicks from IP: ${recentClicksFromIP}`);
        }
      }

      // 2. Vérifier les clicks répétitifs par session
      const recentClicksFromSession = await this.getRecentClicksFromSession(sessionId, 60);
      if (recentClicksFromSession > FRAUD_CONFIG.MAX_CLICKS_PER_SESSION_HOUR) {
        fraudScore += 30;
        reasons.push(`Too many clicks from session: ${recentClicksFromSession}`);
      }

      // 3. Vérifier l'User-Agent suspect
      if (data.userAgent) {
        const isSuspiciousUA = FRAUD_CONFIG.SUSPICIOUS_USER_AGENTS.some(
          pattern => data.userAgent!.toLowerCase().includes(pattern.toLowerCase())
        );
        if (isSuspiciousUA) {
          fraudScore += 50;
          reasons.push('Suspicious user agent');
        }
      }

      // 4. Vérifier la rapidité entre clicks (même SmartLink + IP)
      if (data.ipAddress) {
        const lastClickTime = await this.getLastClickTime(data.smartLinkId, data.ipAddress);
        if (lastClickTime) {
          const timeDiff = (Date.now() - lastClickTime.getTime()) / 1000;
          if (timeDiff < FRAUD_CONFIG.MIN_TIME_BETWEEN_CLICKS) {
            fraudScore += 35;
            reasons.push(`Clicks too frequent: ${Math.round(timeDiff)}s`);
          }
        }
      }

      // 5. Vérifier si l'utilisateur existe (si fourni)
      if (data.userId) {
        const userExists = await this.verifyUser(data.userId);
        if (!userExists) {
          fraudScore += 25;
          reasons.push('Invalid user ID');
        }
      }

      // 6. Vérifier si le SmartLink existe et is actif
      const smartLinkExists = await this.verifySmartLink(data.smartLinkId);
      if (!smartLinkExists) {
        fraudScore += 100; // Invalide immédiatement
        reasons.push('Invalid SmartLink');
      }

    } catch (error) {
      console.error('[IAS] Fraud detection error:', error);
      fraudScore = 100;
      reasons.push('Detection system error');
    }

    return {
      isValid: fraudScore < 70,
      isRewardEligible: fraudScore < 30, // Plus strict pour rewards
      fraudScore: Math.min(fraudScore, 100),
      reasons
    };
  }

  /**
   * Obtenir les clicks récents depuis une IP
   */
  private async getRecentClicksFromIP(ipAddress: string, minutesAgo: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(iasClickTracking)
      .where(and(
        eq(iasClickTracking.ipAddress, ipAddress),
        gte(iasClickTracking.clickedAt, cutoffTime)
      ));
    
    return Number(result[0]?.count || 0);
  }

  /**
   * Obtenir les clicks récents depuis une session
   */
  private async getRecentClicksFromSession(sessionId: string, minutesAgo: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(iasClickTracking)
      .where(and(
        eq(iasClickTracking.sessionId, sessionId),
        gte(iasClickTracking.clickedAt, cutoffTime)
      ));
    
    return Number(result[0]?.count || 0);
  }

  /**
   * Obtenir le timestamp du dernier click pour un SmartLink + IP
   */
  private async getLastClickTime(smartLinkId: string, ipAddress: string): Promise<Date | null> {
    const result = await db
      .select({ clickedAt: iasClickTracking.clickedAt })
      .from(iasClickTracking)
      .where(and(
        eq(iasClickTracking.smartLinkId, smartLinkId),
        eq(iasClickTracking.ipAddress, ipAddress)
      ))
      .orderBy(desc(iasClickTracking.clickedAt))
      .limit(1);
    
    return result[0]?.clickedAt || null;
  }

  /**
   * Vérifier qu'un utilisateur existe
   */
  private async verifyUser(userId: string): Promise<boolean> {
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    return result.length > 0;
  }

  /**
   * Vérifier qu'un SmartLink existe et est actif
   */
  private async verifySmartLink(smartLinkId: string): Promise<boolean> {
    const result = await db
      .select({ id: smartLinks.id, status: smartLinks.status })
      .from(smartLinks)
      .where(eq(smartLinks.id, smartLinkId))
      .limit(1);
    
    return result.length > 0 && result[0].status === 'active';
  }

  /**
   * Générer un sessionId unique basé sur IP + UserAgent
   */
  private generateSessionId(ipAddress?: string, userAgent?: string): string {
    const data = `${ipAddress || 'unknown'}-${userAgent || 'unknown'}-${Date.now()}`;
    // Simple hash pour créer un sessionId
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `session_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Obtenir les statistiques de clicks pour une période
   */
  async getClickStats(startDate: Date, endDate: Date): Promise<{
    totalClicks: number;
    validClicks: number;
    eligibleClicks: number;
    averageFraudScore: number;
  }> {
    const result = await db
      .select({
        totalClicks: sql<number>`count(*)`,
        validClicks: sql<number>`count(*) filter (where is_valid = true)`,
        eligibleClicks: sql<number>`count(*) filter (where is_reward_eligible = true)`,
        averageFraudScore: sql<number>`avg(fraud_score)`
      })
      .from(iasClickTracking)
      .where(and(
        gte(iasClickTracking.clickedAt, startDate),
        lte(iasClickTracking.clickedAt, endDate)
      ));

    return {
      totalClicks: Number(result[0]?.totalClicks || 0),
      validClicks: Number(result[0]?.validClicks || 0),
      eligibleClicks: Number(result[0]?.eligibleClicks || 0),
      averageFraudScore: Number(result[0]?.averageFraudScore || 0),
    };
  }
}

export const iasClickTracker = new IASClickTracker();