import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Socket.IO is handled via custom server",
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
  });
}
