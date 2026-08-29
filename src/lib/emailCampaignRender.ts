// Substitutes {{name}}/{{email}} placeholders and appends the required unsubscribe
// footer. Every campaign send goes through this — there's no path that skips the
// unsubscribe link, since that's a compliance requirement (CAN-SPAM/GDPR), not a nicety.
export function renderCampaignEmail(html: string, contact: { name?: string; email: string }, unsubscribeUrl: string): string {
  const body = html
    .replace(/\{\{\s*name\s*\}\}/gi, contact.name || "there")
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email);

  return `${body}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:sans-serif;font-size:11px;color:#9ca3af;text-align:center">
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a> from these emails
    </div>`;
}
