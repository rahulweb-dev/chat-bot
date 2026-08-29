import crypto from "crypto";

const RESEND_API = "https://api.resend.com/emails";

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface ResendSendOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  // Resend surfaces bounces/complaints on the sending domain, not the recipient —
  // tagging lets a webhook payload be traced back to the campaign/recipient pair.
  tags?: { name: string; value: string }[];
}

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendCampaignEmail(opts: ResendSendOptions): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email sending is not configured (RESEND_API_KEY missing)" };

  const fromAddress = process.env.RESEND_FROM_EMAIL || "campaigns@resend.dev";
  const from = opts.fromName ? `${opts.fromName} <${fromAddress}>` : fromAddress;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        tags: opts.tags,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.message || `Resend API error (HTTP ${res.status})` };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Resend signs webhooks the Svix way: signed_content = "{id}.{timestamp}.{rawBody}",
// HMAC-SHA256 with the base64-decoded secret (after its "whsec_" prefix), base64-encoded.
// svix-signature carries one or more space-separated "v1,<base64>" candidates.
export function verifyResendSignature(
  rawBody: string,
  headers: { svixId: string | null; svixTimestamp: string | null; svixSignature: string | null },
  webhookSecret: string
): boolean {
  const { svixId, svixTimestamp, svixSignature } = headers;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return svixSignature.split(" ").some((candidate) => {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}
