// GET /api/channels/facebook/oauth/callback — Meta redirect balik dgn ?code & ?state.
// Verifikasi state → tukar code jadi user token long-lived → simpan token di cookie
// httpOnly singkat → redirect ke halaman pilih Page. Token Page TIDAK pernah lewat URL.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { authCookieOptions } from "@/lib/auth";
import {
  appUrl,
  exchangeCodeForUserToken,
  signOAuthSession,
  verifyState,
  FB_OAUTH_COOKIE,
} from "@/lib/facebook";

function fail(msg: string): NextResponse {
  return NextResponse.redirect(appUrl(`/channels/connect?error=${encodeURIComponent(msg)}`));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(appUrl("/login"));

  const q = new URL(request.url).searchParams;
  if (q.get("error")) return fail("Login Facebook dibatalkan");

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return fail("Parameter OAuth tidak lengkap");

  const st = await verifyState(state);
  // State harus valid DAN milik sesi yang sama (cegah CSRF / token dipakai user lain).
  if (!st || st.userId !== session.id || st.tenantId !== session.tenantId) {
    return fail("Sesi OAuth tidak valid, coba lagi");
  }

  let userToken: string;
  try {
    userToken = await exchangeCodeForUserToken(code);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal tukar token");
  }

  const sealed = await signOAuthSession({
    tenantId: st.tenantId,
    userToken,
    platform: st.platform,
  });
  const res = NextResponse.redirect(
    appUrl(`/channels/connect/facebook/select?platform=${st.platform}`),
  );
  res.cookies.set(FB_OAUTH_COOKIE, sealed, authCookieOptions(15 * 60));
  return res;
}
