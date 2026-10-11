// Feature bullets per plan type, used when a Plan document has no `features`
// of its own. Shared by the billing page and the public pricing section so the
// two never disagree.
export const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: ["2 Agents", "1,000 Chats/mo", "500 AI Messages/mo", "1 Chatbot", "Basic Analytics", "Email Support"],
  PRO: ["10 Agents", "10,000 Chats/mo", "5,000 AI Messages/mo", "5 Chatbots", "Advanced Analytics", "CRM & Leads", "API Access", "Priority Support"],
  ENTERPRISE: ["Unlimited Agents", "Unlimited Chats", "Unlimited AI Messages", "Unlimited Chatbots", "White Labeling", "Custom Domain", "Dedicated Support", "SLA Guarantee"],
};

export function formatMoney(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
