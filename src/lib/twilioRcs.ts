import crypto from "crypto";

// Twilio's REST API is form-encoded, not JSON, and auth is HTTP Basic
// (Account SID as username, Auth Token as password) — unlike Meta's Bearer tokens.
const API_BASE = "https://api.twilio.com/2010-04-01";

export interface TwilioSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

export interface TwilioTestResult {
  ok: boolean;
  friendlyName?: string;
  error?: string;
}

function authHeader(accountSid: string, authToken: string): string {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

// Verifies the Twilio account credentials by fetching the account resource —
// there's no dedicated "ping" endpoint, so this doubles as a connectivity check.
export async function testTwilioConnection(accountSid: string, authToken: string): Promise<TwilioTestResult> {
  try {
    const res = await fetch(`${API_BASE}/Accounts/${accountSid}.json`, {
      headers: { Authorization: authHeader(accountSid, authToken) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.message || `Twilio API error (HTTP ${res.status})` };
    }
    const data = await res.json();
    return { ok: true, friendlyName: data.friendly_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Sends via a Messaging Service (the RCS Agent's sender pool) — Twilio automatically
// falls back to SMS per-recipient if RCS isn't available on their device/carrier,
// so there's no separate "RCS vs SMS" branch to handle here.
export async function sendRcsMessage(
  accountSid: string,
  authToken: string,
  messagingServiceSid: string,
  to: string,
  body: string
): Promise<TwilioSendResult> {
  try {
    const params = new URLSearchParams({ To: to, MessagingServiceSid: messagingServiceSid, Body: body });
    const res = await fetch(`${API_BASE}/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: authHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `Twilio API error (HTTP ${res.status})` };
    if (data.error_code) return { ok: false, error: data.error_message || `Twilio error ${data.error_code}` };
    return { ok: true, sid: data.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Twilio's webhook signature: base64(HMAC-SHA1(authToken, url + sorted "key"+"value" pairs
// concatenated with no separator)). The url must be byte-identical to what's registered in
// the Twilio Console — reconstruct it from a fixed public base rather than trusting request
// headers, since a reverse proxy can rewrite host/protocol before the request reaches Next.js.
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null,
  authToken: string
): boolean {
  if (!signatureHeader) return false;

  const sortedConcat = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], "");

  const expected = crypto.createHmac("sha1", authToken).update(fullUrl + sortedConcat).digest("base64");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Parses application/x-www-form-urlencoded body (Twilio's webhook content-type) into
// a flat string map, matching what verifyTwilioSignature expects.
export function parseTwilioFormBody(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    params[key] = value;
  }
  return params;
}
