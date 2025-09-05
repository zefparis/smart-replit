// <AI:BEGIN affiliates-amazon-helpers>
import { z } from "zod";

export const asinRegex = /^[A-Z0-9]{10}$/i;

export function parseAsin(input: string): string | null {
  const trimmed = input.trim();
  if (asinRegex.test(trimmed)) return trimmed.toUpperCase();
  try {
    const u = new URL(trimmed);
    // patterns: /dp/ASIN, /gp/product/ASIN, /product-reviews/ASIN, ...
    const seg = u.pathname.split("/").filter(Boolean);
    const cand = seg.find(s => asinRegex.test(s));
    return cand ? cand.toUpperCase() : null;
  } catch {
    return null;
  }
}

const localeToDomain: Record<string, string> = {
  fr_FR: "amazon.fr",
  en_US: "amazon.com",
  de_DE: "amazon.de",
  es_ES: "amazon.es",
  it_IT: "amazon.it",
  en_GB: "amazon.co.uk",
};

export function affiliateUrlFromAsin(asin: string, opts?: { locale?: string; tag?: string }) {
  const locale = opts?.locale || process.env.AMAZON_LOCALE || "fr_FR";
  const domain = localeToDomain[locale] || "amazon.fr";
  const tag = opts?.tag || process.env.AMAZON_ASSOC_TAG || "";
  const url = new URL(`https://${domain}/dp/${asin}`);
  if (tag) url.searchParams.set("tag", tag);
  return url.toString();
}

// ----- PA-API v5 (optionnel) -----
import { createHash, createHmac } from "crypto";

type PaapiItem = { 
  ASIN: string; 
  DetailPageURL?: string; 
  ItemInfo?: {
    Title?: { DisplayValue?: string };
  };
  Images?: { 
    Primary?: { 
      Large?: { URL?: string };
    };
  }; 
  Offers?: {
    Listings?: Array<{
      Price?: { DisplayAmount?: string };
    }>;
  };
};

type PaapiResponse = {
  ItemsResult?: {
    Items?: PaapiItem[];
  };
  Errors?: Array<{ Code: string; Message: string }>;
};

export async function paapiLookup(asin: string): Promise<Partial<PaapiItem> | null> {
  const accessKey = process.env.AMAZON_ACCESS_KEY_ID;
  const secretKey = process.env.AMAZON_SECRET_ACCESS_KEY;
  const associateTag = process.env.AMAZON_ASSOC_TAG;
  
  if (!accessKey || !secretKey || !associateTag) {
    console.log("[PA-API] Missing credentials, skipping metadata fetch");
    return null;
  }

  try {
    const locale = process.env.AMAZON_LOCALE || "fr_FR";
    const marketplace = getMarketplaceFromLocale(locale);
    const host = getPaapiHostFromLocale(locale);
    
    // PA-API v5 GetItems request
    const payload = {
      ItemIds: [asin],
      Resources: [
        "ItemInfo.Title",
        "Images.Primary.Large",
        "Offers.Listings.Price"
      ],
      PartnerTag: associateTag,
      PartnerType: "Associates",
      Marketplace: marketplace
    };

    const payloadStr = JSON.stringify(payload);
    const headers = await createPaapiHeaders(payloadStr, host, accessKey, secretKey);
    
    const response = await fetch(`https://${host}/paapi5/getitems`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: payloadStr
    });

    if (!response.ok) {
      console.log(`[PA-API] Request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: PaapiResponse = await response.json();
    
    if (data.Errors && data.Errors.length > 0) {
      console.log(`[PA-API] API errors:`, data.Errors);
      return null;
    }

    const item = data.ItemsResult?.Items?.[0];
    if (!item) {
      console.log(`[PA-API] No item found for ASIN ${asin}`);
      return null;
    }

    return {
      ASIN: item.ASIN,
      DetailPageURL: item.DetailPageURL,
      ItemInfo: item.ItemInfo,
      Images: item.Images,
      Offers: item.Offers
    };

  } catch (error) {
    console.log(`[PA-API] Error fetching metadata for ${asin}:`, error);
    return null;
  }
}

function getMarketplaceFromLocale(locale: string): string {
  const marketplaces: Record<string, string> = {
    fr_FR: "www.amazon.fr",
    en_US: "www.amazon.com", 
    de_DE: "www.amazon.de",
    es_ES: "www.amazon.es",
    it_IT: "www.amazon.it",
    en_GB: "www.amazon.co.uk"
  };
  return marketplaces[locale] || "www.amazon.fr";
}

function getPaapiHostFromLocale(locale: string): string {
  const hosts: Record<string, string> = {
    fr_FR: "webservices.amazon.fr",
    en_US: "webservices.amazon.com",
    de_DE: "webservices.amazon.de", 
    es_ES: "webservices.amazon.es",
    it_IT: "webservices.amazon.it",
    en_GB: "webservices.amazon.co.uk"
  };
  return hosts[locale] || "webservices.amazon.fr";
}

async function createPaapiHeaders(payload: string, host: string, accessKey: string, secretKey: string) {
  const service = "ProductAdvertisingAPI";
  const region = "eu-west-1"; // EU region for most Amazon locales
  const method = "POST";
  const uri = "/paapi5/getitems";
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  
  // Create canonical request
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    ""
  ].join("\n");
  
  const signedHeaders = "host;x-amz-date";
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  
  const canonicalRequest = [
    method,
    uri,
    "", // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  
  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex")
  ].join("\n");
  
  // Calculate signature
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    "Host": host,
    "X-Amz-Date": amzDate,
    "Authorization": authorization
  };
}

export const createAmazonSmartLinkSchema = z.object({
  input: z.string().min(5),          // ASIN ou URL Amazon
  name: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  locale: z.string().optional(),
});
// <AI:END affiliates-amazon-helpers>