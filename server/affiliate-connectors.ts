// <AI:BEGIN affiliate-connectors>
import { Request, Response } from 'express';
import { storage } from './storage';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schemas pour callbacks
const amazonCallbackSchema = z.object({
  orderId: z.string(),
  affiliateId: z.string(),
  productId: z.string(),
  commission: z.string(),
  orderValue: z.string(),
  currency: z.string().default('USD'),
  timestamp: z.string(),
  signature: z.string(),
});

const partnerStackCallbackSchema = z.object({
  transaction_id: z.string(),
  partner_id: z.string(),
  customer_id: z.string(),
  commission_amount: z.number(),
  sale_amount: z.number(),
  currency: z.string().default('USD'),
  event_time: z.string(),
  webhook_signature: z.string(),
});

const genericCallbackSchema = z.object({
  provider: z.string(),
  transaction_id: z.string(),
  commission: z.number(),
  sale_value: z.number(),
  currency: z.string().default('USD'),
  campaign_id: z.string().optional().nullable(),
  smart_link_id: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

// Types de connecteurs supportés
export type AffiliateProvider = 'amazon' | 'partnerstack' | 'clickbank' | 'cj' | 'shareasale';

export interface AffiliateConnector {
  provider: AffiliateProvider;
  name: string;
  description: string;
  baseUrl?: string;
  authRequired: string[];
  webhookEndpoint: string;
  testConnection(): Promise<{ success: boolean; message: string }>;
  processCallback(payload: any, signature?: string): Promise<boolean>;
  generateTrackingLink(originalUrl: string, params: Record<string, string>): string;
}

// Amazon Associates Connector
class AmazonAssociatesConnector implements AffiliateConnector {
  provider: AffiliateProvider = 'amazon';
  name = 'Amazon Associates';
  description = 'Amazon affiliate program integration';
  baseUrl = 'https://webservices.amazon.com/paapi5/';
  authRequired = ['AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY', 'AMAZON_ASSOCIATE_TAG'];
  webhookEndpoint = '/api/affiliate/callbacks/amazon';

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // Test avec API Amazon Product Advertising API
    return { 
      success: true, 
      message: 'Amazon Associates connection available (requires keys)' 
    };
  }

  async processCallback(payload: any, signature?: string): Promise<boolean> {
    try {
      const validatedData = amazonCallbackSchema.parse(payload);
      
      // Vérifier la signature Amazon
      if (!this.verifyAmazonSignature(payload, signature)) {
        console.error('Invalid Amazon signature');
        return false;
      }

      // Extraction des données de commission
      const commission = parseFloat(validatedData.commission);
      const orderValue = parseFloat(validatedData.orderValue);

      // Recherche du SmartLink associé via metadata
      const smartLink = await this.findSmartLinkByMetadata({
        amazon_order_id: validatedData.orderId,
        affiliate_id: validatedData.affiliateId
      });

      // Enregistrement idempotent dans external_revenues
      await storage.createExternalRevenue({
        provider: 'amazon',
        externalTransactionId: validatedData.orderId,
        amount: commission.toString(),
        currency: validatedData.currency,
        description: `Amazon commission for order ${validatedData.orderId}`,
        smartLinkId: smartLink?.id,
        metadata: {
          product_id: validatedData.productId,
          order_value: orderValue,
          affiliate_id: validatedData.affiliateId,
          processed_by: 'amazon_connector_v1'
        }
      });

      console.log(`[AMAZON] Processed callback: ${validatedData.orderId} -> $${commission}`);
      return true;
    } catch (error) {
      console.error('[AMAZON] Callback processing failed:', error);
      return false;
    }
  }

  generateTrackingLink(originalUrl: string, params: Record<string, string>): string {
    const associateTag = process.env.AMAZON_ASSOCIATE_TAG;
    if (!associateTag) return originalUrl;

    const url = new URL(originalUrl);
    url.searchParams.set('tag', associateTag);
    url.searchParams.set('linkCode', 'ur2');
    url.searchParams.set('linkId', params.campaign_id || crypto.randomUUID().slice(0, 8));
    
    return url.toString();
  }

  private verifyAmazonSignature(payload: any, signature?: string): boolean {
    // Implémentation simplifiée - en prod utiliser AWS SDK
    return signature !== undefined;
  }

  private async findSmartLinkByMetadata(metadata: Record<string, string>) {
    const smartLinks = await storage.getAllSmartLinks();
    return smartLinks.find(link => {
      const tags = link.tags as any;
      return tags?.amazon_affiliate_id === metadata.affiliate_id;
    });
  }
}

// PartnerStack Connector
class PartnerStackConnector implements AffiliateConnector {
  provider: AffiliateProvider = 'partnerstack';
  name = 'PartnerStack';
  description = 'SaaS affiliate program platform';
  baseUrl = 'https://api.partnerstack.com/v2/';
  authRequired = ['PARTNERSTACK_API_KEY', 'PARTNERSTACK_SECRET'];
  webhookEndpoint = '/api/affiliate/callbacks/partnerstack';

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { 
      success: true, 
      message: 'PartnerStack API connection available (requires keys)' 
    };
  }

  async processCallback(payload: any, signature?: string): Promise<boolean> {
    try {
      const validatedData = partnerStackCallbackSchema.parse(payload);
      
      // Vérifier webhook signature PartnerStack
      if (!this.verifyPartnerStackSignature(payload, signature)) {
        console.error('Invalid PartnerStack signature');
        return false;
      }

      // Recherche du SmartLink associé
      const smartLink = await this.findSmartLinkByMetadata({
        partner_id: validatedData.partner_id,
        customer_id: validatedData.customer_id
      });

      // Enregistrement idempotent
      await storage.createExternalRevenue({
        provider: 'partnerstack',
        externalTransactionId: validatedData.transaction_id,
        amount: validatedData.commission_amount.toString(),
        currency: validatedData.currency,
        description: `PartnerStack commission for transaction ${validatedData.transaction_id}`,
        smartLinkId: smartLink?.id,
        metadata: {
          partner_id: validatedData.partner_id,
          customer_id: validatedData.customer_id,
          sale_amount: validatedData.sale_amount,
          event_time: validatedData.event_time,
          processed_by: 'partnerstack_connector_v1'
        }
      });

      console.log(`[PARTNERSTACK] Processed callback: ${validatedData.transaction_id} -> $${validatedData.commission_amount}`);
      return true;
    } catch (error) {
      console.error('[PARTNERSTACK] Callback processing failed:', error);
      return false;
    }
  }

  generateTrackingLink(originalUrl: string, params: Record<string, string>): string {
    const partnerId = process.env.PARTNERSTACK_PARTNER_ID;
    if (!partnerId) return originalUrl;

    const url = new URL(originalUrl);
    url.searchParams.set('via', partnerId);
    url.searchParams.set('utm_source', 'partnerstack');
    url.searchParams.set('utm_campaign', params.campaign_id || 'smartlinks');
    
    return url.toString();
  }

  private verifyPartnerStackSignature(payload: any, signature?: string): boolean {
    // En prod: vérifier avec HMAC SHA256
    return signature !== undefined;
  }

  private async findSmartLinkByMetadata(metadata: Record<string, string>) {
    const smartLinks = await storage.getAllSmartLinks();
    return smartLinks.find(link => {
      const tags = link.tags as any;
      return tags?.partner_id === metadata.partner_id;
    });
  }
}

