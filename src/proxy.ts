import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/widget",
  "/api/widget",
  "/api/auth",
];
const superAdminRoutes = ["/admin", "/api/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token?.role === "SUPER_ADMIN" && (pathname.startsWith("/dashboard"))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/api/")) {
    if (!token) {
      const apiKey =
        request.headers.get("x-api-key") ||
        request.headers.get("authorization")?.replace("Bearer ", "");
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }
    const response = NextResponse.next();
    response.headers.set("x-user-id", (token.id as string) || "");
    response.headers.set("x-user-role", (token.role as string) || "");
    response.headers.set("x-company-id", (token.companyId as string) || "");
    return response;
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    superAdminRoutes.some((r) => pathname.startsWith(r)) &&
    token.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|widget.js|.*\\.png$|.*\\.svg$).*)",
  ],
};
