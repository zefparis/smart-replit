// <AI:BEGIN stripe-provider>

interface StripeBalance {
  object: string;
  available: Array<{
    amount: number;
    currency: string;
    source_types: Record<string, number>;
  }>;
  pending: Array<{
    amount: number;
    currency: string;
    source_types: Record<string, number>;
  }>;
  instant_available?: Array<{
    amount: number;
    currency: string;
    source_types: Record<string, number>;
  }>;
}

export async function stripeBalance(): Promise<StripeBalance> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error("Stripe not configured: STRIPE_SECRET_KEY missing");
  }
  
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Stripe balance failed: ${response.status} ${response.statusText}`);
    }
    
    const balance: StripeBalance = await response.json();
    
    console.log(`[STRIPE] Retrieved balance - Available: ${balance.available.length} currencies, Pending: ${balance.pending.length} currencies`);
    return balance;
  } catch (error) {
    console.error(`[STRIPE] Balance fetch failed:`, error);
    throw error;
  }
}

export async function testStripeConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await stripeBalance();
    return {
      success: true,
      message: "Stripe connection successful"
    };
  } catch (error) {
    return {
      success: false,
      message: `Stripe connection failed: ${(error as Error).message}`
    };
  }
}
// <AI:END stripe-provider>