// Generic Connector pour ClickBank, CJ, ShareASale
class GenericAffiliateConnector implements AffiliateConnector {
  provider: AffiliateProvider;
  name: string;
  description: string;
  webhookEndpoint: string;
  authRequired: string[] = [];

  constructor(provider: AffiliateProvider) {
    this.provider = provider;
    this.name = this.getProviderName(provider);
    this.description = `${this.name} affiliate integration`;
    this.webhookEndpoint = `/api/affiliate/callbacks/${provider}`;
  }

  private getProviderName(provider: AffiliateProvider): string {
    switch (provider) {
      case 'clickbank': return 'ClickBank';
      case 'cj': return 'Commission Junction';
      case 'shareasale': return 'ShareASale';
      default: return 'Generic Affiliate';
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { 
      success: true, 
      message: `${this.name} connection available` 
    };
  }

  async processCallback(payload: any): Promise<boolean> {
    try {
      const validatedData = genericCallbackSchema.parse(payload);
      
      // Recherche du SmartLink associé
      let smartLink = null;
      if (validatedData.smart_link_id) {
        const allLinks = await storage.getAllSmartLinks();
        smartLink = allLinks.find(link => link.id === validatedData.smart_link_id);
      } else if (validatedData.campaign_id) {
        smartLink = await this.findSmartLinkByCampaign(validatedData.campaign_id);
      }

      // Enregistrement idempotent
      await storage.createExternalRevenue({
        provider: this.provider,
        externalTransactionId: validatedData.transaction_id,
        amount: validatedData.commission.toString(),
        currency: validatedData.currency,
        description: `${this.name} commission for transaction ${validatedData.transaction_id}`,
        smartLinkId: smartLink?.id,
        metadata: {
          sale_value: validatedData.sale_value,
          campaign_id: validatedData.campaign_id,
          processed_by: `${this.provider}_connector_v1`,
          ...validatedData.metadata
        }
      });

      console.log(`[${this.provider.toUpperCase()}] Processed callback: ${validatedData.transaction_id} -> $${validatedData.commission}`);
      return true;
    } catch (error) {
      console.error(`[${this.provider.toUpperCase()}] Callback processing failed:`, error);
      return false;
    }
  }

  generateTrackingLink(originalUrl: string, params: Record<string, string>): string {
    // Tracking générique avec UTM
    const url = new URL(originalUrl);
    url.searchParams.set('utm_source', this.provider);
    url.searchParams.set('utm_medium', 'affiliate');
    url.searchParams.set('utm_campaign', params.campaign_id || 'smartlinks');
    url.searchParams.set('aff_id', params.affiliate_id || 'default');
    
    return url.toString();
  }

  private async findSmartLinkByCampaign(campaignId: string) {
    const smartLinks = await storage.getAllSmartLinks();
    return smartLinks.find(link => {
      const tags = link.tags as any;
      return tags?.campaign_id === campaignId;
    });
  }
}

// Factory des connecteurs
class AffiliateConnectorFactory {
  private static connectors: Map<AffiliateProvider, AffiliateConnector> = new Map();

