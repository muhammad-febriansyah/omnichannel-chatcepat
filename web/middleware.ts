import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Gate admin panel: wajib login. /login bebas; sesi valid di /login → ke /dashboard.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySession(token);
  const isLogin = req.nextUrl.pathname === "/login";

  if (!valid && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (valid && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)"],
};
