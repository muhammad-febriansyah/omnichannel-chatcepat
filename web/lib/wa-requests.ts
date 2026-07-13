import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { waOfficialRequests, tenants, channels } from "./db/schema";

export type WaRequestStatus = "pending" | "in_review" | "approved" | "rejected";

export interface WaRequestRow {
  id: string;
  tenantId: string;
  tenantName: string;
  businessName: string;
  phoneNumber: string;
  contactName: string | null;
  notes: string | null;
  status: WaRequestStatus;
  channelId: string | null;
  externalId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE_COLS = {
  id: waOfficialRequests.id,
  tenantId: waOfficialRequests.tenantId,
  tenantName: tenants.name,
  businessName: waOfficialRequests.businessName,
  phoneNumber: waOfficialRequests.phoneNumber,
  contactName: waOfficialRequests.contactName,
  notes: waOfficialRequests.notes,
  status: waOfficialRequests.status,
  channelId: waOfficialRequests.channelId,
  externalId: waOfficialRequests.externalId,
  rejectionReason: waOfficialRequests.rejectionReason,
  createdAt: waOfficialRequests.createdAt,
  updatedAt: waOfficialRequests.updatedAt,
};

// Pengajuan milik satu tenant (dashboard client). Selalu scope tenant_id.
export async function listMyWaRequests(tenantId: string): Promise<WaRequestRow[]> {
  const rows = await db
    .select(BASE_COLS)
    .from(waOfficialRequests)
    .innerJoin(tenants, eq(waOfficialRequests.tenantId, tenants.id))
    .where(eq(waOfficialRequests.tenantId, tenantId))
    .orderBy(desc(waOfficialRequests.createdAt));
  return rows as WaRequestRow[];
}

// Semua pengajuan (konsol admin platform). Join nama tenant.
export async function listAllWaRequests(): Promise<WaRequestRow[]> {
  const rows = await db
    .select(BASE_COLS)
    .from(waOfficialRequests)
    .innerJoin(tenants, eq(waOfficialRequests.tenantId, tenants.id))
    .orderBy(desc(waOfficialRequests.createdAt));
  return rows as WaRequestRow[];
}

export async function getWaRequest(id: string): Promise<WaRequestRow | null> {
  const rows = await db
    .select(BASE_COLS)
    .from(waOfficialRequests)
    .innerJoin(tenants, eq(waOfficialRequests.tenantId, tenants.id))
    .where(eq(waOfficialRequests.id, id))
    .limit(1);
  return (rows[0] as WaRequestRow) ?? null;
}

// external_id nomor WA Official yang sudah dipakai channel — buat disable di assign
// (satu nomor = satu channel; kalau dobel, routing inbound jadi ambigu).
export async function listClaimedWaExternalIds(): Promise<string[]> {
  const rows = await db
    .select({ e: channels.externalId })
    .from(channels)
    .where(and(eq(channels.type, "wa_official"), isNotNull(channels.externalId)));
  return rows.map((r) => r.e).filter((e): e is string => !!e);
}

// Berapa pengajuan aktif (pending/in_review) milik tenant — cegah spam duplikat.
export async function countOpenWaRequests(tenantId: string): Promise<number> {
  const rows = await db
    .select({ id: waOfficialRequests.id })
    .from(waOfficialRequests)
    .where(
      and(eq(waOfficialRequests.tenantId, tenantId), eq(waOfficialRequests.status, "pending")),
    );
  return rows.length;
}