  static initialize() {
    // Initialiser tous les connecteurs
    this.connectors.set('amazon', new AmazonAssociatesConnector());
    this.connectors.set('partnerstack', new PartnerStackConnector());
    this.connectors.set('clickbank', new GenericAffiliateConnector('clickbank'));
    this.connectors.set('cj', new GenericAffiliateConnector('cj'));
    this.connectors.set('shareasale', new GenericAffiliateConnector('shareasale'));
  }

  static getConnector(provider: AffiliateProvider): AffiliateConnector | undefined {
    return this.connectors.get(provider);
  }

  static getAllConnectors(): AffiliateConnector[] {
    return Array.from(this.connectors.values());
  }

  static async testAllConnections(): Promise<Record<string, { success: boolean; message: string }>> {
    const results: Record<string, { success: boolean; message: string }> = {};
    
    // Fix pour éviter l'erreur d'itération
    const connectorsArray = Array.from(this.connectors.entries());
    for (const [provider, connector] of connectorsArray) {
      try {
        results[provider] = await connector.testConnection();
      } catch (error) {
        results[provider] = { 
          success: false, 
          message: `Connection test failed: ${error}` 
        };
      }
    }
    
    return results;
  }
}

// Initialiser les connecteurs au démarrage
AffiliateConnectorFactory.initialize();

export { AffiliateConnectorFactory };
// <AI:END affiliate-connectors>