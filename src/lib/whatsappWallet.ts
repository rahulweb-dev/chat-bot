import mongoose from "mongoose";
import WhatsAppWallet, { IWhatsAppWallet } from "@/models/WhatsAppWallet";

type WalletDoc = mongoose.HydratedDocument<IWhatsAppWallet>;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOrCreateWallet(companyId: string): Promise<WalletDoc> {
  let wallet = await WhatsAppWallet.findOne({ companyId });
  if (!wallet) wallet = await WhatsAppWallet.create({ companyId });

  // Roll the daily counter over if it's a new day
  if (wallet.lastResetDate < startOfToday()) {
    const rolled = await WhatsAppWallet.findOneAndUpdate(
      { _id: wallet._id },
      { dailyUsed: 0, lastResetDate: startOfToday() },
      { new: true }
    );
    if (rolled) wallet = rolled;
  }
  return wallet;
}

export interface ChargeResult {
  ok: boolean;
  reason?: "insufficient_credits" | "daily_limit_reached";
  wallet?: WalletDoc;
}

// Atomic: the query's balance/dailyUsed conditions double as the concurrency guard,
// so two simultaneous sends can't both succeed against a balance that only covers one.
export async function chargeForMessage(companyId: string): Promise<ChargeResult> {
  const wallet = await getOrCreateWallet(companyId);
  const cost = wallet.perMessageCost;

  const updated = await WhatsAppWallet.findOneAndUpdate(
    { _id: wallet._id, balance: { $gte: cost }, dailyUsed: { $lt: wallet.dailyLimit } },
    { $inc: { balance: -cost, dailyUsed: 1 } },
    { new: true }
  );

  if (updated) return { ok: true, wallet: updated };

  const fresh = await WhatsAppWallet.findById(wallet._id);
  if (!fresh || fresh.balance < cost) return { ok: false, reason: "insufficient_credits" };
  return { ok: false, reason: "daily_limit_reached" };
}

// Compensating transaction for a charge taken before a send that then failed.
export async function refundMessage(companyId: string): Promise<void> {
  const wallet = await getOrCreateWallet(companyId);
  await WhatsAppWallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { balance: wallet.perMessageCost, dailyUsed: -1 } }
  );
}

export async function getWalletSummary(companyId: string) {
  const wallet = await getOrCreateWallet(companyId);
  return {
    balance: wallet.balance,
    currency: wallet.currency,
    perMessageCost: wallet.perMessageCost,
    dailyLimit: wallet.dailyLimit,
    dailyUsed: wallet.dailyUsed,
    remainingToday: Math.max(0, wallet.dailyLimit - wallet.dailyUsed),
  };
}
