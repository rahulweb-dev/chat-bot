// Returns a cleaned phone number, or null when it isn't a plausible mobile.
// Indian numbers (bare, 0-, 91- or +91-prefixed) must be 10 digits starting 6–9;
// other countries must be written with "+" and 8–15 digits. Placeholder junk
// like 9999999999 or 1234567890 is rejected so it doesn't become a fake lead.
export function normalizePhone(raw: string): string | null {
  const s = String(raw || "").trim().replace(/[\s\-().]/g, "");
  const digits = s.replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;

  let local: string | null = null;
  if (/^[6-9]\d{9}$/.test(digits) && !s.startsWith("+")) local = digits;
  else if (/^0[6-9]\d{9}$/.test(digits) && !s.startsWith("+")) local = digits.slice(1);
  else if (/^91[6-9]\d{9}$/.test(digits)) local = digits.slice(2);

  if (local) {
    if (/^(\d)\1{9}$/.test(local) || local === "9876543210") return null;
    return local;
  }
  if (s.startsWith("+") && !digits.startsWith("91") && /^\d{8,15}$/.test(digits)) return s;
  return null;
}

// WhatsApp Cloud API wants the full international number, digits only.
// Bare Indian numbers get the 91 country code.
export function toWhatsAppNumber(raw: string): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  return n.startsWith("+") ? n.slice(1) : `91${n}`;
}
