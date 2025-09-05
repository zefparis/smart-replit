import { EventEmitter } from 'events';
import { db } from '../db';
import { 
  iasClickTracking, 
  iasRewards, 
  iasTransactions, 
  scrapers, 
  smartLinks,
  users,
  aiLogs,
  settings
} from '@shared/schema';
import { eq, sql, desc, gte, count, sum, avg } from 'drizzle-orm';
import { iasClickTracker } from '../ias/click-tracking';
import { iasRewardCalculator } from '../ias/reward-calculator';
import { iasDistributionService } from '../ias/distribution-service';
import { automatedBatchProcessor } from './batch-processor';

export interface SupervisorConfig {
  // Fraud Detection AI
  aiAnomalyThreshold: number;
  aiConfidenceThreshold: number;
  autoBlockSuspiciousIPs: boolean;
  
  // Automatic Distribution
  batchDistributionThreshold: number; // USD amount to trigger batch
  batchDistributionSchedule: string; // cron expression
  minRewardAmount: number; // Minimum IAS to distribute
  
  // Health Monitoring
  healthCheckIntervalMs: number;
  alertThresholds: {
    scraperFailureRate: number;
    databaseResponseTime: number;
    blockchainSyncDelay: number;
  };
  
  // AI Decision Making
  autoApproveRewards: boolean;
  aiDecisionLogging: boolean;
  preventiveActionEnabled: boolean;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    database: 'online' | 'slow' | 'offline';
    blockchain: 'synced' | 'syncing' | 'disconnected';
    scrapers: 'running' | 'partial' | 'stopped';
    aiModels: 'available' | 'limited' | 'unavailable';
  };
  metrics: {
    totalClicks24h: number;
    fraudDetectionRate: number;
    rewardsPending: number;
    systemUptime: number;
  };
  lastChecked: Date;
}

export interface AIDecision {
  id: string;
  type: 'fraud_detection' | 'reward_approval' | 'batch_trigger' | 'anomaly_response';
  confidence: number;
  decision: string;
  reasoning: string[];
  actions: string[];
  timestamp: Date;
  executedActions: string[];
}

export interface SupervisorMetrics {
  clicksProcessed: number;
  fraudDetected: number;
  rewardsDistributed: number;
  aiDecisionsMade: number;
  systemAlertsTriggered: number;
  uptime: number;
}

/**
 * DG AI Supervisor - Central orchestration for affiliate management
 * Handles fraud detection, reward distribution, health monitoring and AI decision making
 */
export class DGAISupervisor extends EventEmitter {
  private config: SupervisorConfig;
  private isRunning: boolean = false;
  private healthStatus: HealthStatus;
  private metrics: SupervisorMetrics;
  private aiDecisionHistory: AIDecision[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private batchCheckInterval?: NodeJS.Timeout;

  constructor(config?: Partial<SupervisorConfig>) {
    super();
    
    this.config = {
      // Default configuration
      aiAnomalyThreshold: 0.85,
      aiConfidenceThreshold: 0.75,
      autoBlockSuspiciousIPs: true,
      batchDistributionThreshold: 100, // $100 worth of rewards
      batchDistributionSchedule: '0 */6 * * *', // Every 6 hours
      minRewardAmount: 0.1, // 0.1 IAS minimum
      healthCheckIntervalMs: 30000, // 30 seconds
      alertThresholds: {
        scraperFailureRate: 0.2, // 20%
        databaseResponseTime: 1000, // 1 second
        blockchainSyncDelay: 300, // 5 minutes
      },
      autoApproveRewards: true,
      aiDecisionLogging: true,
      preventiveActionEnabled: true,
      ...config,
    };

    this.healthStatus = this.initializeHealthStatus();
    this.metrics = this.initializeMetrics();
    
    console.log('[DG-AI-SUPERVISOR] Initialized with config:', this.config);
  }

  /**
   * Start the DG AI Supervisor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[DG-AI-SUPERVISOR] Already running');
      return;
    }

    try {
      console.log('[DG-AI-SUPERVISOR] Starting autonomous orchestration...');
      
      // Log startup
      await this.logAIDecision({
        type: 'batch_trigger',
        confidence: 1.0,
        decision: 'System startup initiated',
        reasoning: ['DG AI Supervisor initialization'],
        actions: ['Start health monitoring', 'Initialize fraud detection', 'Enable batch processing'],
      });

      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start batch distribution checking
      this.startBatchProcessing();
      
      // Start automated batch processor
      await automatedBatchProcessor.start();
      
      // Initialize fraud detection enhancement
      await this.initializeAIFraudDetection();
      
      this.isRunning = true;
      this.emit('supervisor:started');
      
      console.log('[DG-AI-SUPERVISOR] ✅ Autonomous system operational');
      
    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the DG AI Supervisor
   */
  async stop(): Promise<void> {
    console.log('[DG-AI-SUPERVISOR] Stopping autonomous orchestration...');
    
    this.isRunning = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.batchCheckInterval) {
      clearInterval(this.batchCheckInterval);
    }
    
    // Stop automated batch processor
    await automatedBatchProcessor.stop();

    await this.logAIDecision({
      type: 'batch_trigger',
      confidence: 1.0,
      decision: 'System shutdown initiated',
      reasoning: ['Manual stop requested'],
      actions: ['Stop health monitoring', 'Pause batch processing', 'Save current state'],
    });

    this.emit('supervisor:stopped');
    console.log('[DG-AI-SUPERVISOR] ⏹️ System stopped');
  }

