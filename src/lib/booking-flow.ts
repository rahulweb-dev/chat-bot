import type { BotResponse, SessionData } from "@/lib/chatbot-flow";
import { normalizePhone } from "@/lib/phone";
import { t, botLang, type BotLang } from "@/lib/bot-i18n";
import {
  availableDays, availableSlots, holdSlot, whenLabel, googleCalendarLink,
  type BookingConfig, type BizHour,
} from "@/lib/booking";

// The in-chat booking conversation: day → time → (name, phone if not known) → booked.
// Session keys: flow "BOOKING", step "day" | "time" | "name" | "phone";
// collected.booking_day (YYYY-MM-DD), collected.booking_at (ISO).
// The engine adds navigation buttons in English; getBotReply translates them.

const MENU = "🔙 Main Menu";

export function bookingButton(cfg: BookingConfig, lang: BotLang = "en") {
  return t(lang, "bookButton", { label: cfg.label || "appointment" });
}

export function isBookingTrigger(input: string, cfg: BookingConfig): boolean {
  const s = input.trim().toLowerCase();
  if (!s) return false;
  // The button in any supported language, or "book a <label>" typed in English.
  if ((["en", "hi"] as const).some((l) => s === bookingButton(cfg, l).toLowerCase())) return true;
  if (s.includes(`book a ${(cfg.label || "appointment").toLowerCase()}`)) return true;
  return cfg.triggerLabels
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((x) => s === x || s.includes(x) || x.includes(s.replace(/^[^\p{L}\p{N}]+/u, "")));
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
  opts: { dryRun?: boolean; lang?: string } = {}
): Promise<BotResponse | null> {
  const inBooking = session.flow === "BOOKING";
  if (!cfg.enabled || (!inBooking && !isBookingTrigger(input, cfg))) return null;

  const L = botLang(opts.lang);
  const col = { ...session.collected };
  const label = cfg.label || "appointment";
  const at = (step: string): SessionData => ({ flow: "BOOKING", step, collected: col });
  const words = { today: t(L, "today"), tomorrow: t(L, "tomorrow") };
  const days = () => availableDays(companyId, cfg, hours, timezone, new Date(), words);

  const askDay = async (prefix?: string) => {
    const list = await days();
    if (!list.length) {
      return reply([t(L, "noSlots", { label, days: cfg.daysAhead })], ["💬 Talk to a Human", MENU], { flow: "INITIAL", step: "", collected: col });
    }
    return reply([prefix ?? t(L, "whichDay", { label })], [...list.map((d) => d.label), MENU], at("day"));
  };

  const askTime = async (dayKey: string, prefix?: string) => {
    const slots = await availableSlots(companyId, cfg, hours, dayKey, timezone);
    if (!slots.length) return askDay(t(L, "dayFull"));
    return reply([prefix ?? t(L, "whatTime")], [...slots.slice(0, 16).map((s) => s.label), t(L, "anotherDay"), MENU], at("time"));
  };

  const finish = async (): Promise<BotResponse> => {
    const startAt = new Date(col.booking_at);
    const endAt = new Date(startAt.getTime() + cfg.slotMinutes * 60_000);
    if (!opts.dryRun && !(await holdSlot(companyId, startAt, cfg.capacity))) {
      return askTime(col.booking_day, t(L, "slotTaken"));
    }
    const when = whenLabel(startAt, timezone || "UTC", L);
    const cal = googleCalendarLink(`${label[0].toUpperCase()}${label.slice(1)}`, startAt, endAt, `Booked via chat. Phone: ${col.phone ?? ""}`);
    const done: SessionData = { flow: "INITIAL", step: "", collected: { ...col, booking_day: "", booking_at: "" } };
    return reply(
      [t(L, "booked", { label, when }), t(L, "addToCalendar", { link: cal })],
      [MENU],
      done,
      {
        action: "CREATE_LEAD",
        leadData: { ...col, type: "BOOKING", score: "85", bookingAt: whenLabel(startAt, timezone || "UTC") },
        booking: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), label, held: !opts.dryRun },
      }
    );
  };

  const afterTime = async (): Promise<BotResponse> => {
    if (!col.name) return reply([t(L, "bookingName")], [MENU], at("name"));
    if (!col.phone) return reply([t(L, "bookingPhone", { name: col.name.split(" ")[0], label })], [MENU], at("phone"));
    return finish();
  };

  if (!inBooking) return askDay();

  const inp = input.trim();
  switch (session.step) {
    case "day": {
      const day = pick(await days(), inp);
      if (!day) return askDay(t(L, "pickDay"));
      col.booking_day = day.key;
      return askTime(day.key);
    }
    case "time": {
      if (/another day|दूसरा दिन/i.test(inp)) return askDay();
      const slots = await availableSlots(companyId, cfg, hours, col.booking_day, timezone);
      const slot = pick(slots, inp);
      if (!slot) return askTime(col.booking_day, t(L, "pickTime"));
      col.booking_at = slot.startAt.toISOString();
      return afterTime();
    }
    case "name": {
      if (inp.length < 2) return reply([t(L, "nameRetry")], [MENU], at("name"));
      col.name = inp;
      return afterTime();
    }
    case "phone": {
      const phone = normalizePhone(inp);
      if (!phone) return reply([t(L, "phoneRetry")], [MENU], at("phone"));
      col.phone = phone;
      return finish();
    }
    default:
      return askDay();
  }
}
