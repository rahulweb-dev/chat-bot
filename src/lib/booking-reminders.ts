import cron from "node-cron";
import type { Types } from "mongoose";
import { connectDB } from "./mongodb";
import { decrypt } from "./crypto";
import { sendTemplate } from "./whatsapp";
import { chargeForMessage, refundMessage } from "./whatsappWallet";
import { toWhatsAppNumber } from "./phone";
import { whenLabel } from "./booking";
import Booking from "../models/Booking";
import ChatbotConfig from "../models/ChatbotConfig";
import Company from "../models/Company";
import Settings from "../models/Settings";
import WhatsAppIntegration from "../models/WhatsAppIntegration";

// WhatsApp reminder to the visitor ~24h (at least 2h) before their booking.
// Business-initiated WhatsApp needs an approved template, so this only runs for
// companies that set one (Chatbot → Bookings → Reminder template) with 4 body
// variables: {{1}} name, {{2}} what's booked, {{3}} date & time, {{4}} business.
export async function runBookingReminders(now = new Date()) {
  await connectDB();
  const soon = new Date(now.getTime() + 24 * 3_600_000);
  const minLead = new Date(now.getTime() + 2 * 3_600_000);

  const due = await Booking.find({
    status: "BOOKED",
    startAt: { $gt: minLead, $lte: soon },
    reminderSentAt: { $exists: false },
    phone: { $exists: true, $ne: "" },
  }).limit(200).lean<{ _id: Types.ObjectId; companyId: Types.ObjectId; name: string; phone: string; label: string; startAt: Date }[]>();

  let sent = 0;
  for (const b of due) {
    const cfg = await ChatbotConfig.findOne({ companyId: b.companyId }).select("booking").lean<{ booking?: { reminderTemplate?: string; reminderLanguage?: string } }>();
    const template = cfg?.booking?.reminderTemplate?.trim();
    if (!template) continue;
    const integration = await WhatsAppIntegration.findOne({ companyId: b.companyId, enabled: true })
      .select("phoneNumberId encryptedAccessToken").lean<{ phoneNumberId: string; encryptedAccessToken: string }>();
    const to = toWhatsAppNumber(b.phone);
    if (!integration || !to) continue;

    // Claim first so an overlapping run can't send twice.
    const claimed = await Booking.findOneAndUpdate({ _id: b._id, reminderSentAt: { $exists: false } }, { reminderSentAt: now });
    if (!claimed) continue;

    const companyId = String(b.companyId);
    const charge = await chargeForMessage(companyId);
    if (!charge.ok) continue;

    const [company, settings] = await Promise.all([
      Company.findById(b.companyId).select("name").lean<{ name?: string }>(),
      Settings.findOne({ companyId: b.companyId }).select("general.timezone").lean<{ general?: { timezone?: string } }>(),
    ]);
    const res = await sendTemplate(
      integration.phoneNumberId, decrypt(integration.encryptedAccessToken), to, template, cfg?.booking?.reminderLanguage || "en",
      [{ type: "body", parameters: [b.name.split(" ")[0] || "there", b.label, whenLabel(b.startAt, settings?.general?.timezone || "UTC"), company?.name || "us"].map((text) => ({ type: "text", text })) }]
    );
    if (res.ok) sent++;
    else {
      await refundMessage(companyId).catch(() => {});
      console.warn("[booking-reminders]", String(b._id), res.error);
    }
  }
  return { due: due.length, sent };
}

const g = globalThis as unknown as { __bookingReminderScheduler?: boolean };

export function initBookingReminderScheduler(): void {
  if (g.__bookingReminderScheduler) return;
  g.__bookingReminderScheduler = true;
  cron.schedule("*/15 * * * *", async () => {
    try {
      const r = await runBookingReminders();
      if (r.sent) console.log("[booking-reminders]", r);
    } catch (e) {
      console.error("[booking-reminders] tick failed:", e);
    }
  });
}
