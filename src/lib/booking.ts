import { Types } from "mongoose";
import Counter from "@/models/Counter";
import Booking from "@/models/Booking";

// Appointment / site-visit slots, generated from the company's business hours
// in its own timezone (Settings → General → Timezone).

export interface BookingConfig {
  enabled: boolean;
  label: string;          // what's being booked, e.g. "site visit", "appointment"
  slotMinutes: number;    // 15–240
  daysAhead: number;      // how far ahead visitors can book
  capacity: number;       // bookings allowed per slot
  minNoticeHours: number; // no slots sooner than this
  triggerLabels: string;  // comma-separated menu labels that start booking, e.g. "Plan a Walkthrough"
  reminderTemplate?: string;
  reminderLanguage?: string;
}

export const DEFAULT_BOOKING: BookingConfig = {
  enabled: false, label: "appointment", slotMinutes: 60, daysAhead: 7, capacity: 1, minNoticeHours: 2,
  triggerLabels: "", reminderTemplate: "", reminderLanguage: "en",
};

export interface BizHour { day: string; open: string; close: string; isClosed: boolean }

// No hours configured: Mon–Sat 10:00–18:00, a sensible default for bookings.
const DEFAULT_HOURS: BizHour[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  .map((day) => ({ day, open: "10:00", close: "18:00", isClosed: day === "Sunday" }));

// ── Timezone maths (Intl only, no extra dependency) ────────────────────────────
function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, weekday: p.weekday as string };
}

function safeTz(tz?: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" }); return tz || "UTC"; } catch { return "UTC"; }
}

// UTC instant for a wall-clock time in `tz` (handles DST by re-checking once).
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const offset = (t: number) => { const p = partsIn(new Date(t), tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - t; };
  let utc = guess - offset(guess);
  utc = guess - offset(utc);
  return new Date(utc);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function timeLabel(date: Date, tz: string): string {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: safeTz(tz) }).toUpperCase();
}

export function whenLabel(date: Date, tz: string): string {
  const p = partsIn(date, safeTz(tz));
  return `${dayLabel(`${p.y}-${pad(p.m)}-${pad(p.d)}`)} at ${timeLabel(date, tz)}`;
}

// ── Availability ──────────────────────────────────────────────────────────────
function windowFor(dayKey: string, hours: BizHour[], tz: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const h = (hours.length ? hours : DEFAULT_HOURS).find((x) => x.day === weekday);
  if (!h || h.isClosed) return null;
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  return { start: zonedToUtc(y, m, d, oh, om, tz), end: zonedToUtc(y, m, d, ch, cm, tz) };
}

function slotsInWindow(win: { start: Date; end: Date }, cfg: BookingConfig, now: Date): Date[] {
  const out: Date[] = [];
  const step = cfg.slotMinutes * 60_000;
  const earliest = now.getTime() + cfg.minNoticeHours * 3_600_000;
  for (let t = win.start.getTime(); t + step <= win.end.getTime(); t += step) {
    if (t >= earliest) out.push(new Date(t));
  }
  return out;
}

async function bookedCounts(companyId: string, from: Date, to: Date): Promise<Map<number, number>> {
  const rows = await Booking.aggregate([
    { $match: { companyId: new Types.ObjectId(companyId), status: "BOOKED", startAt: { $gte: from, $lt: to } } },
    { $group: { _id: "$startAt", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r: { _id: Date; n: number }) => [new Date(r._id).getTime(), r.n]));
}

// Next open days (YYYY-MM-DD in the company's timezone) that still have a free slot.
export async function availableDays(companyId: string, cfg: BookingConfig, hours: BizHour[], tzIn?: string, now = new Date()) {
  const tz = safeTz(tzIn);
  const today = partsIn(now, tz);
  const days: { key: string; label: string }[] = [];
  for (let i = 0; i < Math.min(cfg.daysAhead, 30) && days.length < 8; i++) {
    const dt = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const key = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    const win = windowFor(key, hours, tz);
    if (!win) continue;
    const slots = slotsInWindow(win, cfg, now);
    if (!slots.length) continue;
    const counts = await bookedCounts(companyId, win.start, win.end);
    if (slots.some((s) => (counts.get(s.getTime()) ?? 0) < cfg.capacity)) {
      days.push({ key, label: i === 0 ? `Today, ${dayLabel(key).split(", ").pop()}` : i === 1 ? `Tomorrow, ${dayLabel(key).split(", ").pop()}` : dayLabel(key) });
    }
  }
  return days;
}

export async function availableSlots(companyId: string, cfg: BookingConfig, hours: BizHour[], dayKey: string, tzIn?: string, now = new Date()) {
  const tz = safeTz(tzIn);
  const win = windowFor(dayKey, hours, tz);
  if (!win) return [];
  const slots = slotsInWindow(win, cfg, now);
  const counts = await bookedCounts(companyId, win.start, win.end);
  return slots
    .filter((s) => (counts.get(s.getTime()) ?? 0) < cfg.capacity)
    .map((s) => ({ startAt: s, label: timeLabel(s, tz) }));
}

// Atomically takes one place in a slot. The upsert fails with a duplicate-key
// error once the slot's counter has reached capacity, so two visitors racing
// for the last place can't both get it.
export async function holdSlot(companyId: string, startAt: Date, capacity: number): Promise<boolean> {
  try {
    await Counter.findOneAndUpdate(
      { _id: `slot:${companyId}:${startAt.toISOString()}`, seq: { $lt: capacity } },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    return true;
  } catch {
    return false;
  }
}

export async function releaseSlot(companyId: string, startAt: Date) {
  await Counter.updateOne({ _id: `slot:${companyId}:${new Date(startAt).toISOString()}`, seq: { $gt: 0 } }, { $inc: { seq: -1 } });
}

// "Add to Google Calendar" link for the visitor; no OAuth needed.
export function googleCalendarLink(title: string, start: Date, end: Date, details: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${f(start)}/${f(end)}`, details });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
