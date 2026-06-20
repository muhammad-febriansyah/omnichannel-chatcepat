// GET /api/channels/facebook/oauth/callback — Meta redirect balik dgn ?code & ?state.
// Verifikasi state → tukar code jadi user token long-lived → simpan token di cookie
// httpOnly singkat → redirect ke halaman pilih Page. Token Page TIDAK pernah lewat URL.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  exchangeCodeForUserToken,
  signOAuthSession,
  verifyState,
  FB_OAUTH_COOKIE,
} from "@/lib/facebook";

function fail(request: Request, msg: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/channels/connect?error=${encodeURIComponent(msg)}`, request.url),
  );
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const q = new URL(request.url).searchParams;
  if (q.get("error")) return fail(request, "Login Facebook dibatalkan");

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return fail(request, "Parameter OAuth tidak lengkap");

  const st = await verifyState(state);
  // State harus valid DAN milik sesi yang sama (cegah CSRF / token dipakai user lain).
  if (!st || st.userId !== session.id || st.tenantId !== session.tenantId) {
    return fail(request, "Sesi OAuth tidak valid, coba lagi");
  }

  let userToken: string;
  try {
    userToken = await exchangeCodeForUserToken(code);
  } catch (e) {
    return fail(request, e instanceof Error ? e.message : "Gagal tukar token");
  }

  const sealed = await signOAuthSession({
    tenantId: st.tenantId,
    userToken,
    platform: st.platform,
  });
  const res = NextResponse.redirect(
    new URL(`/channels/connect/facebook/select?platform=${st.platform}`, request.url),
  );
  res.cookies.set(FB_OAUTH_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}
