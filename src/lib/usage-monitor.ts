import { connectDB } from "./mongodb";
import Company from "../models/Company";
import Usage from "../models/Usage";
import Plan from "../models/Plan";
import Subscription from "../models/Subscription";
import Notification from "../models/Notification";
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

      for (const threshold of ALERT_THRESHOLDS) {
        if (percentage >= threshold) {
          const thresholdStr = String(threshold) as "75" | "90" | "100";
          const alreadySent = (usage.alerts || []).some(
            (a: { type: string; resource: string }) => a.type === thresholdStr && a.resource === resource
          );

          if (!alreadySent) {
            await Usage.updateOne(
              { _id: usage._id },
              { $push: { alerts: { type: thresholdStr, resource, sentAt: new Date(), acknowledged: false } } }
            );

            await Notification.create({
              companyId: sub.companyId,
              type: "USAGE_ALERT",
              title: `${percentage >= 100 ? "Usage limit reached" : `${threshold}% usage alert`}`,
              message: `${label} is at ${percentage}% of your plan limit (${used}/${limit}).`,
            });

            if (company.email && percentage >= 90) {
              await sendEmail({
                to: company.email,
                subject: `SupportFlow: ${label} usage alert for ${company.name}`,
                html: usageAlertEmail(company.name, label, percentage),
              }).catch(console.error);
            }

            break;
          }
        }
      }
    }
  }
}
