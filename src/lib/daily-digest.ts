import cron from "node-cron";
import { Types } from "mongoose";
import { connectDB } from "./mongodb";
import { sendEmail } from "./email";
import { decrypt } from "./crypto";
import { sendTemplate } from "./whatsapp";
import { chargeForMessage, refundMessage } from "./whatsappWallet";
import { toWhatsAppNumber } from "./phone";
import { zonedToUtc } from "./booking";
import Company from "../models/Company";
import Settings from "../models/Settings";
import User from "../models/User";
import Conversation from "../models/Conversation";
import Lead from "../models/Lead";
import Booking from "../models/Booking";
import WhatsAppIntegration from "../models/WhatsAppIntegration";

// Morning summary for business owners: what the chatbot did yesterday. The
// reason they keep paying is the leads it brings; this puts that number in
// front of them every day instead of only when they open the dashboard.

export interface DigestStats {
  day: string; // YYYY-MM-DD, company timezone
  chats: number;
  leads: number;
  bookings: number;
  wonLeads: number;
  waitingForReply: number;
  topSources: { channel: string; leads: number }[];
  prev: { chats: number; leads: number; bookings: number };
  upcomingToday: number;
}

function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(date).map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24 };
}

function safeTz(tz?: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" }); return tz || "UTC"; } catch { return "UTC"; }
}

// [start, end) of the local calendar day `offset` days from today.
function localDay(now: Date, tz: string, offset: number) {
  const t = localParts(now, tz);
  const base = new Date(Date.UTC(t.y, t.m - 1, t.d + offset, 12));
  const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12));
  return {
    key: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    start: zonedToUtc(y, m, d, 0, 0, tz),
    end: zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, tz),
  };
}

export async function buildDigest(companyId: string, tzIn?: string, now = new Date()): Promise<DigestStats> {
  await connectDB();
  const tz = safeTz(tzIn);
  const cid = new Types.ObjectId(companyId);
  const y = localDay(now, tz, -1);
  const p = localDay(now, tz, -2);
  const today = localDay(now, tz, 0);
  const inDay = (r: { start: Date; end: Date }) => ({ $gte: r.start, $lt: r.end });

  const [chats, leads, bookings, wonLeads, waiting, sources, pChats, pLeads, pBookings, upcomingToday] = await Promise.all([
    Conversation.countDocuments({ companyId: cid, createdAt: inDay(y) }),
    Lead.countDocuments({ companyId: cid, createdAt: inDay(y) }),
    Booking.countDocuments({ companyId: cid, createdAt: inDay(y) }),
    Lead.countDocuments({ companyId: cid, stage: "WON", updatedAt: inDay(y) }),
    Conversation.countDocuments({ companyId: cid, status: "OPEN", "metadata.needsAgent": true, assignedTo: { $exists: false } }),
    Lead.aggregate([
      { $match: { companyId: cid, createdAt: inDay(y) } },
      { $group: { _id: { $ifNull: ["$attribution.channel", "Not tracked"] }, leads: { $sum: 1 } } },
      { $sort: { leads: -1 } },
      { $limit: 3 },
    ]),
    Conversation.countDocuments({ companyId: cid, createdAt: inDay(p) }),
    Lead.countDocuments({ companyId: cid, createdAt: inDay(p) }),
    Booking.countDocuments({ companyId: cid, createdAt: inDay(p) }),
    Booking.countDocuments({ companyId: cid, status: "BOOKED", startAt: { $gte: now, $lt: today.end } }),
  ]);

  return {
    day: y.key, chats, leads, bookings, wonLeads, waitingForReply: waiting,
    topSources: sources.map((s: { _id: string; leads: number }) => ({ channel: s._id, leads: s.leads })),
    prev: { chats: pChats, leads: pLeads, bookings: pBookings },
    upcomingToday,
  };
}

