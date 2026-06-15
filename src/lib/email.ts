import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || "SupportFlow <noreply@supportflow.app>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  if (!process.env.SMTP_USER) {
    console.warn("[email] SMTP_USER not configured, skipping email");
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html, text });
}

export function welcomeEmail(name: string, companyName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Welcome to SupportFlow!</h2>
      <p>Hi ${name},</p>
      <p>Your account for <strong>${companyName}</strong> has been created successfully.</p>
      <p>You can now log in and start managing your customer support operations.</p>
      <a href="${process.env.NEXTAUTH_URL}/login"
         style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
        Get Started
      </a>
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 12px;">SupportFlow – Enterprise Customer Engagement Platform</p>
    </div>
  `;
}

export function agentInviteEmail(name: string, tempPassword: string, companyName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">You've been invited to ${companyName}</h2>
      <p>Hi ${name},</p>
      <p>An administrator has created an agent account for you on SupportFlow.</p>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <a href="${process.env.NEXTAUTH_URL}/login"
         style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
        Log In
      </a>
    </div>
  `;
}

export function usageAlertEmail(companyName: string, resource: string, percentage: number): string {
  const isOver = percentage >= 100;
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isOver ? "#ef4444" : "#f59e0b"};">
        ${isOver ? "Usage Limit Reached" : `${percentage}% Usage Alert`}
      </h2>
      <p>Hi,</p>
      <p>${companyName} has ${isOver ? "reached" : `used ${percentage}% of`} its <strong>${resource}</strong> limit this month.</p>
      ${isOver
        ? `<p>New ${resource} will be blocked until you upgrade your plan or next billing cycle.</p>`
        : `<p>Consider upgrading your plan to avoid service interruption.</p>`}
      <a href="${process.env.NEXTAUTH_URL}/dashboard/billing"
         style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
        View Billing
      </a>
    </div>
  `;
}

export function ticketAssignedEmail(agentName: string, ticketNumber: string, subject: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Ticket Assigned to You</h2>
      <p>Hi ${agentName},</p>
      <p>Ticket <strong>${ticketNumber}</strong> has been assigned to you.</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/tickets"
         style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
        View Ticket
      </a>
    </div>
  `;
}
