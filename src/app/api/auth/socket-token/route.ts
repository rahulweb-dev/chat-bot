import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { signToken } from "@/lib/jwt";
import { apiError, apiSuccess } from "@/lib/api-helpers";

// Socket.IO's handshake can't carry the NextAuth session cookie the way a
// normal same-origin fetch does, so the dashboard client calls this
// authenticated (cookie-based) route first to mint a short-lived, SIGNED
// token, then hands that token to the socket handshake instead. The socket
// server verifies it with the existing JWT branch in src/server/socket.ts —
// it no longer needs (or accepts) a raw, unsigned user id as "proof" of
// identity, which previously let anyone who knew another user's Mongo
// ObjectId open a socket connection impersonating that user.
export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return apiError("Unauthorized", 401);

  const token = signToken(
    {
      id: session.user.id,
      email: session.user.email || "",
      role: session.user.role,
      companyId: session.user.companyId,
    },
    "2h"
  );

  return apiSuccess({ token });
}
