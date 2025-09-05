/**
 * Environment variable validation utilities
 */

export interface EnvConfig {
  // Database
  DATABASE_URL?: string;
  
  // Server
  PORT?: string;
  NODE_ENV?: string;
  
  // OpenAI
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  
  // Payment providers
  STRIPE_SECRET_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENV?: string;
  
  // AliExpress
  ALIEXPRESS_APP_KEY?: string;
  ALIEXPRESS_APP_SECRET?: string;
  ALIEXPRESS_CALLBACK_URL?: string;
  
  // Amazon
  AMAZON_EMAIL?: string;
  AMAZON_PASSWORD?: string;
  
  // IAS Blockchain
  IAS_REWARD_PER_CLICK?: string;
  IAS_MAX_CLICKS_PER_IP_HOUR?: string;
  IAS_MAX_CLICKS_PER_SESSION_HOUR?: string;
  IAS_MIN_TIME_BETWEEN_CLICKS?: string;
  REWARDS_EPOCH_DURATION?: string;
  IAS_CONTRACT_ADDRESS?: string;
  IAS_DISTRIBUTOR_ADDRESS?: string;
  IAS_NETWORK_NAME?: string;
  IAS_RPC_URL?: string;
  WALLET_PRIVATE_KEY?: string;
  
  // Session
  SESSION_SECRET?: string;
}

/**
 * Validate required environment variables
 */
export function validateRequiredEnvVars(): void {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  
  return value || defaultValue!;
}

/**
 * Get optional environment variable
 */
export function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Validate path-related environment variables
 */
export function validatePathEnvVars(): void {
  // Check if any path-related env vars are set and validate them
  const pathVars = [
    'ALIEXPRESS_CALLBACK_URL',
    'IAS_RPC_URL'
  ];
  
  pathVars.forEach(key => {
    const value = process.env[key];
    if (value && !isValidUrl(value)) {
      console.warn(`Warning: ${key} appears to be an invalid URL: ${value}`);
    }
  });
}

/**
 * Simple URL validation
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Log environment configuration status (without sensitive values)
 */
export function logEnvStatus(): void {
  console.log('Environment Configuration Status:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`- PORT: ${process.env.PORT || 'not set (will use 5000)'}`);
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
  console.log(`- SESSION_SECRET: ${process.env.SESSION_SECRET ? 'configured' : 'NOT SET'}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'configured' : 'not set'}`);
  console.log(`- STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'not set'}`);
  console.log(`- PAYPAL credentials: ${process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? 'configured' : 'not set'}`);
  console.log(`- ALIEXPRESS credentials: ${process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET ? 'configured' : 'not set'}`);
}
