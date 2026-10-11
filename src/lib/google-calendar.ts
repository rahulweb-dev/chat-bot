import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import CalendarIntegration from "@/models/CalendarIntegration";

// Two-way Google Calendar sync for chat bookings, over Google's REST APIs.
// Uses the same OAuth client as Google sign-in (GOOGLE_CLIENT_ID / SECRET).
// In Google Cloud: enable the Google Calendar API and add the redirect URI
// <app>/api/integrations/google-calendar/callback to that OAuth client.

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events", // add/remove booking events
  "https://www.googleapis.com/auth/calendar.freebusy", // read busy times (not event details)
  "openid",
  "email",
];

export function googleCalendarConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string) {
  return `${(process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
}

// OAuth `state` = companyId.userId.expiry.signature, so the callback can't be
// replayed or forged into connecting a calendar to another company.
function stateSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
}

export function signState(companyId: string, userId: string) {
  const body = `${companyId}.${userId}.${Date.now() + 10 * 60_000}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(state: string): { companyId: string; userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [companyId, userId, exp, sig] = parts;
  const expected = crypto.createHmac("sha256", stateSecret()).update(`${companyId}.${userId}.${exp}`).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return { companyId, userId };
}

export function authUrl(origin: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export async function exchangeCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google sign-in failed");
  let email: string | undefined;
  try { email = JSON.parse(Buffer.from(String(data.id_token).split(".")[1], "base64url").toString()).email; } catch { /* no id token */ }
  return { refreshToken: data.refresh_token as string | undefined, email };
}

// Short-lived access tokens, cached in memory per company.
const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(companyId: string): Promise<{ token: string; calendarId: string } | null> {
  await connectDB();
  const integ = await CalendarIntegration.findOne({ companyId, enabled: true })
    .select("encryptedRefreshToken calendarId").lean<{ encryptedRefreshToken: string; calendarId: string }>();
  if (!integ || !googleCalendarConfigured()) return null;
  const hit = tokenCache.get(companyId);
  if (hit && hit.exp > Date.now() + 60_000) return { token: hit.token, calendarId: integ.calendarId };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(integ.encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // Revoked access / deleted Google account: stop using it and say why.
    await CalendarIntegration.updateOne({ companyId }, { lastError: data.error_description || data.error || "Token refresh failed", ...(data.error === "invalid_grant" ? { enabled: false } : {}) });
    return null;
  }
  tokenCache.set(companyId, { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return { token: data.access_token, calendarId: integ.calendarId };
}

// Busy intervals in the company's calendar. Fails open (no busy times) so a
// Google outage never stops visitors from booking.
export async function busyTimes(companyId: string, from: Date, to: Date): Promise<{ start: number; end: number }[]> {
  try {
    const auth = await accessToken(companyId);
    if (!auth) return [];
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: auth.calendarId }] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const busy = (data.calendars?.[auth.calendarId]?.busy ?? []) as { start: string; end: string }[];
    return busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
  } catch {
    return [];
  }
}

export async function createCalendarEvent(companyId: string, ev: { title: string; description: string; start: Date; end: Date }) {
  try {
    const auth = await accessToken(companyId);
    if (!auth) return null;
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: ev.title,
        description: ev.description,
        start: { dateTime: ev.start.toISOString() },
        end: { dateTime: ev.end.toISOString() },
        reminders: { useDefault: true },
      }),
    });
    if (!res.ok) {
      console.warn("[google-calendar] create event:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    return ((await res.json()) as { id: string }).id;
  } catch (e) {
    console.warn("[google-calendar] create event:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function deleteCalendarEvent(companyId: string, eventId: string) {
  try {
    const auth = await accessToken(companyId);
    if (!auth) return;
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    });
  } catch { /* already gone */ }
}
