import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import EmailContact from "@/models/EmailContact";

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#374151}
      h1{font-size:20px;color:#111827}p{color:#6b7280;font-size:14px}</style></head>
      <body><h1>${title}</h1><p>${body}</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

// One-click unsubscribe — no login required (CAN-SPAM/GDPR requirement). The token
// is an unguessable random value on the contact record, not the Mongo _id.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return page("Invalid link", "This unsubscribe link is missing its token.");

  await connectDB();
  const contact = await EmailContact.findOneAndUpdate(
    { unsubscribeToken: token },
    { optIn: false, optOutAt: new Date() },
    { new: true }
  );

  if (!contact) return page("Invalid link", "We couldn't find a subscription matching this link.");

  return page("You're unsubscribed", `${contact.email} won't receive further campaign emails from us.`);
}
