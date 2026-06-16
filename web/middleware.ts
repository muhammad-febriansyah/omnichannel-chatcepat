import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { can, type Ability, type Role } from "@/lib/rbac";

// Path → ability. Urut dari prefix terpanjang (spesifik dulu).
const GUARDS: { prefix: string; ability: Ability }[] = [
  { prefix: "/channels/connect", ability: "channel.connect" },
  { prefix: "/channels", ability: "channel.view" },
  { prefix: "/settings/users", ability: "user.manage" },
  { prefix: "/settings/business-hours", ability: "flow.manage" },
  { prefix: "/contacts", ability: "contact.view" },
  { prefix: "/tags", ability: "contact.manage" },
  { prefix: "/templates", ability: "broadcast.manage" },
  { prefix: "/broadcasts", ability: "broadcast.manage" },
  { prefix: "/flows", ability: "flow.manage" },
  { prefix: "/ai-agent", ability: "knowledge.manage" },
  { prefix: "/dashboard", ability: "report.view" },
  { prefix: "/reports", ability: "report.view" },
  { prefix: "/inbox", ability: "conversation.view_assigned" },
];

// Landing aman per-role (pasti punya ability halaman tujuan → tidak loop).
function landingFor(role: Role): string {
  if (role === "super_admin") return "/admin";
  if (role === "agent") return "/inbox";
  return "/dashboard";
}

// Gate admin panel: wajib login + cek ability per halaman.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySession(token);
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login";
  const isPublic = path.startsWith("/opt-in/"); // form opt-in publik (tanpa login)

  if (isPublic) return NextResponse.next();

  if (!valid && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (valid && isLogin) {
    return NextResponse.redirect(new URL(landingFor(valid.role), req.url));
  }

  // Pisah bidang platform vs tenant.
  if (valid) {
    const isPlatform = path === "/admin" || path.startsWith("/admin/");
    // super_admin hanya di /admin; selain itu lempar ke /admin.
    if (valid.role === "super_admin" && !isPlatform) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    // Role tenant tidak boleh masuk /admin.
    if (valid.role !== "super_admin" && isPlatform) {
      return NextResponse.redirect(new URL(landingFor(valid.role), req.url));
    }

    // Sub-halaman kontak (new/edit/delete/import) = mutasi → butuh contact.manage.
    if (path.startsWith("/contacts/") && !can({ role: valid.role }, "contact.manage")) {
      return NextResponse.redirect(new URL(landingFor(valid.role), req.url));
    }

    // RBAC per halaman (sinkron dgn filter sidebar). Enforcement mutasi tetap di Server Action.
    const guard = GUARDS.find((g) => path === g.prefix || path.startsWith(g.prefix + "/"));
    if (guard && !can({ role: valid.role }, guard.ability)) {
      return NextResponse.redirect(new URL(landingFor(valid.role), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)"],
};
