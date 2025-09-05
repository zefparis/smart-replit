import { CronJob } from 'cron';
import { EventEmitter } from 'events';
import { db } from '../db';
import { iasRewards, iasTransactions, settings } from '@shared/schema';
import { eq, sql, gte, count, sum } from 'drizzle-orm';
import { iasRewardCalculator } from '../ias/reward-calculator';
import { iasDistributionService } from '../ias/distribution-service';

export interface BatchConfig {
  enabled: boolean;
  scheduleExpression: string; // cron expression
  minRewardThreshold: number; // Minimum IAS amount to trigger batch
  minUserCount: number; // Minimum number of users to trigger batch
  maxGasCostUsd: number; // Maximum gas cost in USD
  timeBetweenBatchesHours: number; // Minimum hours between batches
}

export interface BatchMetrics {
  totalBatchesExecuted: number;
  totalRewardsDistributed: number;
  totalUsersRewarded: number;
  lastBatchTimestamp: Date | null;
  averageBatchSize: number;
  totalGasCostUsd: number;
}

export interface BatchExecutionResult {
  success: boolean;
  transactionHash?: string;
  rewardsDistributed: number;
  usersAffected: number;
  gasCostUsd: number;
  executionTime: number;
  error?: string;
}

/**
 * Automated Batch Processing System
 * Handles automatic reward distribution based on AI decisions and configured triggers
 */
export class AutomatedBatchProcessor extends EventEmitter {
  private config: BatchConfig;
  private cronJob?: CronJob;
  private metrics: BatchMetrics;
  private isProcessing: boolean = false;
  private lastHealthCheck: Date = new Date();

  constructor(config?: Partial<BatchConfig>) {
    super();
    
    this.config = {
      enabled: true,
      scheduleExpression: '0 */6 * * *', // Every 6 hours
      minRewardThreshold: 10, // 10 IAS minimum
      minUserCount: 5, // 5 users minimum
      maxGasCostUsd: 50, // $50 max gas cost
      timeBetweenBatchesHours: 4, // 4 hours minimum between batches
      ...config,
    };

    this.metrics = {
      totalBatchesExecuted: 0,
      totalRewardsDistributed: 0,
      totalUsersRewarded: 0,
      lastBatchTimestamp: null,
      averageBatchSize: 0,
      totalGasCostUsd: 0,
    };

    console.log('[BATCH-PROCESSOR] Initialized with config:', this.config);
  }

