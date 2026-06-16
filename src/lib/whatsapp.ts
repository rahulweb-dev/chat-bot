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
  status: string;
  language: string;
  category: string;
  bodyText?: string;
  bodyParamCount: number;
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
    return body?.error?.message || `Graph API error (HTTP ${res.status})`;
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

export async function listTemplates(businessAccountId: string, accessToken: string): Promise<{ ok: boolean; templates?: WhatsAppTemplate[]; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/${businessAccountId}/message_templates?fields=name,status,language,category,components&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { ok: false, error: await extractGraphError(res) };
    const data = await res.json();
    const templates: WhatsAppTemplate[] = (data?.data || [])
      .filter((t: { status: string }) => t.status === "APPROVED")
      .map((t: { name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }) => {
        const bodyComponent = t.components?.find((c) => c.type === "BODY");
        return {
          name: t.name,
          status: t.status,
          language: t.language,
          category: t.category,
          bodyText: bodyComponent?.text,
          bodyParamCount: bodyComponent?.text ? countBodyParams(bodyComponent.text) : 0,
        };
      });
    return { ok: true, templates };
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
