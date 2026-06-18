import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plug, Users2, Contact, MessageSquare, Power, PowerOff } from "lucide-react";
import { requireSession } from "@/lib/session";
import { cleanIDR, CHANNEL_META, statusLabel, roleLabel, type ChannelType } from "@/lib/format";
import { PLAN_LABEL } from "@/lib/plan";
import { getTenantDetail } from "@/lib/platform-stats";
import { setTenantStatus } from "@/lib/actions";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const t = await getTenantDetail(id);
  if (!t) notFound();

  const suspended = t.status === "suspended";
  const toggle = setTenantStatus.bind(null, t.id, suspended ? "active" : "suspended");

  const cards = [
    { label: "Channel", value: t.counts.channels, icon: Plug, tone: "#8b5cf6" },
    { label: "User", value: t.counts.users, icon: Users2, tone: "#3b82f6" },
    { label: "Kontak", value: t.counts.contacts, icon: Contact, tone: "#10b981" },
    { label: "Pesan Bulan Ini", value: t.counts.messagesThisMonth, icon: MessageSquare, tone: "#f59e0b" },
  ];

  return (
    <div className="p-6 sm:p-8">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Ringkasan
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-navy to-brand-blue text-sm font-bold text-white">
            {t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{t.name}</h1>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                {PLAN_LABEL[t.plan]}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${suspended ? "text-danger" : "text-success"}`}
              >
                <span className={`size-1.5 rounded-full ${suspended ? "bg-danger" : "bg-success"}`} />
                {suspended ? "Disuspend" : "Aktif"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">/{t.slug} · dibuat {fmtDate(t.createdAt)}</p>
          </div>
        </div>

        <form action={toggle}>
          <button
            type="submit"
            className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90 ${suspended ? "bg-success" : "bg-danger"}`}
          >
            {suspended ? <Power className="size-4" /> : <PowerOff className="size-4" />}
            {suspended ? "Aktifkan" : "Suspend"}
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <span className="flex size-9 items-center justify-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}>
                <Icon className="size-[18px]" />
              </span>
              <div className="mt-3 text-2xl font-bold tracking-tight">{cleanIDR(c.value)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Users */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Anggota ({t.users.length})</h2>
          {t.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada user.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {t.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {roleLabel(u.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Channels */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Channel ({t.channels.length})</h2>
          {t.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada channel.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {t.channels.map((c) => {
                const meta = CHANNEL_META[c.type as ChannelType];
                return (
                  <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: meta?.color ?? "#94a3b8" }} />
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{meta?.label ?? c.type}</span>
                    </div>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
