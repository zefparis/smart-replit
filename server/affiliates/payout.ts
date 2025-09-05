// <AI:BEGIN affiliates-payout-service>
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { externalRevenues } from "../../shared/schema";

export async function markPaid(provider: string, extTxnId: string, paidAt?: Date) {
  const when = paidAt ?? new Date();
  try {
    await db.update(externalRevenues)
      .set({ status: "paid", paidAt: when })
      .where(and(
        eq(externalRevenues.provider, provider),
        eq(externalRevenues.externalTransactionId, extTxnId)
      ));
    
    console.log(`[PAYOUT] Marked ${provider} transaction ${extTxnId} as paid at ${when.toISOString()}`);
    return { ok: true };
  } catch (error) {
    console.error(`[PAYOUT] Failed to mark ${provider} ${extTxnId} as paid:`, error);
    return { ok: false, error: (error as Error).message };
  }
}

export async function markLocked(provider: string, extTxnId: string) {
  try {
    await db.update(externalRevenues)
      .set({ status: "locked" })
      .where(and(
        eq(externalRevenues.provider, provider),
        eq(externalRevenues.externalTransactionId, extTxnId)
      ));
    
    console.log(`[PAYOUT] Marked ${provider} transaction ${extTxnId} as locked`);
    return { ok: true };
  } catch (error) {
    console.error(`[PAYOUT] Failed to mark ${provider} ${extTxnId} as locked:`, error);
    return { ok: false, error: (error as Error).message };
  }
}

export async function markRejected(provider: string, extTxnId: string) {
  try {
    await db.update(externalRevenues)
      .set({ status: "rejected" })
      .where(and(
        eq(externalRevenues.provider, provider),
        eq(externalRevenues.externalTransactionId, extTxnId)
      ));
    
    console.log(`[PAYOUT] Marked ${provider} transaction ${extTxnId} as rejected`);
    return { ok: true };
  } catch (error) {
    console.error(`[PAYOUT] Failed to mark ${provider} ${extTxnId} as rejected:`, error);
    return { ok: false, error: (error as Error).message };
  }
}
// <AI:END affiliates-payout-service>