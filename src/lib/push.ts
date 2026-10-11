import webpush from "web-push";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";
import type { UserRole } from "@/lib/api-helpers";

// Web Push to team members' phones/desktops (installed dashboard app or browser).
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain).
// Generate keys once with: npx web-push generate-vapid-keys

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // dashboard page to open when tapped
  tag?: string; // same tag replaces the previous notification
}

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@convo360.app", pub, priv);
  return (configured = true);
}

// Never throws: a failed push must not break the chat that triggered it.
export async function sendPushToUsers(userIds: (string | Types.ObjectId)[], payload: PushPayload) {
  if (!pushConfigured() || !userIds.length) return 0;
  try {
    await connectDB();
    const subs = await PushSubscription.find({ userId: { $in: userIds } }).lean<{ _id: Types.ObjectId; endpoint: string; keys: { p256dh: string; auth: string } }[]>();
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // Gone / not found: the browser unsubscribed or the app was uninstalled.
        if (code === 404 || code === 410) await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
      }
    }));
    return sent;
  } catch (e) {
    console.error("[push]", e instanceof Error ? e.message : e);
    return 0;
  }
}

// Everyone in the company with one of these roles (default: admins, managers, agents).
export async function sendPushToCompany(
  companyId: string,
  payload: PushPayload,
  roles: UserRole[] = ["COMPANY_ADMIN", "MANAGER", "TEAM_LEADER", "AGENT"]
) {
  if (!pushConfigured()) return 0;
  try {
    await connectDB();
    const users = await User.find({ companyId, role: { $in: roles } }).select("_id").lean<{ _id: Types.ObjectId }[]>();
    return sendPushToUsers(users.map((u) => u._id), payload);
  } catch {
    return 0;
  }
}