  /**
   * Start the automated batch processor
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[BATCH-PROCESSOR] Disabled by configuration');
      return;
    }

    try {
      // Load existing metrics from database
      await this.loadMetrics();

      // Start cron job for scheduled batches
      this.cronJob = new CronJob(
        this.config.scheduleExpression,
        () => this.executeBatchCheck('scheduled'),
        null,
        true,
        'UTC'
      );

      console.log(`[BATCH-PROCESSOR] ✅ Started with schedule: ${this.config.scheduleExpression}`);
      this.emit('processor:started');

    } catch (error) {
      console.error('[BATCH-PROCESSOR] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the automated batch processor
   */
  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    console.log('[BATCH-PROCESSOR] ⏹️ Stopped');
    this.emit('processor:stopped');
  }

  /**
   * Execute batch distribution check and processing
   */
  async executeBatchCheck(trigger: 'scheduled' | 'threshold' | 'manual' = 'manual'): Promise<BatchExecutionResult> {
    if (this.isProcessing) {
      console.log('[BATCH-PROCESSOR] Already processing, skipping...');
      return {
        success: false,
        rewardsDistributed: 0,
        usersAffected: 0,
        gasCostUsd: 0,
        executionTime: 0,
        error: 'Already processing',
      };
    }

    const startTime = Date.now();
    this.isProcessing = true;

    try {
      console.log(`[BATCH-PROCESSOR] 🔍 Executing batch check (trigger: ${trigger})`);

      // 1. Check if enough time has passed since last batch
      if (this.metrics.lastBatchTimestamp) {
        const hoursSinceLastBatch = (Date.now() - this.metrics.lastBatchTimestamp.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastBatch < this.config.timeBetweenBatchesHours) {
          console.log(`[BATCH-PROCESSOR] ⏰ Too soon since last batch (${hoursSinceLastBatch.toFixed(1)}h < ${this.config.timeBetweenBatchesHours}h)`);
          return {
            success: false,
            rewardsDistributed: 0,
            usersAffected: 0,
            gasCostUsd: 0,
            executionTime: Date.now() - startTime,
            error: 'Too soon since last batch',
          };
        }
      }

      // 2. Analyze pending rewards
      const analysis = await this.analyzePendingRewards();
      
      if (!analysis.shouldExecute) {
        console.log(`[BATCH-PROCESSOR] ❌ Batch not triggered: ${analysis.reason}`);
        return {
          success: false,
          rewardsDistributed: 0,
          usersAffected: 0,
          gasCostUsd: 0,
          executionTime: Date.now() - startTime,
          error: analysis.reason,
        };
      }

      // 3. Calculate current epoch rewards
      const currentEpoch = new Date().toISOString().split('T')[0];
      const rewardCalculation = await iasRewardCalculator.calculateEpochRewards(currentEpoch);

      if (!rewardCalculation.success || rewardCalculation.affiliateRewards.length === 0) {
        console.log('[BATCH-PROCESSOR] ❌ No rewards to distribute');
        return {
          success: false,
          rewardsDistributed: 0,
          usersAffected: 0,
          gasCostUsd: 0,
          executionTime: Date.now() - startTime,
          error: 'No rewards to distribute',
        };
      }

      // 4. Estimate gas costs
      const gasCostEstimate = this.estimateGasCost(rewardCalculation.affiliateRewards.length);
      
      if (gasCostEstimate > this.config.maxGasCostUsd) {
        console.log(`[BATCH-PROCESSOR] ❌ Gas cost too high: $${gasCostEstimate} > $${this.config.maxGasCostUsd}`);
        return {
          success: false,
          rewardsDistributed: 0,
          usersAffected: 0,
          gasCostUsd: gasCostEstimate,
          executionTime: Date.now() - startTime,
          error: `Gas cost too high: $${gasCostEstimate}`,
        };
      }

      // 5. Execute batch distribution
      console.log(`[BATCH-PROCESSOR] 🚀 Executing batch distribution for ${rewardCalculation.affiliateRewards.length} users`);
      
      const walletAddresses = rewardCalculation.affiliateRewards.map(r => r.walletAddress);
      const amounts = rewardCalculation.affiliateRewards.map(r => r.rewardAmount.toString());
      
      const distributionResult = await iasDistributionService.batchDistributeRewards(
        walletAddresses,
        amounts,
        currentEpoch
      );

      if (distributionResult.success) {
        // Update metrics
        await this.updateMetrics({
          batchesExecuted: 1,
          rewardsDistributed: distributionResult.distributedAmount || 0,
          usersRewarded: distributionResult.affiliatesCount || 0,
          gasCostUsd: gasCostEstimate,
        });

        console.log(`[BATCH-PROCESSOR] ✅ Batch executed successfully: ${distributionResult.transactionHash}`);
        
        this.emit('batch:executed', {
          transactionHash: distributionResult.transactionHash,
          rewardsDistributed: distributionResult.distributedAmount,
          usersAffected: distributionResult.affiliatesCount,
          trigger,
        });

        return {
          success: true,
          transactionHash: distributionResult.transactionHash,
          rewardsDistributed: distributionResult.distributedAmount || 0,
          usersAffected: distributionResult.affiliatesCount || 0,
          gasCostUsd: gasCostEstimate,
          executionTime: Date.now() - startTime,
        };

      } else {
        console.error('[BATCH-PROCESSOR] ❌ Batch distribution failed:', distributionResult.error);
        
        this.emit('batch:failed', {
          error: distributionResult.error,
          trigger,
        });

        return {
          success: false,
          rewardsDistributed: 0,
          usersAffected: 0,
          gasCostUsd: gasCostEstimate,
          executionTime: Date.now() - startTime,
          error: distributionResult.error,
        };
      }

    } catch (error: any) {
      console.error('[BATCH-PROCESSOR] ❌ Batch execution failed:', error);
      
      this.emit('batch:error', {
        error: error.message,
        trigger,
      });

      return {
        success: false,
        rewardsDistributed: 0,
        usersAffected: 0,
        gasCostUsd: 0,
        executionTime: Date.now() - startTime,
        error: error.message,
      };

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if batch should be triggered based on threshold
   */
  async checkThresholdTrigger(): Promise<boolean> {
    const analysis = await this.analyzePendingRewards();
    return analysis.shouldExecute && analysis.trigger === 'threshold';
  }

  /**
   * Get current batch processor status
   */
  getStatus(): {
    isEnabled: boolean;
    isProcessing: boolean;
    config: BatchConfig;
    metrics: BatchMetrics;
    nextScheduledRun: Date | null;
    lastHealthCheck: Date;
  } {
    return {
      isEnabled: this.config.enabled,
      isProcessing: this.isProcessing,
      config: this.config,
      metrics: this.metrics,
      nextScheduledRun: this.cronJob?.nextDate()?.toDate() || null,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<BatchConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cron job if schedule changed
    if (newConfig.scheduleExpression && this.cronJob) {
      this.cronJob.stop();
      if (this.config.enabled) {
        this.cronJob = new CronJob(
          this.config.scheduleExpression,
          () => this.executeBatchCheck('scheduled'),
          null,
          true,
          'UTC'
        );
      }
    }

    console.log('[BATCH-PROCESSOR] Configuration updated:', newConfig);
    this.emit('config:updated', this.config);
  }

  // Private methods
  private async analyzePendingRewards(): Promise<{
    shouldExecute: boolean;
    reason: string;
    trigger: 'threshold' | 'time' | 'users';
    totalRewards: number;
    userCount: number;
  }> {
    try {
      // Get pending rewards data
      const pendingData = await db
        .select({
          totalAmount: sum(iasRewards.rewardAmount),
          userCount: count(iasRewards.userId),
        })
        .from(iasRewards)
        .where(eq(iasRewards.status, 'calculated'));

      const totalRewards = parseFloat(pendingData[0]?.totalAmount || '0');
      const userCount = parseInt(pendingData[0]?.userCount || '0');

      // Check thresholds
      if (totalRewards >= this.config.minRewardThreshold) {
        return {
          shouldExecute: true,
          reason: `Reward threshold reached: ${totalRewards} IAS >= ${this.config.minRewardThreshold} IAS`,
          trigger: 'threshold',
          totalRewards,
          userCount,
        };
      }

      if (userCount >= this.config.minUserCount) {
        return {
          shouldExecute: true,
          reason: `User threshold reached: ${userCount} users >= ${this.config.minUserCount}`,
          trigger: 'users',
          totalRewards,
          userCount,
        };
      }

      // Check time-based trigger (if scheduled run)
      const hoursSinceLastBatch = this.metrics.lastBatchTimestamp ? 
        (Date.now() - this.metrics.lastBatchTimestamp.getTime()) / (1000 * 60 * 60) : 24;

      if (hoursSinceLastBatch >= 24 && userCount > 0) {
        return {
          shouldExecute: true,
          reason: `24+ hours since last batch with ${userCount} pending users`,
          trigger: 'time',
          totalRewards,
          userCount,
        };
      }

      return {
        shouldExecute: false,
        reason: `Thresholds not met: ${totalRewards} IAS < ${this.config.minRewardThreshold}, ${userCount} users < ${this.config.minUserCount}`,
        trigger: 'threshold',
        totalRewards,
        userCount,
      };

    } catch (error) {
      console.error('[BATCH-PROCESSOR] Analysis failed:', error);
      return {
        shouldExecute: false,
        reason: 'Analysis failed',
        trigger: 'threshold',
        totalRewards: 0,
        userCount: 0,
      };
    }
  }

  private estimateGasCost(userCount: number): number {
    // Conservative gas cost estimation
    const baseGas = 21000; // Base transaction cost
    const perUserGas = 50000; // Estimated gas per user in batch
    const totalGas = baseGas + (userCount * perUserGas);
    
    // Estimate cost at current gas prices (simplified)
    const gasPriceGwei = 20; // Conservative estimate
    const ethPriceUsd = 2500; // Conservative estimate
    
    const gasCostEth = (totalGas * gasPriceGwei) / 1e9;
    const gasCostUsd = gasCostEth * ethPriceUsd;
    
    return Math.round(gasCostUsd * 100) / 100;
  }

  private async loadMetrics(): Promise<void> {
    try {
      // Load metrics from database settings
      const metricsData = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'batch_processor_metrics'));

      if (metricsData.length > 0) {
        const storedMetrics = JSON.parse(metricsData[0].value);
        this.metrics = {
          ...this.metrics,
          ...storedMetrics,
          lastBatchTimestamp: storedMetrics.lastBatchTimestamp ? 
            new Date(storedMetrics.lastBatchTimestamp) : null,
        };
      }

      console.log('[BATCH-PROCESSOR] Metrics loaded:', this.metrics);

    } catch (error) {
      console.error('[BATCH-PROCESSOR] Failed to load metrics:', error);
    }
  }

  private async updateMetrics(delta: {
    batchesExecuted: number;
    rewardsDistributed: number;
    usersRewarded: number;
    gasCostUsd: number;
  }): Promise<void> {
    try {
      // Update metrics
      this.metrics.totalBatchesExecuted += delta.batchesExecuted;
      this.metrics.totalRewardsDistributed += delta.rewardsDistributed;
      this.metrics.totalUsersRewarded += delta.usersRewarded;
      this.metrics.totalGasCostUsd += delta.gasCostUsd;
      this.metrics.lastBatchTimestamp = new Date();
      
      if (this.metrics.totalBatchesExecuted > 0) {
        this.metrics.averageBatchSize = this.metrics.totalUsersRewarded / this.metrics.totalBatchesExecuted;
      }

      // Save to database
      await db
        .insert(settings)
        .values({
          key: 'batch_processor_metrics',
          value: JSON.stringify(this.metrics),
          category: 'system',
          description: 'Automated batch processor metrics',
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: JSON.stringify(this.metrics),
          },
        });

      console.log('[BATCH-PROCESSOR] Metrics updated:', this.metrics);
      this.emit('metrics:updated', this.metrics);

    } catch (error) {
      console.error('[BATCH-PROCESSOR] Failed to update metrics:', error);
    }
  }
}

// Global singleton instance
export const automatedBatchProcessor = new AutomatedBatchProcessor();