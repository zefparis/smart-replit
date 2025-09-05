// <AI:BEGIN paypal-provider>

interface PayPalAuthResponse {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  supported_authn_schemes: string[];
  nonce: string;
  client_metadata: object;
}

interface PayPalBalanceResponse {
  balances: Array<{
    currency_code: string;
    total_balance: {
      currency_code: string;
      value: string;
    };
    available_balance: {
      currency_code: string;
      value: string;
    };
    withheld_balance: {
      currency_code: string;
      value: string;
    };
  }>;
  account_id: string;
  as_of_time: string;
  last_refresh_time: string;
}

async function getAccessToken(): Promise<{ token: string; base: string }> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!id || !secret) {
    throw new Error("PayPal credentials not configured");
  }
  
  const base = process.env.PAYPAL_ENV === "live" 
    ? "https://api.paypal.com" 
    : "https://api.sandbox.paypal.com";
    
  const credentials = Buffer.from(`${id}:${secret}`).toString('base64');
  
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });
  
  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.status} ${response.statusText}`);
  }
  
  const data: PayPalAuthResponse = await response.json();
  return { token: data.access_token, base };
}

export async function paypalBalance(): Promise<PayPalBalanceResponse> {
  try {
    const { token, base } = await getAccessToken();
    
    // Try alternative endpoint - wallet balance
    const response = await fetch(`${base}/v1/customer/partners/merchants/balance`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    // If that fails, try the reporting balances endpoint as fallback
    if (!response.ok && response.status === 404) {
      const fallbackResponse = await fetch(`${base}/v1/reporting/balances`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (fallbackResponse.ok) {
        const balances: PayPalBalanceResponse = await fallbackResponse.json();
        console.log(`[PAYPAL] Retrieved balance via fallback endpoint for account ${balances.account_id}`);
        return balances;
      }
    }
    
    if (!response.ok) {
      // Handle permission-specific errors
      const errorResponse = await response.text();
      if (response.status === 403 || errorResponse.includes("NOT_AUTHORIZED") || errorResponse.includes("insufficient permissions")) {
        throw new Error("PayPal app permissions insufficient. The app needs 'View account activities' or 'Financial information' permissions enabled.");
      }
      throw new Error(`PayPal balances failed: ${response.status} ${response.statusText}`);
    }
    
    const balances: PayPalBalanceResponse = await response.json();
    
    console.log(`[PAYPAL] Retrieved balance for account ${balances.account_id}`);
    return balances;
  } catch (error) {
    console.error(`[PAYPAL] Balance fetch failed:`, error);
    throw error;
  }
}

export async function testPayPalConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { token } = await getAccessToken();
    return {
      success: true,
      message: "PayPal connection successful"
    };
  } catch (error) {
    return {
      success: false,
      message: `PayPal connection failed: ${(error as Error).message}`
    };
  }
}
// <AI:END paypal-provider>