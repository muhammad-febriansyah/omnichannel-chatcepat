// GET /api/channels/facebook/oauth/start?platform=facebook|instagram
// Mulai OAuth: gate auth + ability, tandatangani state (anti-CSRF), redirect ke dialog Meta.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { appUrl, authDialogUrl, signState, type MetaPlatform } from "@/lib/facebook";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(appUrl("/login"));
  if (!can(session, "channel.connect") || !session.tenantId) {
    return NextResponse.redirect(appUrl("/channels?error=forbidden"));
  }

  const platform: MetaPlatform =
    new URL(request.url).searchParams.get("platform") === "instagram" ? "instagram" : "facebook";

  let url: string;
  try {
    const state = await signState({ tenantId: session.tenantId, userId: session.id, platform });
    url = authDialogUrl(state, platform);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.redirect(appUrl(`/channels/connect?error=${encodeURIComponent(msg)}`));
  }
  return NextResponse.redirect(url);
}
