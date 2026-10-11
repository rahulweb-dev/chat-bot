import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { sendTemplate, sendText } from "@/lib/whatsapp";
import { chargeForMessage, refundMessage } from "@/lib/whatsappWallet";
import { toWhatsAppNumber } from "@/lib/phone";
import Settings from "@/models/Settings";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";

export interface LeadAlert {
  kind: "lead" | "agent_request" | "test";
  name?: string;
  phone?: string;
  interest?: string; // what they asked about, e.g. "SITE_VISIT"
  source?: string;   // lead channel, e.g. "Google Ads"
}

export interface AlertResult {
  sent: number;
  failed: { to: string; error: string }[];
  skipped?: string; // why nothing was attempted
}

const HEADLINE: Record<LeadAlert["kind"], string> = {
  lead: "🎯 New lead",
  agent_request: "🙋 Visitor wants to talk to a person",
  test: "✅ Test alert from Convo360",
};

const clip = (s: string | undefined, fallback: string) => (s?.trim() ? s.trim().slice(0, 60) : fallback);

// Sends the alert to every number on the company's WhatsApp alert list, from the
// company's own connected WhatsApp number, charged to its WhatsApp wallet like
// any other message. Never throws: a failed alert must not break the chat.
export async function sendWhatsAppLeadAlert(companyId: string, alert: LeadAlert): Promise<AlertResult> {
  try {
    await connectDB();
    const settings = await Settings.findOne({ companyId })
      .select("notifications.whatsappAlerts")
      .lean<{ notifications?: { whatsappAlerts?: { enabled?: boolean; phones?: string[]; templateName?: string; templateLanguage?: string } } }>();
    const cfg = settings?.notifications?.whatsappAlerts;
    if (alert.kind !== "test" && !cfg?.enabled) return { sent: 0, failed: [], skipped: "WhatsApp alerts are turned off" };

    const recipients = (cfg?.phones ?? []).map((p) => toWhatsAppNumber(p)).filter((p): p is string => !!p);
    if (!recipients.length) return { sent: 0, failed: [], skipped: "Add at least one valid mobile number" };

    const integration = await WhatsAppIntegration.findOne({ companyId, enabled: true })
      .select("phoneNumberId encryptedAccessToken")
      .lean<{ phoneNumberId: string; encryptedAccessToken: string }>();
    if (!integration) return { sent: 0, failed: [], skipped: "Connect your WhatsApp Business number first (WhatsApp → Settings)" };
    const token = decrypt(integration.encryptedAccessToken);

    const name = clip(alert.name, "Visitor");
    const phone = clip(alert.phone, "not shared");
    const interest = clip(alert.interest?.replace(/_/g, " ").toLowerCase(), "general enquiry");
    const source = clip(alert.source, "website chat");
    const template = cfg?.templateName?.trim();

    const result: AlertResult = { sent: 0, failed: [] };
    for (const to of [...new Set(recipients)].slice(0, 5)) {
      const charge = await chargeForMessage(companyId);
      if (!charge.ok) {
        result.failed.push({ to, error: charge.reason === "insufficient_credits" ? "WhatsApp wallet has no credits" : "Daily WhatsApp limit reached" });
        continue;
      }
      const res = template
        ? await sendTemplate(integration.phoneNumberId, token, to, template, cfg?.templateLanguage || "en", [
            { type: "body", parameters: [name, phone, interest, source].map((text) => ({ type: "text", text })) },
          ])
        : await sendText(
            integration.phoneNumberId, token, to,
            `${HEADLINE[alert.kind]}\n\n👤 ${name}\n📞 ${phone}\n💬 ${interest}\n📍 ${source}\n\nReply fast — leads go cold within minutes.`
          );
      if (res.ok) result.sent++;
      else {
        await refundMessage(companyId).catch(() => {});
        result.failed.push({ to, error: res.error || "Send failed" });
      }
    }
    if (result.failed.length) console.warn("[lead-alerts]", companyId, result.failed);
    return result;
  } catch (e) {
    console.error("[lead-alerts] failed:", e instanceof Error ? e.message : e);
    return { sent: 0, failed: [], skipped: "Unexpected error" };
  }
}
