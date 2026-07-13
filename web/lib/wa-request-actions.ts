"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { channels, waOfficialRequests } from "./db/schema";
import { requireSession } from "./session";
import { requireAbility } from "./rbac";
import { encryptCreds } from "./channel-crypto";
import { listApiCoAccounts as fetchApiCoAccounts } from "./apico-server";
import { writeAudit } from "./audit";

// --- Client: ajukan WhatsApp Official ---
// Tenant tak bisa self-onboard (embedded signup ada di sisi provider). Kirim
// pengajuan → operator onboard + assign. Ability channel.connect (client punya).
export async function requestWaOfficial(input: {
  businessName: string;
  phoneNumber: string;
  contactName?: string;
  notes?: string;
}): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "channel.connect");
  if (!session.tenantId) throw new Error("Tenant tidak ditemukan");

  const businessName = input.businessName.trim();
  const phoneNumber = input.phoneNumber.replace(/[^\d+]/g, "").trim();
  if (!businessName) throw new Error("Nama bisnis wajib diisi");
  if (phoneNumber.replace(/\D/g, "").length < 8) throw new Error("Nomor tidak valid");

  await db.insert(waOfficialRequests).values({
    tenantId: session.tenantId,
    businessName,
    phoneNumber,
    contactName: input.contactName?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "pending",
  });

  await writeAudit(session, {
    action: "wa_request.create",
    targetType: "wa_official_request",
    targetLabel: businessName,
  });

  revalidatePath("/channels/request-wa-official");
  redirect("/channels/request-wa-official?submitted=1");
}

// --- Admin: assign nomor api.co.id ke pengajuan → bikin channel apico untuk tenant. ---
export async function assignWaOfficialNumber(input: {
  requestId: string;
  externalId: string;
  channelName: string;
}): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "tenant.manage"); // admin-only (client tak punya)

  const channelName = input.channelName.trim();
  if (!channelName) throw new Error("Nama channel wajib diisi");
  if (!input.externalId) throw new Error("Pilih nomor dari daftar");

  const req = await db.query.waOfficialRequests.findFirst({
    where: eq(waOfficialRequests.id, input.requestId),
  });
  if (!req) throw new Error("Pengajuan tidak ditemukan");
  if (req.status === "approved") throw new Error("Pengajuan sudah di-assign");

  // Cegah channel phantom: nomor HARUS benar-benar ada di api.co.id.
  const { accounts, error } = await fetchApiCoAccounts("wa_official");
  if (error) throw new Error(`Gagal menghubungi penyedia WhatsApp: ${error}`);
  const match = accounts.find((a) => a.externalId === input.externalId);
  if (!match) throw new Error("Nomor tidak ditemukan di penyedia. Onboard dulu di panel provider.");

  // Satu nomor = satu channel. Kalau sudah dipakai, routing inbound jadi ambigu.
  const claimed = await db
    .select({ id: channels.id, tenantId: channels.tenantId })
    .from(channels)
    .where(and(eq(channels.type, "wa_official"), eq(channels.externalId, input.externalId)))
    .limit(1);
  if (claimed[0]) {
    throw new Error("Nomor ini sudah dipakai channel lain. Pilih nomor berbeda.");
  }

  // Channel dibuat untuk tenant PEMILIK pengajuan (bukan sesi admin).
  const [ch] = await db
    .insert(channels)
    .values({
      tenantId: req.tenantId,
      type: "wa_official",
      name: channelName,
      status: "connected",
      // external_id + apico_phone_number_id = id record api.co.id (clyyy…):
      //   gateway resolve inbound via external_id; Send() pakai apico_phone_number_id.
      credentials: encryptCreds({ apico_phone_number_id: input.externalId }),
      externalId: input.externalId,
      meta: { provider: "apico" },
      autoReplyEnabled: true,
    })
    .returning({ id: channels.id });

  await db
    .update(waOfficialRequests)
    .set({
      status: "approved",
      channelId: ch.id,
      externalId: input.externalId,
      reviewedBy: session.id,
      rejectionReason: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(waOfficialRequests.id, req.id));

  await writeAudit(session, {
    action: "wa_request.approve",
    targetType: "wa_official_request",
    targetId: req.id,
    targetLabel: req.businessName,
    tenantId: req.tenantId,
    metadata: { externalId: input.externalId, channelId: ch.id, number: match.detail ?? match.name },
  });

  revalidatePath("/admin/wa-requests");
  redirect("/admin/wa-requests?assigned=1");
}

// --- Admin: tolak / mark in_review ---
export async function reviewWaOfficialRequest(input: {
  requestId: string;
  action: "in_review" | "reject";
  reason?: string;
}): Promise<void> {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");

  const req = await db.query.waOfficialRequests.findFirst({
    where: eq(waOfficialRequests.id, input.requestId),
  });
  if (!req) throw new Error("Pengajuan tidak ditemukan");
  if (req.status === "approved") throw new Error("Pengajuan sudah di-assign, tak bisa diubah");

  const reject = input.action === "reject";
  await db
    .update(waOfficialRequests)
    .set({
      status: reject ? "rejected" : "in_review",
      rejectionReason: reject ? input.reason?.trim() || "Ditolak operator" : null,
      reviewedBy: session.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(waOfficialRequests.id, req.id));

  await writeAudit(session, {
    action: reject ? "wa_request.reject" : "wa_request.review",
    targetType: "wa_official_request",
    targetId: req.id,
    targetLabel: req.businessName,
    tenantId: req.tenantId,
  });

  revalidatePath("/admin/wa-requests");
  redirect("/admin/wa-requests");
}
