import { ethers } from 'ethers';
import { db } from '../db';
import { iasRewards, iasTransactions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ABI pour le RewardDistributor contract
const REWARD_DISTRIBUTOR_ABI = [
  'function iasToken() view returns (address)',
  'function claimedRewards(address, uint256) view returns (bool)',
  'function totalDistributed(address) view returns (uint256)',
  'function globalTotalDistributed() view returns (uint256)',
  'function batchDistributeRewards(address[] calldata affiliates, uint256[] calldata amounts, uint256 epoch)',
  'function hasClaimedReward(address affiliate, uint256 epoch) view returns (bool)',
  'function getAffiliateTotal(address affiliate) view returns (uint256)',
  'event RewardDistributed(address indexed affiliate, uint256 amount, uint256 epoch)',
  'event BatchRewardDistributed(address[] affiliates, uint256[] amounts, uint256 epoch)'
];

// ABI pour le token IAS (ERC20)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export interface DistributionResult {
  success: boolean;
  transactionHash?: string;
  distributedAmount?: number;
  affiliatesCount?: number;
  error?: string;
}

export interface ContractInfo {
  tokenAddress: string;
  distributorAddress: string;
  totalDistributed: string;
  contractBalance: string;
  network: string;
}

export class IASDistributionService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private distributorContract: ethers.Contract;
  private tokenContract: ethers.Contract;

  constructor() {
    this.initializeContracts();
  }

  private initializeContracts() {
    try {
      // Configuration depuis les variables d'environnement
      const rpcUrl = process.env.IAS_RPC_URL;
      const privateKey = process.env.WALLET_PRIVATE_KEY;
      const distributorAddress = process.env.IAS_DISTRIBUTOR_ADDRESS;
      const tokenAddress = process.env.IAS_CONTRACT_ADDRESS;

      if (!rpcUrl || !privateKey || !distributorAddress || !tokenAddress) {
        console.warn('[IAS] Blockchain integration disabled - missing configuration');
        return;
      }

      // Initialiser le provider et signer
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Initialiser les contracts
      this.distributorContract = new ethers.Contract(
        distributorAddress,
        REWARD_DISTRIBUTOR_ABI,
        this.signer
      );

      this.tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.signer
      );

      console.log('[IAS] Blockchain integration initialized successfully');
      console.log(`[IAS] Token: ${tokenAddress}`);
      console.log(`[IAS] Distributor: ${distributorAddress}`);
      console.log(`[IAS] Network: ${rpcUrl}`);

    } catch (error) {
      console.error('[IAS] Failed to initialize blockchain contracts:', error);
    }
  }

  /**
   * Distribution en lot des rewards à multiple affiliés
   */
  async batchDistributeRewards(
    affiliateAddresses: string[],
    amounts: string[],
    epoch: string
  ): Promise<DistributionResult> {
    if (!this.distributorContract || !this.signer) {
      return {
        success: false,
        error: 'Blockchain integration not configured'
      };
    }

    try {
      console.log(`[IAS] Starting batch distribution for epoch ${epoch}`);
      console.log(`[IAS] Recipients: ${affiliateAddresses.length}`);
      
      // Convertir les montants en unités blockchain
      const parsedAmounts = amounts.map(amount => 
        ethers.parseUnits(amount, 18)
      );

      const epochNumber = parseInt(epoch.replace('-', '').replace('-', ''));

      // Estimer le gas requis
      const gasEstimate = await this.distributorContract.batchDistributeRewards.estimateGas(
        affiliateAddresses,
        parsedAmounts,
        epochNumber
      );

      console.log(`[IAS] Gas estimate: ${gasEstimate.toString()}`);

      // Exécuter la transaction
      const tx = await this.distributorContract.batchDistributeRewards(
        affiliateAddresses,
        parsedAmounts,
        epochNumber,
        {
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% de marge
        }
      );

      console.log(`[IAS] Transaction submitted: ${tx.hash}`);

      // Attendre la confirmation
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }

      // Calculer le montant total distribué
      const totalAmount = amounts.reduce((sum, amount) => sum + parseFloat(amount), 0);

      // Mettre à jour le statut en base de données
      await this.updateRewardStatus(affiliateAddresses, epoch, 'distributed', tx.hash);

      console.log(`[IAS] Batch distribution completed: ${tx.hash}`);

      return {
        success: true,
        transactionHash: tx.hash,
        distributedAmount: totalAmount,
        affiliatesCount: affiliateAddresses.length
      };

    } catch (error: any) {
      console.error('[IAS] Batch distribution failed:', error);
      return {
        success: false,
        error: error.message || 'Blockchain transaction failed'
      };
    }
  }

  /**
   * Générer une signature pour claim off-chain
   */
  async generateClaimSignature(
    userAddress: string,
    amount: string,
    epoch: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Blockchain integration not configured');
    }

    try {
      const parsedAmount = ethers.parseUnits(amount, 18);
      const epochNumber = parseInt(epoch.replace('-', '').replace('-', ''));
      const distributorAddress = process.env.IAS_DISTRIBUTOR_ADDRESS;

      // Créer le message à signer (même format que dans le smart contract)
      const message = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256', 'address'],
        [userAddress, parsedAmount, epochNumber, distributorAddress]
      );

      // Signer le message
      const signature = await this.signer.signMessage(ethers.getBytes(message));

      console.log(`[IAS] Generated signature for ${userAddress}: ${amount} IAS (epoch ${epoch})`);

      return signature;

    } catch (error: any) {
      console.error('[IAS] Signature generation failed:', error);
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }

  /**
   * Obtenir le solde IAS d'une adresse
   */
  async getWalletBalance(address: string): Promise<string> {
    if (!this.tokenContract) {
      throw new Error('Token contract not initialized');
    }

    try {
      const balance = await this.tokenContract.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    } catch (error: any) {
      console.error('[IAS] Get balance failed:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Obtenir les informations du contrat
   */
  async getContractInfo(): Promise<ContractInfo> {
    if (!this.distributorContract || !this.tokenContract) {
      return {
        tokenAddress: process.env.IAS_CONTRACT_ADDRESS || '',
        distributorAddress: process.env.IAS_DISTRIBUTOR_ADDRESS || '',
        totalDistributed: '0',
        contractBalance: '0',
        network: process.env.IAS_NETWORK_NAME || 'unknown'
      };
    }

    try {
      const [totalDistributed, contractBalance] = await Promise.all([
        this.distributorContract.globalTotalDistributed(),
        this.tokenContract.balanceOf(process.env.IAS_DISTRIBUTOR_ADDRESS)
      ]);

      return {
        tokenAddress: process.env.IAS_CONTRACT_ADDRESS || '',
        distributorAddress: process.env.IAS_DISTRIBUTOR_ADDRESS || '',
        totalDistributed: ethers.formatUnits(totalDistributed, 18),
        contractBalance: ethers.formatUnits(contractBalance, 18),
        network: process.env.IAS_NETWORK_NAME || 'unknown'
      };

    } catch (error: any) {
      console.error('[IAS] Get contract info failed:', error);
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * Vérifier si un reward a été claim pour une époque
   */
  async hasClaimedReward(userAddress: string, epoch: string): Promise<boolean> {
    if (!this.distributorContract) {
      throw new Error('Distributor contract not initialized');
    }

    try {
      const epochNumber = parseInt(epoch.replace('-', '').replace('-', ''));
      return await this.distributorContract.hasClaimedReward(userAddress, epochNumber);
    } catch (error: any) {
      console.error('[IAS] Check claimed reward failed:', error);
      return false;
    }
  }

  /**
   * Obtenir le total distribué pour un affilié
   */
  async getAffiliateTotal(userAddress: string): Promise<string> {
    if (!this.distributorContract) {
      throw new Error('Distributor contract not initialized');
    }

    try {
      const total = await this.distributorContract.getAffiliateTotal(userAddress);
      return ethers.formatUnits(total, 18);
    } catch (error: any) {
      console.error('[IAS] Get affiliate total failed:', error);
      throw new Error(`Failed to get affiliate total: ${error.message}`);
    }
  }

  /**
   * Mettre à jour le statut des rewards en base
   */
  private async updateRewardStatus(
    userAddresses: string[],
    epoch: string,
    status: 'distributed' | 'claimed' | 'failed',
    transactionHash?: string
  ): Promise<void> {
    try {
      for (const address of userAddresses) {
        const updateData: any = { status };
        
        if (status === 'distributed' && transactionHash) {
          updateData.distributedAt = new Date();
          updateData.transactionHash = transactionHash;
        } else if (status === 'claimed') {
          updateData.claimedAt = new Date();
        }

        await db
          .update(iasRewards)
          .set(updateData)
          .where(and(
            eq(iasRewards.walletAddress, address),
            eq(iasRewards.epoch, epoch)
          ));
      }

      console.log(`[IAS] Updated ${userAddresses.length} reward statuses to ${status}`);

    } catch (error) {
      console.error('[IAS] Failed to update reward status:', error);
    }
  }

  /**
   * Enregistrer une transaction blockchain en base
   */
  async logTransaction(
    userId: string,
    walletAddress: string,
    transactionHash: string,
    type: 'reward_distribution' | 'claim',
    amount: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(iasTransactions).values({
        userId,
        walletAddress,
        transactionHash,
        transactionType: type,
        amount,
        status: 'pending',
        metadata,
        createdAt: new Date()
      });

      console.log(`[IAS] Logged transaction: ${transactionHash}`);

    } catch (error) {
      console.error('[IAS] Failed to log transaction:', error);
    }
  }

  /**
   * Surveiller le statut d'une transaction et mettre à jour en base
   */
  async monitorTransaction(transactionHash: string): Promise<void> {
    if (!this.provider) return;

    try {
      const receipt = await this.provider.waitForTransaction(transactionHash);
      
      const status = receipt?.status === 1 ? 'confirmed' : 'failed';
      
      await db
        .update(iasTransactions)
        .set({
          status,
          blockNumber: receipt?.blockNumber,
          gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed) : null,
          confirmedAt: new Date()
        })
        .where(eq(iasTransactions.transactionHash, transactionHash));

      console.log(`[IAS] Transaction ${transactionHash} ${status}`);

    } catch (error) {
      console.error(`[IAS] Failed to monitor transaction ${transactionHash}:`, error);
    }
  }
}

export const iasDistributionService = new IASDistributionService();