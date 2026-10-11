import cron from "node-cron";
import type { Types } from "mongoose";
import { connectDB } from "./mongodb";
import Company from "../models/Company";
import Usage from "../models/Usage";
import Subscription from "../models/Subscription";
import Notification from "../models/Notification";
import User from "../models/User";
import { sendEmail, usageAlertEmail } from "./email";

const ALERT_THRESHOLDS = [75, 90, 100];

const RESOURCE_LABELS: Record<string, string> = {
  agents: "Agents",
  chats: "Monthly Chats",
  aiMessages: "AI Messages",
  leads: "Leads",
  tickets: "Tickets",
  knowledgeFiles: "Knowledge Base Files",
  workflows: "Workflows",
  emailSends: "Email Campaign Sends",
  rcsSends: "RCS Campaign Sends",
};

export async function checkAndSendUsageAlerts() {
  await connectDB();
  const period = new Date().toISOString().slice(0, 7);

  const subscriptions = await Subscription.find({ status: { $in: ["ACTIVE", "TRIALING"] } })
    .populate("planId");

  for (const sub of subscriptions) {
    const plan = sub.planId as unknown as { limits: Record<string, number> };
    if (!plan?.limits) continue;

    const usage = await Usage.findOne({ companyId: sub.companyId, period });
    if (!usage) continue;

    const company = await Company.findById(sub.companyId).select("name email");
    if (!company) continue;

    for (const [resource, label] of Object.entries(RESOURCE_LABELS)) {
      const limit = plan.limits[resource];
      if (!limit || limit === -1) continue;

      const used = (usage as unknown as Record<string, unknown>)[resource] as number || 0;
      const percentage = Math.round((used / limit) * 100);

      // Alert once for the highest threshold reached. Checking lowest-first sent a
      // company that jumped straight to 100% the "75%" alert first and the real
      // "limit reached" one only two hourly runs later.
      const sentTypes = new Set((usage.alerts || []).filter((a: { resource: string }) => a.resource === resource).map((a: { type: string }) => a.type));
      const reached = [...ALERT_THRESHOLDS].reverse().find((t) => percentage >= t);
      if (!reached) continue;
      const thresholdStr = String(reached) as "75" | "90" | "100";
      if (sentTypes.has(thresholdStr)) continue;

      // Mark this and every lower threshold as sent, so they never fire afterwards.
      const toMark = ALERT_THRESHOLDS.filter((t) => t <= reached && !sentTypes.has(String(t)));
      await Usage.updateOne(
        { _id: usage._id },
        { $push: { alerts: { $each: toMark.map((t) => ({ type: String(t), resource, sentAt: new Date(), acknowledged: false })) } } }
      );

      // Notification.userId is required: one per company admin. (Creating it
      // without one failed validation, so these alerts never reached anyone.)
      const admins = await User.find({ companyId: sub.companyId, role: "COMPANY_ADMIN" }).select("_id").lean<{ _id: Types.ObjectId }[]>();
      await Promise.all(admins.map((a) =>
        Notification.create({
          companyId: sub.companyId,
          userId: a._id,
          type: "USAGE_ALERT",
          title: percentage >= 100 ? `${label} limit reached` : `${label} at ${reached}% of your plan`,
          message: `${label} is at ${percentage}% of your plan limit (${used}/${limit}).`,
          link: "/dashboard/billing",
          priority: percentage >= 100 ? "HIGH" : "NORMAL",
        }).catch((e) => console.error("[usage-alert] notification:", e))
      ));

      if (company.email && percentage >= 90) {
        await sendEmail({
          to: company.email,
          subject: `Convo360: ${label} usage alert for ${company.name}`,
          html: usageAlertEmail(company.name, label, percentage),
        }).catch(console.error);
      }
    }
  }
}

const globalForUsageScheduler = globalThis as unknown as { __usageAlertScheduler?: boolean };

export function initUsageAlertScheduler(): void {
  if (globalForUsageScheduler.__usageAlertScheduler) return;
  globalForUsageScheduler.__usageAlertScheduler = true;

  cron.schedule("0 * * * *", async () => {
    try {
      await checkAndSendUsageAlerts();
    } catch (e) {
      console.error("[usage-alert-scheduler] tick failed:", e);
    }
  });
}
