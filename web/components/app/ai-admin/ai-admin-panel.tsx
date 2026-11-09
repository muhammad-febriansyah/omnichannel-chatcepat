"use client";

import { errorMessage } from "@/lib/action-error";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, Coins, Gift, KeyRound, Loader2, Pencil, Plug, Plus, Sparkles, Zap } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DeleteButton } from "@/components/app/delete-button";
import { SimpleSelect } from "@/components/app/simple-select";
import { StatCard } from "@/components/app/stat-card";
import {
  deleteModel,
  deletePack,
  deleteProvider,
  grantTokens,
  saveModel,
  savePack,
  saveProvider,
  setFeature,
  testProvider,
  type ModelInput,
  type PackInput,
  type ProviderInput,
} from "@/lib/ai-admin-actions";
import { AI_FEATURES, PROVIDER_KINDS, featureLabel, sampleCost, type AiFeatureKey } from "@/lib/ai-admin-options";
import { fmtTokens } from "@/lib/plan-config";

export type AiAdminData = {
  providers: { id: string; name: string; kind: string; baseUrl: string; isActive: boolean; keyHint: string }[];
  models: {
    id: string;
    providerId: string;
    model: string;
    label: string;
    purpose: "chat" | "embedding";
    inputMultiplier: number;
    outputMultiplier: number;
    isActive: boolean;
  }[];
  features: { feature: string; modelId: string | null; isEnabled: boolean }[];
  packs: { id: string; name: string; tokens: number; priceIdr: number; validDays: number; isActive: boolean; sortOrder: number }[];
  usageByTenant: { tenantId: string; name: string; calls: number; charged: number; rawTokens: number }[];
  usageByFeature: { feature: string; model: string; calls: number; charged: number; rawTokens: number }[];
  tenants: { id: string; name: string }[];
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const numOnly = (s: string) => Number(s.replace(/[^\d]/g, "") || 0);
const decOnly = (s: string) => {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

// Wrap a server action: pending state, toast, refresh.
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<unknown>, success: string, after?: () => void) {
    start(async () => {
      try {
        await fn();
        gooeyToast.success(success);
        after?.();
        router.refresh();
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menyimpan");
      }
    });
  }
  return { pending, run };
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// --- Providers -------------------------------------------------------------------------

const EMPTY_PROVIDER: ProviderInput = { name: "", kind: "anthropic", apiKey: "", baseUrl: "", isActive: true };

function ProvidersCard({ data }: { data: AiAdminData }) {
  const { pending, run } = useRun();
  const [edit, setEdit] = useState<{ id: string | null; v: ProviderInput } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [found, setFound] = useState<Record<string, string[]>>({});

  async function test(id: string) {
    setTesting(id);
    try {
      const r = await testProvider(id);
      if (r.ok) {
        gooeyToast.success(r.message);
        setFound((f) => ({ ...f, [id]: r.models }));
      } else gooeyToast.error(`Gagal: ${r.message}`);
    } finally {
      setTesting(null);
    }
  }

  const columns: ColumnDef<AiAdminData["providers"][number]>[] = [
    {
      accessorKey: "name",
      header: "Provider",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{PROVIDER_KINDS.find((k) => k.value === row.original.kind)?.label}</p>
        </div>
      ),
    },
    { accessorKey: "keyHint", header: "API key", cell: ({ row }) => <code className="text-xs">{row.original.keyHint}</code> },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.isActive ? "secondary" : "outline"}>{row.original.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      id: "aksi",
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => test(p.id)} disabled={testing === p.id}>
              {testing === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />} Tes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEdit({ id: p.id, v: { name: p.name, kind: p.kind as ProviderInput["kind"], apiKey: "", baseUrl: p.baseUrl, isActive: p.isActive } })}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
            <DeleteButton
              onConfirm={() => deleteProvider(p.id)}
              title="Hapus provider?"
              description={<>Provider <b>{p.name}</b> dan semua modelnya dihapus. Fitur yang memakai modelnya kembali ke default server.</>}
              successMessage="Provider dihapus"
            />
          </div>
        );
      },
    },
  ];

  const kindHint = PROVIDER_KINDS.find((k) => k.value === edit?.v.kind)?.hint;
  const allFound = Object.values(found).flat();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" /> Provider AI
          </CardTitle>
          <CardDescription>API key disimpan terenkripsi. Klik “Tes” untuk cek koneksi dan melihat daftar model.</CardDescription>
        </div>
        <Button onClick={() => setEdit({ id: null, v: EMPTY_PROVIDER })}>
          <Plus className="size-4" /> Tambah provider
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data.providers} searchable={false} emptyMessage="Belum ada provider. Tambahkan API key Anthropic/OpenAI agar AI bisa dipakai tenant." />
        {allFound.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Model tersedia: <span className="font-mono">{allFound.slice(0, 12).join(", ")}{allFound.length > 12 ? ` +${allFound.length - 12}` : ""}</span>
          </p>
        )}
      </CardContent>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && !pending && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit provider" : "Tambah provider"}</DialogTitle>
            <DialogDescription>{kindHint}</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <Field label="Nama" htmlFor="pv-name">
                <Input id="pv-name" value={edit.v.name} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, name: e.target.value } })} placeholder="mis. Anthropic utama" className="h-10" />
              </Field>
              <Field label="Jenis">
                <SimpleSelect
                  value={edit.v.kind}
                  onChange={(k) => setEdit({ ...edit, v: { ...edit.v, kind: k as ProviderInput["kind"] } })}
                  options={PROVIDER_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                />
              </Field>
              {edit.v.kind === "openai_compatible" && (
                <Field label="Base URL" hint="mis. https://generativelanguage.googleapis.com/v1beta/openai" htmlFor="pv-url">
                  <Input id="pv-url" value={edit.v.baseUrl} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, baseUrl: e.target.value } })} className="h-10 font-mono text-xs" />
                </Field>
              )}
              <Field label="API key" hint={edit.id ? "Kosongkan untuk tetap memakai key lama." : undefined} htmlFor="pv-key">
                <Input id="pv-key" type="password" autoComplete="off" value={edit.v.apiKey} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, apiKey: e.target.value } })} placeholder={edit.id ? "••••••••" : "sk-…"} className="h-10 font-mono" />
              </Field>
              <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium">
                Aktif
                <Switch checked={edit.v.isActive} onCheckedChange={(x) => setEdit({ ...edit, v: { ...edit.v, isActive: x } })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={pending}>Batal</Button>
            <Button disabled={pending} onClick={() => edit && run(() => saveProvider(edit.id, edit.v), "Provider disimpan", () => setEdit(null))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Models ----------------------------------------------------------------------------

function ModelsCard({ data }: { data: AiAdminData }) {
  const { pending, run } = useRun();
  const [edit, setEdit] = useState<{ id: string | null; v: ModelInput } | null>(null);
  const providerName = (id: string) => data.providers.find((p) => p.id === id)?.name ?? "—";

  const columns: ColumnDef<AiAdminData["models"][number]>[] = [
    {
      accessorKey: "label",
      header: "Model",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.model} · {providerName(row.original.providerId)}</p>
        </div>
      ),
    },
    {
      accessorKey: "purpose",
      header: "Jenis",
      cell: ({ row }) => <Badge variant="outline">{row.original.purpose === "chat" ? "Chat" : "Embedding"}</Badge>,
    },
    {
      id: "potongan",
      header: "Pengali (input / output)",
      cell: ({ row }) => (
        <span className="tabular-nums">
          ×{row.original.inputMultiplier} / ×{row.original.outputMultiplier}
        </span>
      ),
    },
    {
      id: "contoh",
      header: "≈ per balasan",
      cell: ({ row }) =>
        row.original.purpose === "chat" ? (
          <span className="tabular-nums">{sampleCost(row.original.inputMultiplier, row.original.outputMultiplier).toLocaleString("id-ID")} token</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.isActive ? "secondary" : "outline"}>{row.original.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      id: "aksi",
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setEdit({ id: m.id, v: { providerId: m.providerId, model: m.model, label: m.label, purpose: m.purpose, inputMultiplier: m.inputMultiplier, outputMultiplier: m.outputMultiplier, isActive: m.isActive } })}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <DeleteButton onConfirm={() => deleteModel(m.id)} title="Hapus model?" description={<>Model <b>{m.label}</b> dihapus. Fitur yang memakainya kembali ke default server.</>} successMessage="Model dihapus" />
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" /> Model & potongan token
          </CardTitle>
          <CardDescription>
            Token tenant yang dipotong = token model × pengali. Contoh: model hemat ×1, model premium ×5 — harga premium otomatis lebih mahal.
          </CardDescription>
        </div>
        <Button
          disabled={data.providers.length === 0}
          onClick={() => setEdit({ id: null, v: { providerId: data.providers[0]?.id ?? "", model: "", label: "", purpose: "chat", inputMultiplier: 1, outputMultiplier: 1, isActive: true } })}
        >
          <Plus className="size-4" /> Tambah model
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data.models} searchPlaceholder="Cari model…" emptyMessage="Belum ada model. Tambahkan provider dulu, lalu daftarkan model yang dijual." />
      </CardContent>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && !pending && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit model" : "Tambah model"}</DialogTitle>
            <DialogDescription>Pengali menentukan berapa token tenant terpotong per token model.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider">
                  <SimpleSelect value={edit.v.providerId} onChange={(x) => setEdit({ ...edit, v: { ...edit.v, providerId: x } })} options={data.providers.map((p) => ({ value: p.id, label: p.name }))} />
                </Field>
                <Field label="Jenis">
                  <SimpleSelect
                    value={edit.v.purpose}
                    onChange={(x) => setEdit({ ...edit, v: { ...edit.v, purpose: x as ModelInput["purpose"] } })}
                    options={[
                      { value: "chat", label: "Chat (balasan)" },
                      { value: "embedding", label: "Embedding (pencarian)" },
                    ]}
                  />
                </Field>
              </div>
              <Field label="ID model" hint="Persis seperti di dokumentasi provider, mis. claude-sonnet-5-5, gpt-4o-mini, text-embedding-3-small" htmlFor="md-id">
                <Input id="md-id" value={edit.v.model} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, model: e.target.value } })} className="h-10 font-mono" />
              </Field>
              <Field label="Nama tampilan" htmlFor="md-label">
                <Input id="md-label" value={edit.v.label} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, label: e.target.value } })} placeholder="mis. Claude Sonnet (premium)" className="h-10" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pengali input" htmlFor="md-in">
                  <Input id="md-in" inputMode="decimal" value={String(edit.v.inputMultiplier)} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, inputMultiplier: decOnly(e.target.value) } })} className="h-10 tabular-nums" />
                </Field>
                <Field label="Pengali output" htmlFor="md-out">
                  <Input id="md-out" inputMode="decimal" value={String(edit.v.outputMultiplier)} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, outputMultiplier: decOnly(e.target.value) } })} className="h-10 tabular-nums" />
                </Field>
              </div>
              {edit.v.purpose === "chat" && (
                <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                  Satu balasan AI (~1.500 token prompt + 200 token jawaban) memotong ≈{" "}
                  <b className="text-foreground">{sampleCost(edit.v.inputMultiplier, edit.v.outputMultiplier).toLocaleString("id-ID")} token</b> tenant.
                </p>
              )}
              <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium">
                Aktif
                <Switch checked={edit.v.isActive} onCheckedChange={(x) => setEdit({ ...edit, v: { ...edit.v, isActive: x } })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={pending}>Batal</Button>
            <Button disabled={pending} onClick={() => edit && run(() => saveModel(edit.id, edit.v), "Model disimpan", () => setEdit(null))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Features → model -------------------------------------------------------------------

function FeaturesCard({ data }: { data: AiAdminData }) {
  const { pending, run } = useRun();
  const current = (f: AiFeatureKey) => data.features.find((x) => x.feature === f) ?? { feature: f, modelId: null, isEnabled: true };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Model per fitur
        </CardTitle>
        <CardDescription>
          Pilih model untuk tiap fitur AI. “Default server” = provider dari env engine (LLM_PROVIDER). Fitur dimatikan = tidak dipakai di semua tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AI_FEATURES.map((f) => {
          const c = current(f.value);
          const options = data.models
            .filter((m) => m.purpose === f.purpose && m.isActive)
            .map((m) => ({ value: m.id, label: `${m.label} · ×${m.inputMultiplier}/×${m.outputMultiplier}` }));
          return (
            <div key={f.value} className="grid items-center gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_320px_auto]">
              <div>
                <p className="font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <SimpleSelect
                value={c.modelId ?? "__env"}
                onChange={(v) => run(() => setFeature(f.value, v === "__env" ? null : v, c.isEnabled), "Model fitur disimpan")}
                options={[{ value: "__env", label: "Default server (env)" }, ...options]}
                disabled={pending}
              />
              <div className="flex items-center gap-2 text-sm">
                <Switch checked={c.isEnabled} disabled={pending} onCheckedChange={(x) => run(() => setFeature(f.value, c.modelId, x), x ? "Fitur diaktifkan" : "Fitur dimatikan")} />
                {c.isEnabled ? "Aktif" : "Mati"}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Perubahan berlaku di engine paling lambat 30 detik.</p>
      </CardContent>
    </Card>
  );
}

// --- Top-up packs -----------------------------------------------------------------------

function PacksCard({ data }: { data: AiAdminData }) {
  const { pending, run } = useRun();
  const [edit, setEdit] = useState<{ id: string | null; v: PackInput } | null>(null);
  const columns: ColumnDef<AiAdminData["packs"][number]>[] = [
    { accessorKey: "name", header: "Paket", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "tokens", header: "Token", cell: ({ row }) => <span className="tabular-nums">{row.original.tokens.toLocaleString("id-ID")}</span> },
    { accessorKey: "priceIdr", header: "Harga", cell: ({ row }) => <span className="tabular-nums">{rupiah(row.original.priceIdr)}</span> },
    { accessorKey: "validDays", header: "Berlaku", cell: ({ row }) => `${row.original.validDays} hari` },
    {
      id: "per1k",
      header: "Per 1.000 token",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{rupiah(Math.round((row.original.priceIdr / row.original.tokens) * 1000))}</span>,
    },
    { accessorKey: "isActive", header: "Status", cell: ({ row }) => <Badge variant={row.original.isActive ? "secondary" : "outline"}>{row.original.isActive ? "Dijual" : "Disembunyikan"}</Badge> },
    {
      id: "aksi",
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, v: { name: p.name, tokens: p.tokens, priceIdr: p.priceIdr, validDays: p.validDays, isActive: p.isActive, sortOrder: p.sortOrder } })}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <DeleteButton onConfirm={() => deletePack(p.id)} title="Hapus paket top-up?" description={<>Paket <b>{p.name}</b> tidak dijual lagi. Token yang sudah dibeli tenant tetap berlaku.</>} successMessage="Paket dihapus" />
          </div>
        );
      },
    },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Paket top-up token AI
          </CardTitle>
          <CardDescription>Dijual di halaman Tagihan tenant. Contoh: 300.000 token · Rp15.000 · 30 hari.</CardDescription>
        </div>
        <Button onClick={() => setEdit({ id: null, v: { name: "", tokens: 300_000, priceIdr: 15_000, validDays: 30, isActive: true, sortOrder: data.packs.length } })}>
          <Plus className="size-4" /> Paket baru
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data.packs} searchable={false} emptyMessage="Belum ada paket top-up." />
      </CardContent>
      <Dialog open={edit !== null} onOpenChange={(o) => !o && !pending && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit paket top-up" : "Paket top-up baru"}</DialogTitle>
            <DialogDescription>Token dari top-up dipakai setelah kuota bulanan paket habis, dan hangus setelah masa berlaku.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <Field label="Nama paket" htmlFor="pk-name">
                <Input id="pk-name" value={edit.v.name} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, name: e.target.value } })} placeholder="mis. Hemat 300K" className="h-10" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Token" htmlFor="pk-tok">
                  <Input id="pk-tok" inputMode="numeric" value={edit.v.tokens.toLocaleString("id-ID")} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, tokens: numOnly(e.target.value) } })} className="h-10 tabular-nums" />
                </Field>
                <Field label="Harga (Rp)" htmlFor="pk-price">
                  <Input id="pk-price" inputMode="numeric" value={edit.v.priceIdr.toLocaleString("id-ID")} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, priceIdr: numOnly(e.target.value) } })} className="h-10 tabular-nums" />
                </Field>
                <Field label="Berlaku (hari)" htmlFor="pk-days">
                  <Input id="pk-days" inputMode="numeric" value={String(edit.v.validDays)} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, validDays: numOnly(e.target.value) } })} className="h-10 tabular-nums" />
                </Field>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium">
                Dijual ke tenant
                <Switch checked={edit.v.isActive} onCheckedChange={(x) => setEdit({ ...edit, v: { ...edit.v, isActive: x } })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={pending}>Batal</Button>
            <Button disabled={pending} onClick={() => edit && run(() => savePack(edit.id, edit.v), "Paket disimpan", () => setEdit(null))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --- Usage ------------------------------------------------------------------------------

function UsageView({ data }: { data: AiAdminData }) {
  const { pending, run } = useRun();
  const [grant, setGrant] = useState<{ tenantId: string; tokens: number; days: number; note: string } | null>(null);
  const totals = useMemo(
    () => data.usageByFeature.reduce((a, r) => ({ calls: a.calls + r.calls, charged: a.charged + r.charged, raw: a.raw + r.rawTokens }), { calls: 0, charged: 0, raw: 0 }),
    [data.usageByFeature],
  );
  const featureCols: ColumnDef<AiAdminData["usageByFeature"][number]>[] = [
    { accessorKey: "feature", header: "Fitur", cell: ({ row }) => featureLabel(row.original.feature) },
    { accessorKey: "model", header: "Model", cell: ({ row }) => <span className="font-mono text-xs">{row.original.model}</span> },
    { accessorKey: "calls", header: "Panggilan", cell: ({ row }) => row.original.calls.toLocaleString("id-ID") },
    { accessorKey: "rawTokens", header: "Token model", cell: ({ row }) => row.original.rawTokens.toLocaleString("id-ID") },
    { accessorKey: "charged", header: "Token dipotong", cell: ({ row }) => <b>{row.original.charged.toLocaleString("id-ID")}</b> },
  ];
  const tenantCols: ColumnDef<AiAdminData["usageByTenant"][number]>[] = [
    { accessorKey: "name", header: "Tenant", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "calls", header: "Panggilan", cell: ({ row }) => row.original.calls.toLocaleString("id-ID") },
    { accessorKey: "charged", header: "Token dipotong", cell: ({ row }) => <b>{row.original.charged.toLocaleString("id-ID")}</b> },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Panggilan AI (30 hari)" value={totals.calls.toLocaleString("id-ID")} icon={Activity} tone="#2547F9" />
        <StatCard label="Token model terpakai" value={fmtTokens(totals.raw)} icon={Sparkles} tone="#8B5CF6" />
        <StatCard label="Token tenant dipotong" value={fmtTokens(totals.charged)} icon={Coins} tone="#10B981" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per fitur & model</CardTitle>
          <CardDescription>30 hari terakhir.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={featureCols} data={data.usageByFeature} searchable={false} emptyMessage="Belum ada pemakaian AI." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Per tenant</CardTitle>
            <CardDescription>30 hari terakhir. Beri token bonus untuk kompensasi atau promo.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setGrant({ tenantId: data.tenants[0]?.id ?? "", tokens: 100_000, days: 30, note: "" })}>
            <Gift className="size-4" /> Beri token
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={tenantCols} data={data.usageByTenant} searchPlaceholder="Cari tenant…" emptyMessage="Belum ada pemakaian AI." />
        </CardContent>
      </Card>
      <Dialog open={grant !== null} onOpenChange={(o) => !o && !pending && setGrant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beri token bonus</DialogTitle>
            <DialogDescription>Ditambahkan ke saldo token AI tenant, hangus setelah masa berlaku.</DialogDescription>
          </DialogHeader>
          {grant && (
            <div className="space-y-4">
              <Field label="Tenant">
                <SimpleSelect value={grant.tenantId} onChange={(x) => setGrant({ ...grant, tenantId: x })} options={data.tenants.map((t) => ({ value: t.id, label: t.name }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Token" htmlFor="gr-tok">
                  <Input id="gr-tok" inputMode="numeric" value={grant.tokens.toLocaleString("id-ID")} onChange={(e) => setGrant({ ...grant, tokens: numOnly(e.target.value) })} className="h-10 tabular-nums" />
                </Field>
                <Field label="Berlaku (hari)" htmlFor="gr-days">
                  <Input id="gr-days" inputMode="numeric" value={String(grant.days)} onChange={(e) => setGrant({ ...grant, days: numOnly(e.target.value) })} className="h-10" />
                </Field>
              </div>
              <Field label="Catatan" htmlFor="gr-note">
                <Input id="gr-note" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} placeholder="mis. Kompensasi gangguan 12 Nov" className="h-10" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrant(null)} disabled={pending}>Batal</Button>
            <Button disabled={pending} onClick={() => grant && run(() => grantTokens(grant.tenantId, grant.tokens, grant.days, grant.note), "Token ditambahkan", () => setGrant(null))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Tambahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AiAdminPanel({ tab, data }: { tab: "model" | "fitur" | "topup" | "pemakaian"; data: AiAdminData }) {
  if (tab === "fitur") return <FeaturesCard data={data} />;
  if (tab === "topup") return <PacksCard data={data} />;
  if (tab === "pemakaian") return <UsageView data={data} />;
  return (
    <div className="space-y-5">
      <ProvidersCard data={data} />
      <ModelsCard data={data} />
    </div>
  );
}
