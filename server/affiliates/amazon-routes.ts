// <AI:BEGIN affiliates-amazon-routes>
import { Router } from "express";
import { db } from "../db";
import { smartLinks, users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { createAmazonSmartLinkSchema, parseAsin, affiliateUrlFromAsin, paapiLookup } from "./amazon";
import { randomUUID } from "crypto";

const router = Router();

router.post("/api/affiliates/amazon/lookup", async (req, res) => {
  if (process.env.FF_AMAZON_CONNECTOR !== "true") return res.status(501).json({ error: "disabled" });
  const { input, locale } = req.body || {};
  const asin = parseAsin(input || "");
  if (!asin) return res.status(400).json({ error: "invalid_asin_or_url" });

  const aff = affiliateUrlFromAsin(asin, { locale });
  const meta = await paapiLookup(asin); // peut être null si pas de clés
  res.json({ asin, affiliateUrl: aff, meta });
});

router.post("/api/monetization/smart-links/amazon", async (req, res) => {
  if (process.env.FF_AMAZON_CONNECTOR !== "true") return res.status(501).json({ error: "disabled" });

  const parsed = createAmazonSmartLinkSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });

  const { input, name, tags, commissionRate, locale } = parsed.data;
  const asin = parseAsin(input);
  if (!asin) return res.status(400).json({ error: "invalid_asin_or_url" });

  const affiliateUrl = affiliateUrlFromAsin(asin, { locale });
  const originalUrl = affiliateUrl.replace(/[?&]tag=[^&]+/, ""); // même page sans tag
  const titleFallback = name || `Amazon Product ${asin}`;

  // idempotence: si on a déjà un smart_link pour cet ASIN+tag → retour same
  const existing = await db.select().from(smartLinks)
    .where(eq(smartLinks.affiliateUrl, affiliateUrl))
    .limit(1);
  if (existing.length) return res.json({ ok: true, smartLink: existing[0], duplicate: true });

  // optional meta (PA-API)
  const meta = await paapiLookup(asin);

  // Get first user for now (in real app you'd use authenticated user)
  const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
  const defaultUserId = firstUser?.id || process.env.DEFAULT_USER_ID || "system-user";

  const row = {
    id: randomUUID(),
    name: meta?.Title || titleFallback,
    originalUrl,
    affiliateUrl,
    shortCode: `amz-${asin.toLowerCase()}`,
    commissionRate: (commissionRate ?? 3.0).toString(), // Convert to string for decimal field
    status: "active" as const,
    description: meta?.Title || null,
    tags: JSON.stringify(tags && tags.length ? tags : ["amazon", asin]),
    userId: defaultUserId,
    scraperId: null,
    createdAt: new Date(),
    expiresAt: null,
  };

  const [inserted] = await db.insert(smartLinks).values(row).returning();
  res.json({ ok: true, smartLink: inserted });
});

export default router;
// <AI:END affiliates-amazon-routes>