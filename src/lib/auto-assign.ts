import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Settings from "@/models/Settings";
import { sendEmail } from "@/lib/email";

async function notifySlack(companyId: string, conversationId: string, visitorName?: string) {
  try {
    const settings = await Settings.findOne({ companyId }).lean<{ notifications?: { slackWebhook?: string } }>();
    const webhookUrl = settings?.notifications?.slackWebhook;
    if (!webhookUrl) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com";
    const visitor = visitorName || "Anonymous";
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `💬 New chat from *${visitor}*`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*New chat from ${visitor}*\nConversation #${conversationId.slice(-6)}\n<${appUrl}/dashboard/chat|Open Dashboard →>`,
            },
          },
        ],
      }),
    }).catch(() => {});
  } catch (_) {}
}

async function notifyOfflineAgents(companyId: string, conversationId: string, visitorName?: string) {
  try {
    const settings = await Settings.findOne({ companyId }).lean<{ notifications?: { emailNotifications?: boolean } }>();
    if (!settings?.notifications?.emailNotifications) return;

    const offlineAgents = await User.find({
      companyId,
      role: { $in: ["AGENT", "TEAM_LEADER", "COMPANY_ADMIN", "MANAGER"] },
      isActive: true,
      isOnline: false,
      "notificationPreferences.email": true,
      "notificationPreferences.newChat": true,
    }).select("name email").lean<{ name: string; email: string }[]>();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com";
    const convUrl = `${appUrl}/dashboard/chat`;
    const visitor = visitorName || "A visitor";

    for (const agent of offlineAgents) {
      sendEmail({
        to: agent.email,
        subject: `New chat from ${visitor} — SupportFlow`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#6366f1">New Chat Waiting 💬</h2>
            <p>Hi ${agent.name},</p>
            <p><strong>${visitor}</strong> started a chat while you were offline.</p>
            <a href="${convUrl}"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">
              View Conversation →
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">SupportFlow · Conversation #${conversationId.slice(-6)}</p>
          </div>`,
      }).catch(() => {});
    }
  } catch (_) {}
}

/** Round-robin: returns the agent with the fewest active chats who is under their limit */
export async function findAvailableAgent(companyId: string) {
  await connectDB();
  const agents = await User.find({
    companyId,
    role: { $in: ["AGENT", "TEAM_LEADER"] },
    isActive: true,
    isOnline: true,
  }).sort({ lastSeen: -1 });

  if (!agents.length) return null;

  const withCounts = await Promise.all(
    agents.map(async (agent) => {
      const activeChats = await Conversation.countDocuments({
        companyId,
        assignedTo: agent._id,
        status: { $in: ["OPEN", "ASSIGNED"] },
      });
      return { agent, activeChats };
    })
  );

  withCounts.sort((a, b) => a.activeChats - b.activeChats);
  const pick = withCounts.find((a) => a.activeChats < a.agent.maxConcurrentChats);
  return pick?.agent ?? null;
}

/**
 * Tries to auto-assign a conversation to the next available agent (round-robin).
 * If all agents are busy or offline, posts a bot message explaining the situation.
 * Returns the assigned agent or null.
 */
export async function autoAssignConversation(
  companyId: string,
  conversationId: string,
  visitorName?: string
) {
  const agent = await findAvailableAgent(companyId);

  if (agent) {
    await Conversation.findByIdAndUpdate(conversationId, {
      assignedTo: agent._id,
      status: "ASSIGNED",
    });
    // Email agent if they're offline (assigned but not watching)
    if (!agent.isOnline) {
      notifyOfflineAgents(companyId, conversationId, visitorName);
    }
    // Slack notification
    notifySlack(companyId, conversationId, visitorName);
    return { assigned: true, agent };
  }

  // No agent picked — find out why
  const onlineCount = await User.countDocuments({
    companyId,
    role: { $in: ["AGENT", "TEAM_LEADER"] },
    isActive: true,
    isOnline: true,
  });

  const content =
    onlineCount > 0
      ? "All our agents are currently busy assisting other customers. You are in the queue — we will connect you with the next available agent shortly! 🙏"
      : "Our support team is currently offline. We have received your message and will get back to you as soon as we are back online. Thank you for your patience! 💙";

  await Message.create({
    companyId,
    conversationId,
    senderType: "BOT",
    type: "TEXT",
    content,
    isDelivered: true,
  });

  // When fully offline, email all agents
  if (onlineCount === 0) {
    notifyOfflineAgents(companyId, conversationId, visitorName);
  }
  notifySlack(companyId, conversationId, visitorName);

  return { assigned: false, agent: null };
}