  /**
   * Enhanced fraud detection with AI scoring
   */
  async analyzeClickWithAI(clickData: any): Promise<{
    aiScore: number;
    confidence: number;
    recommendations: string[];
    shouldBlock: boolean;
  }> {
    try {
      // Analyze click patterns with AI
      const recentClicks = await this.getRecentClickPatterns(clickData.ipAddress, clickData.sessionId);
      const historicalData = await this.getHistoricalFraudData();
      
      // AI scoring algorithm
      let aiScore = 0;
      let confidence = 0.5;
      const recommendations: string[] = [];

      // Pattern analysis
      if (recentClicks.velocityScore > 0.8) {
        aiScore += 0.3;
        recommendations.push('High click velocity detected');
      }

      if (recentClicks.geographicAnomalies > 0.5) {
        aiScore += 0.25;
        recommendations.push('Geographic anomalies detected');
      }

      // Behavioral analysis
      if (recentClicks.sessionConsistency < 0.3) {
        aiScore += 0.2;
        recommendations.push('Inconsistent session behavior');
      }

      // Historical comparison
      if (historicalData.similarPatternsFound) {
        aiScore += 0.25;
        confidence += 0.3;
        recommendations.push('Similar fraud patterns found in history');
      }

      confidence = Math.min(confidence + (aiScore * 0.5), 1.0);
      
      const shouldBlock = aiScore > this.config.aiAnomalyThreshold && 
                         confidence > this.config.aiConfidenceThreshold;

      // Log AI decision
      if (shouldBlock || aiScore > 0.5) {
        await this.logAIDecision({
          type: 'fraud_detection',
          confidence,
          decision: shouldBlock ? 'Block click' : 'Allow with monitoring',
          reasoning: recommendations,
          actions: shouldBlock ? ['Block IP', 'Flag session', 'Increase monitoring'] : ['Monitor closely'],
        });
      }

      return {
        aiScore,
        confidence,
        recommendations,
        shouldBlock,
      };

    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] AI analysis failed:', error);
      return {
        aiScore: 0,
        confidence: 0,
        recommendations: ['AI analysis failed'],
        shouldBlock: false,
      };
    }
  }

  /**
   * Automated batch distribution decision making
   */
  async evaluateBatchDistribution(): Promise<{
    shouldTriggerBatch: boolean;
    reasoning: string[];
    estimatedRewards: number;
    affectedUsers: number;
  }> {
    try {
      // Get pending rewards data
      const pendingRewards = await db
        .select({
          totalAmount: sum(iasRewards.rewardAmount),
          userCount: count(iasRewards.userId),
        })
        .from(iasRewards)
        .where(eq(iasRewards.status, 'calculated'));

      const totalAmount = parseFloat(pendingRewards[0]?.totalAmount || '0');
      const userCount = parseInt(pendingRewards[0]?.userCount || '0');

      // AI decision logic
      const reasoning: string[] = [];
      let shouldTriggerBatch = false;

      // Threshold check
      if (totalAmount >= this.config.batchDistributionThreshold) {
        shouldTriggerBatch = true;
        reasoning.push(`Reward threshold reached: $${totalAmount}`);
      }

      // Time-based check
      const lastBatch = await this.getLastBatchDistribution();
      const hoursSinceLastBatch = lastBatch ? 
        (Date.now() - lastBatch.getTime()) / (1000 * 60 * 60) : 24;

      if (hoursSinceLastBatch >= 24) {
        shouldTriggerBatch = true;
        reasoning.push(`24+ hours since last batch (${hoursSinceLastBatch.toFixed(1)}h)`);
      }

      // User engagement check
      if (userCount >= 10) {
        shouldTriggerBatch = true;
        reasoning.push(`High user engagement: ${userCount} users`);
      }

      // Log decision
      await this.logAIDecision({
        type: 'batch_trigger',
        confidence: 0.9,
        decision: shouldTriggerBatch ? 'Trigger batch distribution' : 'Wait for better conditions',
        reasoning,
        actions: shouldTriggerBatch ? ['Prepare batch transaction', 'Calculate gas costs', 'Execute distribution'] : ['Continue monitoring'],
      });

      return {
        shouldTriggerBatch,
        reasoning,
        estimatedRewards: totalAmount,
        affectedUsers: userCount,
      };

    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] Batch evaluation failed:', error);
      return {
        shouldTriggerBatch: false,
        reasoning: ['Evaluation failed'],
        estimatedRewards: 0,
        affectedUsers: 0,
      };
    }
  }

  /**
   * System health monitoring with AI insights
   */
  async performHealthCheck(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      
      // Database health
      const dbHealth = await this.checkDatabaseHealth();
      
      // Blockchain health
      const blockchainHealth = await this.checkBlockchainHealth();
      
      // Scrapers health
      const scrapersHealth = await this.checkScrapersHealth();
      
      // AI models health
      const aiHealth = await this.checkAIModelsHealth();
      
      // Calculate metrics
      const metrics = await this.calculateSystemMetrics();
      
      const responseTime = Date.now() - startTime;
      
      // Determine overall health
      let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (dbHealth === 'offline' || blockchainHealth === 'disconnected') {
        overall = 'critical';
      } else if (dbHealth === 'slow' || scrapersHealth === 'partial' || blockchainHealth === 'syncing') {
        overall = 'warning';
      }

      this.healthStatus = {
        overall,
        components: {
          database: dbHealth,
          blockchain: blockchainHealth,
          scrapers: scrapersHealth,
          aiModels: aiHealth,
        },
        metrics,
        lastChecked: new Date(),
      };

      // Auto-response to health issues
      if (overall === 'critical' && this.config.preventiveActionEnabled) {
        await this.handleCriticalHealth();
      }

      this.emit('health:updated', this.healthStatus);
      return this.healthStatus;

    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] Health check failed:', error);
      return this.healthStatus;
    }
  }

  /**
   * Get current supervisor status
   */
  getStatus(): {
    isRunning: boolean;
    health: HealthStatus;
    metrics: SupervisorMetrics;
    recentDecisions: AIDecision[];
  } {
    return {
      isRunning: this.isRunning,
      health: this.healthStatus,
      metrics: this.metrics,
      recentDecisions: this.aiDecisionHistory.slice(-10),
    };
  }

  // Private helper methods
  private async initializeAIFraudDetection(): Promise<void> {
    // Initialize AI fraud detection models
    console.log('[DG-AI-SUPERVISOR] Initializing AI fraud detection...');
    // This would integrate with your AI models
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private startBatchProcessing(): void {
    // Check for batch distribution every 5 minutes
    this.batchCheckInterval = setInterval(async () => {
      const evaluation = await this.evaluateBatchDistribution();
      
      if (evaluation.shouldTriggerBatch && this.config.autoApproveRewards) {
        await this.triggerBatchDistribution(evaluation);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async triggerBatchDistribution(evaluation: any): Promise<void> {
    try {
      console.log('[DG-AI-SUPERVISOR] 🚀 Triggering autonomous batch distribution');
      
      // Calculate current epoch
      const currentEpoch = new Date().toISOString().split('T')[0];
      
      // Calculate rewards for current epoch
      const rewardCalculation = await iasRewardCalculator.calculateEpochRewards(currentEpoch);
      
      if (rewardCalculation.success && rewardCalculation.affiliateRewards.length > 0) {
        // Execute batch distribution
        const result = await iasDistributionService.batchDistributeRewards(
          rewardCalculation.affiliateRewards.map(r => r.walletAddress),
          rewardCalculation.affiliateRewards.map(r => r.rewardAmount.toString()),
          currentEpoch
        );

        await this.logAIDecision({
          type: 'batch_trigger',
          confidence: 0.95,
          decision: 'Batch distribution executed',
          reasoning: evaluation.reasoning,
          actions: ['Batch transaction submitted', 'Rewards distributed', 'Users notified'],
        });

        this.metrics.rewardsDistributed += rewardCalculation.affiliateRewards.length;
        this.emit('batch:distributed', result);
      }

    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] Batch distribution failed:', error);
      
      await this.logAIDecision({
        type: 'batch_trigger',
        confidence: 0.8,
        decision: 'Batch distribution failed',
        reasoning: ['Execution error'],
        actions: ['Log error', 'Retry later', 'Alert administrators'],
      });
    }
  }

  private async getRecentClickPatterns(ipAddress?: string, sessionId?: string): Promise<any> {
    // Analyze recent click patterns for AI scoring
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const clickData = await db
      .select()
      .from(iasClickTracking)
      .where(
        ipAddress ? eq(iasClickTracking.ipAddress, ipAddress) : 
        sessionId ? eq(iasClickTracking.sessionId, sessionId) : 
        gte(iasClickTracking.clickedAt, oneHourAgo)
      )
      .orderBy(desc(iasClickTracking.clickedAt))
      .limit(100);

    // Calculate patterns
    return {
      velocityScore: Math.min(clickData.length / 10, 1.0),
      geographicAnomalies: this.calculateGeographicAnomalies(clickData),
      sessionConsistency: this.calculateSessionConsistency(clickData),
    };
  }

  private calculateGeographicAnomalies(clicks: any[]): number {
    const countries = new Set(clicks.map(c => c.country).filter(Boolean));
    return countries.size > 3 ? 1.0 : countries.size / 3;
  }

  private calculateSessionConsistency(clicks: any[]): number {
    const userAgents = new Set(clicks.map(c => c.userAgent).filter(Boolean));
    return userAgents.size === 1 ? 1.0 : 1.0 / userAgents.size;
  }

  private async getHistoricalFraudData(): Promise<any> {
    // Get historical fraud patterns for comparison
    const fraudClicks = await db
      .select()
      .from(iasClickTracking)
      .where(eq(iasClickTracking.isValid, false))
      .limit(1000);

    return {
      similarPatternsFound: fraudClicks.length > 0,
      totalFraudSamples: fraudClicks.length,
    };
  }

  private async getLastBatchDistribution(): Promise<Date | null> {
    const lastTransaction = await db
      .select()
      .from(iasTransactions)
      .where(eq(iasTransactions.transactionType, 'reward_distribution'))
      .orderBy(desc(iasTransactions.createdAt))
      .limit(1);

    return lastTransaction[0]?.createdAt || null;
  }

  private async checkDatabaseHealth(): Promise<'online' | 'slow' | 'offline'> {
    try {
      const start = Date.now();
      await db.select().from(users).limit(1);
      const responseTime = Date.now() - start;
      
      if (responseTime > this.config.alertThresholds.databaseResponseTime) {
        return 'slow';
      }
      return 'online';
    } catch {
      return 'offline';
    }
  }

  private async checkBlockchainHealth(): Promise<'synced' | 'syncing' | 'disconnected'> {
    try {
      // Check if blockchain service is available
      const info = await iasDistributionService.getContractInfo();
      return info ? 'synced' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  private async checkScrapersHealth(): Promise<'running' | 'partial' | 'stopped'> {
    try {
      const activeScrapers = await db
        .select({ count: count() })
        .from(scrapers)
        .where(eq(scrapers.isActive, true));

      const totalActive = activeScrapers[0]?.count || 0;
      
      if (totalActive === 0) return 'stopped';
      if (totalActive < 3) return 'partial'; // Assuming we want at least 3 scrapers
      return 'running';
    } catch {
      return 'stopped';
    }
  }

  private async checkAIModelsHealth(): Promise<'available' | 'limited' | 'unavailable'> {
    // Check AI model availability
    return 'available'; // Placeholder - implement actual AI model health check
  }

  private async calculateSystemMetrics(): Promise<any> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [clicksToday, fraudToday, pendingRewards] = await Promise.all([
      db.select({ count: count() }).from(iasClickTracking).where(gte(iasClickTracking.clickedAt, oneDayAgo)),
      db.select({ count: count() }).from(iasClickTracking).where(
        sql`${iasClickTracking.clickedAt} >= ${oneDayAgo} AND ${iasClickTracking.isValid} = false`
      ),
      db.select({ count: count() }).from(iasRewards).where(eq(iasRewards.status, 'calculated'))
    ]);

    return {
      totalClicks24h: clicksToday[0]?.count || 0,
      fraudDetectionRate: fraudToday[0]?.count || 0,
      rewardsPending: pendingRewards[0]?.count || 0,
      systemUptime: this.isRunning ? Date.now() - (this.metrics?.uptime || Date.now()) : 0,
    };
  }

  private async handleCriticalHealth(): Promise<void> {
    console.warn('[DG-AI-SUPERVISOR] 🚨 Critical health detected - initiating preventive actions');
    
    await this.logAIDecision({
      type: 'anomaly_response',
      confidence: 0.95,
      decision: 'Activate emergency protocols',
      reasoning: ['Critical system health detected'],
      actions: ['Reduce load', 'Alert administrators', 'Enable safe mode'],
    });

    this.emit('health:critical', this.healthStatus);
  }

  private async logAIDecision(decision: Omit<AIDecision, 'id' | 'timestamp' | 'executedActions'>): Promise<void> {
    if (!this.config.aiDecisionLogging) return;

    const aiDecision: AIDecision = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      executedActions: [],
      ...decision,
    };

    this.aiDecisionHistory.push(aiDecision);
    
    // Keep only last 100 decisions in memory
    if (this.aiDecisionHistory.length > 100) {
      this.aiDecisionHistory = this.aiDecisionHistory.slice(-100);
    }

    // Log to database
    try {
      await db.insert(aiLogs).values({
        level: 'info',
        message: `AI Decision: ${aiDecision.decision}`,
        source: 'dg-ai-supervisor',
        modelName: 'dg-ai-supervisor-v1',
      });
    } catch (error) {
      console.error('[DG-AI-SUPERVISOR] Failed to log AI decision:', error);
    }

    this.emit('ai:decision', aiDecision);
  }

  private initializeHealthStatus(): HealthStatus {
    return {
      overall: 'healthy',
      components: {
        database: 'online',
        blockchain: 'synced',
        scrapers: 'running',
        aiModels: 'available',
      },
      metrics: {
        totalClicks24h: 0,
        fraudDetectionRate: 0,
        rewardsPending: 0,
        systemUptime: 0,
      },
      lastChecked: new Date(),
    };
  }

  private initializeMetrics(): SupervisorMetrics {
    return {
      clicksProcessed: 0,
      fraudDetected: 0,
      rewardsDistributed: 0,
      aiDecisionsMade: 0,
      systemAlertsTriggered: 0,
      uptime: Date.now(),
    };
  }
}

// Global singleton instance
export const dgAISupervisor = new DGAISupervisor();