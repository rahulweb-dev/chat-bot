import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import ChatbotConfig from "@/models/ChatbotConfig";
import Settings from "@/models/Settings";
import AuditLog from "@/models/AuditLog";

const schema = z.object({ key: z.string().min(1) });

// Applies an industry template. Replaces the menu flow, booking setup and
// proactive messages; adds the template's FAQs alongside existing ones; keeps
// anything WhatsApp-specific (reminder template) the company already set.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Only admins and managers can change the chatbot", 403);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Choose a template", 422);
  const t = INDUSTRY_TEMPLATES.find((x) => x.key === parsed.data.key);
  if (!t) return apiError("Template not found", 404);

  await connectDB();
  const existing = await ChatbotConfig.findOne({ companyId: ctx.companyId })
    .select("faqs booking").lean<{ faqs?: { question: string }[]; booking?: { reminderTemplate?: string; reminderLanguage?: string } }>();
  const have = new Set((existing?.faqs ?? []).map((f) => f.question.trim().toLowerCase()));
  const newFaqs = t.faqs.filter((f) => !have.has(f.question.trim().toLowerCase()));

  const config = await ChatbotConfig.findOneAndUpdate(
    { companyId: ctx.companyId },
    {
      $set: {
        customFlow: t.customFlow,
        booking: {
          ...t.booking,
          reminderTemplate: existing?.booking?.reminderTemplate ?? "",
          reminderLanguage: existing?.booking?.reminderLanguage ?? "en",
        },
        proactive: t.proactive,
        welcomeMessage: t.welcomeMessage,
      },
      ...(newFaqs.length ? { $push: { faqs: { $each: newFaqs } } } : {}),
    },
    { new: true, upsert: true }
  );
  // The widget reads its greeting from Settings.
  await Settings.findOneAndUpdate({ companyId: ctx.companyId }, { $set: { "widget.welcomeMessage": t.welcomeMessage } }, { upsert: true });

  await AuditLog.create({
    companyId: ctx.companyId, userId: ctx.userId, action: "APPLY_CHATBOT_TEMPLATE", resource: "chatbot_config",
    details: { template: t.key }, status: "SUCCESS",
  }).catch(() => {});

  return apiSuccess(config, `${t.name} template applied`);
}
