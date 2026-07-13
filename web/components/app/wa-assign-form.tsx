"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listApiCoAccounts } from "@/lib/actions";
import { assignWaOfficialNumber, reviewWaOfficialRequest } from "@/lib/wa-request-actions";
import { WaRequestStatusBadge } from "@/components/app/wa-request-status-badge";
import type { ApiCoAccount } from "@/lib/apico-server";
import type { WaRequestRow } from "@/lib/wa-requests";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

export function WaAssignForm({ request, claimed }: { request: WaRequestRow; claimed: string[] }) {
  const done = request.status === "approved";
  const [accounts, setAccounts] = useState<ApiCoAccount[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(!done);
  const [accErr, setAccErr] = useState("");
  const [picked, setPicked] = useState("");
  const [channelName, setChannelName] = useState(request.businessName);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const claimedSet = new Set(claimed);

  useEffect(() => {
    if (done) return;
    let alive = true;
    listApiCoAccounts("wa_official")
      .then((r) => {
        if (!alive) return;
        setAccounts(r.accounts);
        setAccErr(r.error ?? "");
      })
      .finally(() => alive && setLoadingAcc(false));
    return () => {
      alive = false;
    };
  }, [done]);

  function assign() {
    if (!picked) return gooeyToast.error("Pilih nomor dari daftar");
    if (!channelName.trim()) return gooeyToast.error("Nama channel wajib diisi");
    start(async () => {
      try {
        await assignWaOfficialNumber({ requestId: request.id, externalId: picked, channelName: channelName.trim() });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal assign nomor";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  function review(action: "in_review" | "reject") {
    if (action === "reject" && !reason.trim()) return gooeyToast.error("Isi alasan penolakan");
    start(async () => {
      try {
        await reviewWaOfficialRequest({ requestId: request.id, action, reason: reason.trim() || undefined });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal memperbarui pengajuan";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Detail pengajuan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">{request.businessName}</CardTitle>
            <WaRequestStatusBadge status={request.status} />
          </div>
          <CardDescription>Tenant: {request.tenantName}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="Nomor diminta" value={request.phoneNumber} />
            <Field label="PIC" value={request.contactName ?? "—"} />
            <Field label="Catatan" value={request.notes ?? "—"} full />
            {request.rejectionReason && <Field label="Alasan tolak" value={request.rejectionReason} full danger />}
          </dl>
        </CardContent>
      </Card>

      {done ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="size-5 shrink-0" />
          Sudah di-assign. Channel WhatsApp Official tenant aktif (nomor: {request.externalId}).
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign Nomor</CardTitle>
            <CardDescription>
              Pilih nomor yang sudah di-onboard di panel provider. Belum ada? Onboard dulu di sana, lalu muat ulang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nomor Provider</label>
              {loadingAcc ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Memuat nomor…
                </div>
              ) : accErr ? (
                <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-xs text-danger dark:border-red-500/30 dark:bg-red-500/10">
                  Gagal ambil nomor dari provider. {accErr}
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10">
                  Belum ada nomor di provider. Onboard nomor dulu di panel provider, lalu muat ulang halaman ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((a) => {
                    const taken = claimedSet.has(a.externalId);
                    return (
                      <button
                        key={a.externalId}
                        type="button"
                        disabled={taken}
                        onClick={() => setPicked(a.externalId)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          picked === a.externalId ? "border-brand-blue bg-blue-50 dark:bg-blue-500/10" : "border-border hover:border-brand-blue/40"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{a.name}</span>
                          {a.detail && <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>}
                        </span>
                        {taken ? (
                          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">sudah dipakai</span>
                        ) : (
                          picked === a.externalId && <Check className="size-4 shrink-0 text-brand-blue" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="channelName" className="mb-1.5 block text-sm font-medium">
                Nama Channel
              </label>
              <input
                id="channelName"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="WA Toko Utama"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => review("in_review")}
                className="px-4"
              >
                Tandai Ditinjau
              </Button>
              <Button type="button" size="lg" disabled={pending || !picked} onClick={assign} className="px-5">
                <Check className="size-4" /> {pending ? "Memproses…" : "Assign & Aktifkan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tolak */}
      {!done && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-danger">Tolak Pengajuan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Alasan penolakan (mis. nomor tidak valid)"
              className={inputCls}
            />
            <div className="flex justify-end">
              <Button type="button" variant="outline" disabled={pending} onClick={() => review("reject")} className="border-red-300 px-4 text-danger hover:bg-red-50">
                Tolak
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, full, danger }: { label: string; value: string; full?: boolean; danger?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${danger ? "text-danger" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}
