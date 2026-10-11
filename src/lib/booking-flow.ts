import type { BotResponse, SessionData } from "@/lib/chatbot-flow";
import { normalizePhone } from "@/lib/phone";
import {
  availableDays, availableSlots, holdSlot, whenLabel, googleCalendarLink,
  type BookingConfig, type BizHour,
} from "@/lib/booking";

// The in-chat booking conversation: day → time → (name, phone if not known) → booked.
// Session keys: flow "BOOKING", step "day" | "time" | "name" | "phone";
// collected.booking_day (YYYY-MM-DD), collected.booking_at (ISO).

const MENU = "🔙 Main Menu";
const PHONE_RETRY = "⚠️ That number doesn't look right. Please enter your 10-digit mobile number (for example 98765 43210):";

export function bookingButton(cfg: BookingConfig) {
  return `📅 Book a ${cfg.label || "appointment"}`;
}

export function isBookingTrigger(input: string, cfg: BookingConfig): boolean {
  const s = input.trim().toLowerCase();
  if (!s) return false;
  if (s === bookingButton(cfg).toLowerCase() || s.includes(`book a ${(cfg.label || "appointment").toLowerCase()}`)) return true;
  return cfg.triggerLabels
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .some((t) => s === t || s.includes(t) || t.includes(s.replace(/^[^\p{L}\p{N}]+/u, "")));
}

const reply = (messages: string[], quickReplies: string[], sessionData: SessionData, extra: Partial<BotResponse> = {}): BotResponse =>
  ({ messages, quickReplies, sessionData, action: "NONE", ...extra });

function pick<T extends { label: string }>(options: T[], input: string): T | undefined {
  const s = input.trim().toLowerCase();
  return options.find((o) => o.label.toLowerCase() === s) ?? options.find((o) => o.label.toLowerCase().includes(s) && s.length >= 3);
}

export async function handleBookingFlow(
  input: string,
  session: SessionData,
  companyId: string,
  cfg: BookingConfig,
  hours: BizHour[],
  timezone: string | undefined,
  opts: { dryRun?: boolean } = {}
): Promise<BotResponse | null> {
  const inBooking = session.flow === "BOOKING";
  if (!cfg.enabled || (!inBooking && !isBookingTrigger(input, cfg))) return null;

  const col = { ...session.collected };
  const label = cfg.label || "appointment";
  const at = (step: string): SessionData => ({ flow: "BOOKING", step, collected: col });

  const askDay = async (prefix?: string) => {
    const days = await availableDays(companyId, cfg, hours, timezone);
    if (!days.length) {
      return reply(
        [`Sorry, there are no free ${label} slots in the next ${cfg.daysAhead} days. Would you like our team to call you instead?`],
        ["💬 Talk to a Human", MENU],
        { flow: "INITIAL", step: "", collected: col }
      );
    }
    return reply([prefix ?? `📅 Which day works for your ${label}?`], [...days.map((d) => d.label), MENU], at("day"));
  };

  const askTime = async (dayKey: string, prefix?: string) => {
    const slots = await availableSlots(companyId, cfg, hours, dayKey, timezone);
    if (!slots.length) return askDay("That day is now fully booked. Please pick another day:");
    return reply([prefix ?? "⏰ What time suits you?"], [...slots.slice(0, 16).map((s) => s.label), "↩ Another day", MENU], at("time"));
  };

  const finish = async (): Promise<BotResponse> => {
    const startAt = new Date(col.booking_at);
    const endAt = new Date(startAt.getTime() + cfg.slotMinutes * 60_000);
    if (!opts.dryRun && !(await holdSlot(companyId, startAt, cfg.capacity))) {
      return askTime(col.booking_day, "Sorry, someone just took that time. Please pick another:");
    }
    const when = whenLabel(startAt, timezone || "UTC");
    const cal = googleCalendarLink(`${label[0].toUpperCase()}${label.slice(1)}`, startAt, endAt, `Booked via chat. Phone: ${col.phone ?? ""}`);
    const done: SessionData = { flow: "INITIAL", step: "", collected: { ...col, booking_day: "", booking_at: "" } };
    return reply(
      [
        `✅ Your ${label} is booked for ${when}.\n\nWe'll remind you on WhatsApp before it. Need to change it? Just message us here.`,
        `📅 Add it to your calendar: ${cal}`,
      ],
      [MENU],
      done,
      {
        action: "CREATE_LEAD",
        leadData: { ...col, type: "BOOKING", score: "85", bookingAt: when },
        booking: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), label, held: !opts.dryRun },
      }
    );
  };

  const afterTime = async (): Promise<BotResponse> => {
    if (!col.name) return reply([`Great choice. May I have your name for the booking?`], [MENU], at("name"));
    if (!col.phone) return reply([`Thanks, ${col.name.split(" ")[0]}! Your mobile number, so we can confirm the ${label}?`], [MENU], at("phone"));
    return finish();
  };

  if (!inBooking) return askDay();

  const inp = input.trim();
  switch (session.step) {
    case "day": {
      const days = await availableDays(companyId, cfg, hours, timezone);
      const day = pick(days, inp);
      if (!day) return askDay("Please pick one of these days:");
      col.booking_day = day.key;
      return askTime(day.key);
    }
    case "time": {
      if (/another day/i.test(inp)) return askDay();
      const slots = await availableSlots(companyId, cfg, hours, col.booking_day, timezone);
      const slot = pick(slots, inp);
      if (!slot) return askTime(col.booking_day, "Please pick one of these times:");
      col.booking_at = slot.startAt.toISOString();
      return afterTime();
    }
    case "name": {
      if (inp.length < 2) return reply(["Please enter your name (at least 2 characters):"], [MENU], at("name"));
      col.name = inp;
      return afterTime();
    }
    case "phone": {
      const phone = normalizePhone(inp);
      if (!phone) return reply([PHONE_RETRY], [MENU], at("phone"));
      col.phone = phone;
      return finish();
    }
    default:
      return askDay();
  }
}
