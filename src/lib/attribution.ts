// Where a visitor came from, captured by widget.js on the page they landed on
// and carried onto the conversation and any lead it produces.

export interface Attribution {
  channel: string;         // human label, e.g. "Google Ads", "Facebook / Instagram", "Direct"
  source?: string;         // utm_source
  medium?: string;         // utm_medium
  campaign?: string;       // utm_campaign
  term?: string;           // utm_term
  content?: string;        // utm_content
  landingPage?: string;    // first page of the visit
  referrer?: string;       // external site that linked here
  clickId?: "gclid" | "fbclid" | "msclkid";
  capturedAt?: string;
}

const str = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function host(url?: string) {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

// Widget input is untrusted: keep only known fields, trimmed and capped.
export function sanitizeAttribution(raw: unknown): Attribution | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const a: Attribution = {
    channel: "Direct",
    source: str(r.source, 100),
    medium: str(r.medium, 100),
    campaign: str(r.campaign, 200),
    term: str(r.term, 200),
    content: str(r.content, 200),
    landingPage: str(r.landingPage, 500),
    referrer: str(r.referrer, 500),
    clickId: (["gclid", "fbclid", "msclkid"] as const).find((k) => k === r.clickId),
    capturedAt: str(r.capturedAt, 40),
  };
  a.channel = channelFor(a);
  return a;
}

const SOCIAL = ["facebook.com", "m.facebook.com", "l.facebook.com", "instagram.com", "l.instagram.com", "linkedin.com", "lnkd.in", "t.co", "twitter.com", "x.com", "youtube.com", "pinterest.com", "reddit.com"];
const SEARCH = ["google.", "bing.com", "yahoo.", "duckduckgo.com", "ecosia.org", "yandex."];

// Same buckets a business owner thinks in. Paid signals (click IDs, cpc/paid
// mediums) win over the referrer, since ad clicks also have a referrer.
export function channelFor(a: Omit<Attribution, "channel">): string {
  const src = (a.source || "").toLowerCase();
  const med = (a.medium || "").toLowerCase();
  const ref = host(a.referrer);
  const paid = /cpc|ppc|paid|ads?$|display|cpm/.test(med);

  if (a.clickId === "gclid" || (src.includes("google") && paid)) return "Google Ads";
  if (a.clickId === "fbclid" && paid) return "Facebook / Instagram Ads";
  if (/facebook|instagram|^fb$|^ig$|meta/.test(src)) return paid ? "Facebook / Instagram Ads" : "Facebook / Instagram";
  if (a.clickId === "msclkid" || (src.includes("bing") && paid)) return "Bing Ads";
  if (med === "email" || src.includes("newsletter") || src.includes("mail")) return "Email";
  if (src.includes("whatsapp") || med.includes("whatsapp")) return "WhatsApp";
  if (paid) return src ? `Paid: ${a.source}` : "Paid ads";
  if (src) return a.source!.length > 30 ? "Campaign" : a.source!;
  if (a.clickId === "fbclid") return "Facebook / Instagram";
  if (ref) {
    if (SEARCH.some((s) => ref.includes(s))) return "Search (organic)";
    if (SOCIAL.some((s) => ref === s || ref.endsWith("." + s))) return "Social";
    return `Referral: ${ref}`;
  }
  return "Direct";
}