function trend(now: number, before: number) {
  if (now === before) return `<span style="color:#9A988D">same as the day before</span>`;
  const up = now > before;
  return `<span style="color:${up ? "#15803d" : "#b45309"}">${up ? "▲" : "▼"} ${Math.abs(now - before)} vs the day before</span>`;
}

function digestEmail(companyName: string, s: DigestStats) {
  const dashboard = `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard`;
  const dayLabel = new Date(`${s.day}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const row = (label: string, n: number, before: number) =>
    `<tr><td style="padding:10px 0;color:#454337">${label}</td><td style="padding:10px 0;text-align:right;font-size:22px;font-weight:700;color:#15140F">${n}</td><td style="padding:10px 0 10px 14px;font-size:12px">${trend(n, before)}</td></tr>`;
  const sources = s.topSources.length
    ? `<p style="margin:22px 0 6px;font-weight:600;color:#15140F">Where yesterday's leads came from</p>` +
      s.topSources.map((x) => `<p style="margin:2px 0;color:#454337">${x.channel}: <b>${x.leads}</b></p>`).join("")
    : "";
  const attention = [
    s.waitingForReply ? `<b>${s.waitingForReply}</b> visitor${s.waitingForReply === 1 ? " is" : "s are"} waiting for a person to reply` : "",
    s.upcomingToday ? `<b>${s.upcomingToday}</b> booking${s.upcomingToday === 1 ? "" : "s"} still to come today` : "",
  ].filter(Boolean);
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff">
    <p style="margin:0;color:#9A988D;font-size:13px">${companyName} · ${dayLabel}</p>
    <h2 style="margin:6px 0 18px;color:#15140F;font-size:22px">Your chatbot yesterday</h2>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ECEBE6;border-bottom:1px solid #ECEBE6">
      ${row("Chats", s.chats, s.prev.chats)}
      ${row("Leads captured", s.leads, s.prev.leads)}
      ${row("Visits / appointments booked", s.bookings, s.prev.bookings)}
    </table>
    ${s.wonLeads ? `<p style="margin:14px 0 0;color:#15803d">🎉 ${s.wonLeads} lead${s.wonLeads === 1 ? "" : "s"} marked as won.</p>` : ""}
    ${sources}
    ${attention.length ? `<div style="margin:22px 0 0;padding:12px 14px;background:#FFF7ED;border-radius:10px;color:#9A3412">${attention.join("<br>")}</div>` : ""}
    <a href="${dashboard}" style="display:inline-block;margin-top:24px;background:#15140F;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Open dashboard</a>
    <p style="margin:24px 0 0;color:#B3B1A6;font-size:12px">Turn this summary off in Settings → Alerts.</p>
  </div>`;
}

type DigestCfg = { enabled?: boolean; hour?: number; email?: boolean; whatsappTemplate?: string; whatsappLanguage?: string; lastSentOn?: string };

export async function sendDigestForCompany(companyId: string, opts: { force?: boolean } = {}) {
  await connectDB();
  const settings = await Settings.findOne({ companyId })
    .select("general.timezone notifications.dailyDigest notifications.whatsappAlerts")
    .lean<{ general?: { timezone?: string }; notifications?: { dailyDigest?: DigestCfg; whatsappAlerts?: { phones?: string[] } } }>();
  const cfg = settings?.notifications?.dailyDigest;
  const tz = safeTz(settings?.general?.timezone);
  const stats = await buildDigest(companyId, tz);
  // Nothing happened at all: skip rather than send an empty email (unless forced, e.g. "send me a sample").
  if (!opts.force && !stats.chats && !stats.leads && !stats.bookings && !stats.waitingForReply) return { sent: false, stats };

  const company = await Company.findById(companyId).select("name email").lean<{ name?: string; email?: string }>();
  let emailed = 0;
  let whatsapped = 0;

  if (cfg?.email !== false) {
    const admins = await User.find({ companyId, role: "COMPANY_ADMIN" }).select("email").lean<{ email?: string }[]>();
    const to = new Set(admins.map((a) => a.email).filter(Boolean) as string[]);
    if (!to.size && company?.email) to.add(company.email);
    const html = digestEmail(company?.name || "Your business", stats);
    const subject = `Yesterday: ${stats.leads} lead${stats.leads === 1 ? "" : "s"}, ${stats.chats} chat${stats.chats === 1 ? "" : "s"}${stats.bookings ? `, ${stats.bookings} booking${stats.bookings === 1 ? "" : "s"}` : ""}`;
    for (const email of to) {
      await sendEmail({ to: email, subject, html }).then(() => emailed++).catch((e) => console.error("[daily-digest] email:", e));
    }
  }

  // WhatsApp needs an approved template: {{1}} chats, {{2}} leads, {{3}} bookings, {{4}} top source.
  const template = cfg?.whatsappTemplate?.trim();
  const phones = (settings?.notifications?.whatsappAlerts?.phones ?? []).map(toWhatsAppNumber).filter((p): p is string => !!p);
  if (template && phones.length) {
    const integration = await WhatsAppIntegration.findOne({ companyId, enabled: true }).select("phoneNumberId encryptedAccessToken")
      .lean<{ phoneNumberId: string; encryptedAccessToken: string }>();
    if (integration) {
      const token = decrypt(integration.encryptedAccessToken);
      const params = [String(stats.chats), String(stats.leads), String(stats.bookings), stats.topSources[0]?.channel ?? "—"];
      for (const to of phones.slice(0, 5)) {
        if (!(await chargeForMessage(companyId)).ok) break;
        const r = await sendTemplate(integration.phoneNumberId, token, to, template, cfg?.whatsappLanguage || "en",
          [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]);
        if (r.ok) whatsapped++;
        else await refundMessage(companyId).catch(() => {});
      }
    }
  }
  return { sent: emailed + whatsapped > 0, emailed, whatsapped, stats };
}

// Hourly: each company gets its digest once, at its chosen local hour (default 9am).
export async function runDailyDigests(now = new Date()) {
  await connectDB();
  const companies = await Company.find({ isActive: true }).select("_id").lean<{ _id: Types.ObjectId }[]>();
  let sent = 0;
  for (const c of companies) {
    const companyId = String(c._id);
    const s = await Settings.findOne({ companyId }).select("general.timezone notifications.dailyDigest")
      .lean<{ general?: { timezone?: string }; notifications?: { dailyDigest?: DigestCfg } }>();
    const cfg = s?.notifications?.dailyDigest;
    if (cfg?.enabled === false) continue; // on by default
    const tz = safeTz(s?.general?.timezone);
    const local = localParts(now, tz);
    if (local.h !== (cfg?.hour ?? 9)) continue;
    const todayKey = localDay(now, tz, 0).key;
    // Claim today's send atomically (several server instances / overlapping runs).
    // Upsert covers companies that never opened Settings; if the document exists
    // and is already marked for today, the upsert's insert hits the unique
    // companyId index and throws, which also means "already sent".
    const claimed = await Settings.findOneAndUpdate(
      { companyId, "notifications.dailyDigest.lastSentOn": { $ne: todayKey } },
      { $set: { "notifications.dailyDigest.lastSentOn": todayKey } },
      { upsert: true }
    ).then(() => true).catch(() => false);
    if (!claimed) continue;
    const r = await sendDigestForCompany(companyId).catch((e) => { console.error("[daily-digest]", companyId, e); return null; });
    if (r?.sent) sent++;
  }
  return { companies: companies.length, sent };
}

const g = globalThis as unknown as { __dailyDigestScheduler?: boolean };

export function initDailyDigestScheduler(): void {
  if (g.__dailyDigestScheduler) return;
  g.__dailyDigestScheduler = true;
  cron.schedule("5 * * * *", async () => {
    try {
      const r = await runDailyDigests();
      if (r.sent) console.log("[daily-digest]", r);
    } catch (e) {
      console.error("[daily-digest] tick failed:", e);
    }
  });
}
