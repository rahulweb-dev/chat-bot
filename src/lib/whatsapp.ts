const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface WhatsAppResult {
  ok: boolean;
  whatsappMessageId?: string;
  error?: string;
}

export interface WhatsAppTestResult {
  ok: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  error?: string;
}

export interface WhatsAppTemplate {
  name: string;
  id?: string;
  status: string;
  language: string;
  category: string;
  bodyText?: string;
  bodyParamCount: number;
  components?: Record<string, unknown>[];
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: { type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY"; text: string; url?: string; phone_number?: string }[];
}

export interface CreateTemplatePayload {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: TemplateComponent[];
}

export interface CampaignOfferContent {
  offerImageUrl?: string;
  variables?: string[];
  ctaType?: "VISIT_WEBSITE" | "CALL_PHONE" | "NONE";
  ctaUrl?: string;
}

// Builds the WhatsApp template `components` array from a campaign's offer fields.
// WhatsApp rejects components that don't match the approved template's actual
// structure (e.g. a header image component on a template with no image header) —
// that rejection surfaces as a normal sendTemplate() error, so we don't need to
// introspect the template shape here.
export function buildTemplateComponents(offer: CampaignOfferContent): Record<string, unknown>[] | undefined {
  const components: Record<string, unknown>[] = [];

  if (offer.offerImageUrl) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: offer.offerImageUrl } }] });
  }
  if (offer.variables && offer.variables.length > 0) {
    components.push({ type: "body", parameters: offer.variables.map((text) => ({ type: "text", text })) });
  }
  if (offer.ctaType === "VISIT_WEBSITE" && offer.ctaUrl) {
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: offer.ctaUrl }] });
  }

  return components.length > 0 ? components : undefined;
}

export interface WhatsAppMediaResult {
  ok: boolean;
  contentType?: string;
  data?: Buffer;
  error?: string;
}

async function extractGraphError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const msg: string = body?.error?.message || `Graph API error (HTTP ${res.status})`;
    const code: number = body?.error?.code;
    // OAuthException code 190 = expired/invalid token
    if (code === 190 || msg.toLowerCase().includes("session has expired") || msg.toLowerCase().includes("access token")) {
      return `Access token expired or invalid — go to WhatsApp Settings and update with a permanent System User token from Meta Business Manager`;
    }
    // Code 131030 = sandbox restriction: recipient not in the test number allowlist
    if (code === 131030 || msg.includes("131030") || msg.toLowerCase().includes("not in allowed list")) {
      return `Recipient phone number not whitelisted — your WhatsApp account is in test mode. Go to Meta Developer Console → WhatsApp → API Setup → "Manage phone number list" and add the recipient's number with country code (e.g. +91XXXXXXXXXX)`;
    }
    // Template not yet approved
    if (code === 132001 || msg.toLowerCase().includes("template") && msg.toLowerCase().includes("not approved")) {
      return `Template not approved — wait for Meta to approve the template, then retry the campaign`;
    }
    return msg;
  } catch {
    return `Graph API error (HTTP ${res.status})`;
  }
}

export async function testConnection(phoneNumberId: string, accessToken: string): Promise<WhatsAppTestResult> {
  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}?fields=verified_name,display_phone_number`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    return { ok: true, displayPhoneNumber: data.display_phone_number, verifiedName: data.verified_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function sendText(phoneNumberId: string, accessToken: string, to: string, body: string): Promise<WhatsAppResult> {
  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    return { ok: true, whatsappMessageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Counts {{1}}, {{2}}, ... placeholders in a template's BODY component text
function countBodyParams(bodyText: string): number {
  const matches = bodyText.match(/\{\{\d+\}\}/g);
  if (!matches) return 0;
  return new Set(matches).size;
}

export async function listTemplates(
  businessAccountId: string,
  accessToken: string,
  approvedOnly = true
): Promise<{ ok: boolean; templates?: WhatsAppTemplate[]; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/${businessAccountId}/message_templates?fields=id,name,status,language,category,components&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    const raw: { id: string; name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }[] = data?.data || [];
    const templates: WhatsAppTemplate[] = raw
      .filter((t) => !approvedOnly || t.status === "APPROVED")
      .map((t) => {
        const bodyComponent = t.components?.find((c) => c.type === "BODY");
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          language: t.language,
          category: t.category,
          bodyText: bodyComponent?.text,
          bodyParamCount: bodyComponent?.text ? countBodyParams(bodyComponent.text) : 0,
          components: t.components as Record<string, unknown>[],
        };
      });
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function createTemplate(
  businessAccountId: string,
  accessToken: string,
  payload: CreateTemplatePayload
): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${businessAccountId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    return { ok: true, id: data.id, status: data.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function deleteTemplate(
  businessAccountId: string,
  accessToken: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/${businessAccountId}/message_templates?name=${encodeURIComponent(name)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function fetchMedia(mediaId: string, accessToken: string): Promise<WhatsAppMediaResult> {
  try {
    const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return { ok: false, error: await extractGraphError(metaRes) };
    const meta = await metaRes.json();
    if (!meta.url) return { ok: false, error: "Media URL not available" };

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return { ok: false, error: `Failed to download media (HTTP ${fileRes.status})` };

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return { ok: true, contentType: meta.mime_type || fileRes.headers.get("content-type") || "application/octet-stream", data: buffer };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function sendTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: Record<string, unknown>[]
): Promise<WhatsAppResult> {
  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    });
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    return { ok: true, whatsappMessageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
