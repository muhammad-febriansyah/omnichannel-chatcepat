import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { auditLogs, tenants } from "./db/schema";
import type { Session } from "./session";

// Resolusi tenant untuk kolom tenant_id (NOT NULL di skema audit_logs lama).
// Aksi yang punya tenant terdampak pakai itu; aksi platform murni → tenant platform.
async function resolveTenantId(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  try {
    const slug = process.env.PLATFORM_TENANT_SLUG;
    const t = slug
      ? await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
      : await db.query.tenants.findFirst({ orderBy: (tt, { asc }) => asc(tt.createdAt) });
    return t?.id ?? null;
  } catch {
    return null;
  }
}

// Catat satu entri audit (append-only). Best-effort: kegagalan audit TIDAK
// menggagalkan aksi utama.
export async function writeAudit(
  session: Session,
  entry: {
    action: string;
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
    tenantId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const tenantId = await resolveTenantId(entry.tenantId);
    if (!tenantId) return; // tak ada tenant valid → lewati (kolom NOT NULL)

    let ip: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    } catch {
      /* di luar request scope */
    }

    // Skema lama: entity/entityId/diff. Detail tambahan (aktor email, ip, label) di diff.
    await db.insert(auditLogs).values({
      tenantId,
      actorId: session.id,
      action: entry.action,
      entity: entry.targetType ?? "platform",
      entityId: entry.targetId ?? null,
      diff: {
        actorEmail: session.email,
        targetLabel: entry.targetLabel ?? null,
        ip,
        ...(entry.metadata ?? {}),
      },
    });
  } catch {
    /* jangan ganggu aksi utama */
  }
}
