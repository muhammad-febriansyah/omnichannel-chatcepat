"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, ChevronRight, CircleAlert, ExternalLink, Plus, Save, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createAutomationRule,
  createSocialAccount,
  connectSocialAccount,
  deleteAutomationRule,
  openSocialAccountBrowser,
  toggleAutomationRule,
  updateAutomationSettings,
  validateSocialAccountSession,
  type AutoReplyAction,
  type AutoReplyRule,
  type AutomationActivity,
  type AutomationSettings,
  type IncomingSocialEvent,
  type SocialAccount,
} from "@/lib/social-automation-actions";

type Tab = "rules" | "incoming" | "activity" | "settings";

const statusTone: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  matched: "bg-violet-50 text-violet-700",
  queued: "bg-amber-50 text-amber-700",
  processed: "bg-emerald-50 text-emerald-700",
  ignored: "bg-slate-100 text-slate-600",
  failed: "bg-red-50 text-red-700",
};

function emptyAction(source: string): AutoReplyAction {
  return {
    action_type: source === "message" ? "reply_message" : "reply_comment",
    content: "",
    sort_order: 1,
    is_active: true,
    responses: [],
  };
}

export function SocialAutomationPanel({
  accounts,
  rules,
  incoming,
  activity,
  settings,
}: {
  accounts: SocialAccount[];
  rules: AutoReplyRule[];
  incoming: IncomingSocialEvent[];
  activity: AutomationActivity[];
  settings: Record<string, AutomationSettings>;
}) {
  const [tab, setTab] = useState<Tab>("rules");
  const [showCreate, setShowCreate] = useState(false);
  const [showAccountCreate, setShowAccountCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await action();
        setNotice(success);
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Perubahan gagal disimpan");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {(notice || error) && (
        <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm", error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
          {error ? <CircleAlert className="size-4" /> : <Zap className="size-4" />}
          {error ?? notice}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-blue">Inbound guardrails</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-navy">Automation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Balas interaksi yang masuk dari Instagram dan Facebook dengan rule yang dapat ditinjau, dijeda, dan dicatat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowAccountCreate(true)} disabled={pending}>
            <Plus data-icon="inline-start" /> Tambah account
          </Button>
          <Button className="bg-brand-blue hover:bg-brand-blue/90" onClick={() => setShowCreate(true)} disabled={accounts.length === 0 || pending}>
            <Plus data-icon="inline-start" /> Buat rule
          </Button>
        </div>
      </div>

      <AccountsView
        accounts={accounts}
        pending={pending}
        onCreate={() => setShowAccountCreate(true)}
        onConnect={(id) => run(async () => { await connectSocialAccount(id); }, "Browser account dibuka. Silakan login manual lalu validasi session.")}
        onOpenBrowser={(id) => run(async () => { await openSocialAccountBrowser(id); }, "Browser account dibuka.")}
        onValidate={(id) => run(async () => { await validateSocialAccountSession(id); }, "Session account berhasil divalidasi.")}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Rule aktif" value={rules.filter((rule) => rule.is_active).length} tone="blue" />
        <Stat label="Event masuk" value={incoming.length} tone="violet" />
        <Stat label="Akun automation" value={Object.values(settings).filter((item) => item.automation_enabled).length} tone="emerald" />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["rules", "incoming", "activity", "settings"] as Tab[]).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={cn("border-b-2 px-3 py-2.5 text-sm font-medium capitalize transition-colors", tab === item ? "border-brand-blue text-brand-navy" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {item === "rules" ? "Rules" : item === "incoming" ? "Incoming" : item === "activity" ? "Activity" : "Settings"}
          </button>
        ))}
      </div>

      {tab === "rules" && <RulesView rules={rules} accounts={accounts} pending={pending} onToggle={(id, active) => run(() => toggleAutomationRule(id, !active), active ? "Rule dinonaktifkan" : "Rule diaktifkan")} onDelete={(id) => run(() => deleteAutomationRule(id), "Rule dihapus")} />}
      {tab === "incoming" && <IncomingView incoming={incoming} accounts={accounts} />}
      {tab === "activity" && <ActivityView activity={activity} />}
      {tab === "settings" && <SettingsView accounts={accounts} settings={settings} pending={pending} onSave={(id, value) => run(() => updateAutomationSettings(id, value), "Settings automation disimpan")} />}

      {showCreate && <CreateRuleDialog accounts={accounts} pending={pending} onClose={() => setShowCreate(false)} onSave={(input) => run(async () => { await createAutomationRule(input); setShowCreate(false); }, "Rule berhasil dibuat")} />}
      {showAccountCreate && <CreateSocialAccountDialog pending={pending} onClose={() => setShowAccountCreate(false)} onSave={(input) => run(async () => { const account = await createSocialAccount(input); await connectSocialAccount(account.id); setShowAccountCreate(false); }, "Account dibuat dan browser dibuka. Silakan login manual lalu validasi session.")} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "blue" | "violet" | "emerald" }) {
  return <Card className="rounded-xl shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-brand-navy">{value}</p></div><span className={cn("grid size-9 place-items-center rounded-lg", tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : "bg-emerald-50 text-emerald-600")}><Bot className="size-4" /></span></CardContent></Card>;
}

function AccountsView({ accounts, pending, onCreate, onConnect, onOpenBrowser, onValidate }: { accounts: SocialAccount[]; pending: boolean; onCreate: () => void; onConnect: (id: string) => void; onOpenBrowser: (id: string) => void; onValidate: (id: string) => void }) {
  return <Card className="rounded-xl shadow-none"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Social accounts</CardTitle><CardDescription>Profile browser terpisah untuk setiap Facebook dan Instagram. Login selalu dilakukan manual di Chromium.</CardDescription></div><Button variant="outline" size="sm" onClick={onCreate} disabled={pending}><Plus data-icon="inline-start" /> Tambah</Button></CardHeader><CardContent className="p-0">{accounts.length === 0 ? <Empty title="Belum ada social account" text="Tambahkan Facebook atau Instagram untuk mulai menghubungkan browser profile." /> : accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 first:border-t-0"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{account.name}</p><Badge variant="outline" className="capitalize">{account.platform}</Badge><AccountStatus status={account.status} /></div><p className="mt-1 text-xs text-muted-foreground">{account.username ? `@${account.username}` : "Username belum diisi"}{account.last_activity_at ? ` · Aktivitas ${new Date(account.last_activity_at).toLocaleString("id-ID")}` : ""}</p>{account.last_error && <p className="mt-1 max-w-xl text-xs text-red-700">{account.last_error}</p>}</div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={pending} onClick={() => onOpenBrowser(account.id)}><ExternalLink data-icon="inline-start" /> Buka browser</Button>{account.status === "connected" ? <Button variant="outline" size="sm" disabled={pending} onClick={() => onValidate(account.id)}>Validasi</Button> : <Button className="bg-brand-blue hover:bg-brand-blue/90" size="sm" disabled={pending} onClick={() => onConnect(account.id)}>Hubungkan</Button>}</div></div>)}</CardContent></Card>;
}

function AccountStatus({ status }: { status: string }) {
  const tone = status === "connected" ? "bg-emerald-50 text-emerald-700" : status === "action_required" ? "bg-orange-50 text-orange-700" : status === "paused" ? "bg-amber-50 text-amber-700" : status === "connecting" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  return <Badge className={cn("capitalize", tone)}>{status.replaceAll("_", " ")}</Badge>;
}

function RulesView({ rules, accounts, pending, onToggle, onDelete }: { rules: AutoReplyRule[]; accounts: SocialAccount[]; pending: boolean; onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void }) {
  if (accounts.length === 0) return <Empty title="Belum ada akun sosial" text="Hubungkan Facebook atau Instagram terlebih dahulu dari menu Channel." />;
  if (rules.length === 0) return <Empty title="Belum ada rule" text="Buat rule pertama untuk mencocokkan komentar atau pesan yang masuk." />;
  return <Card className="rounded-xl shadow-none"><CardHeader><CardTitle>Rule library</CardTitle><CardDescription>Rule default tetap OFF sampai automation pada akun dan action diaktifkan.</CardDescription></CardHeader><CardContent className="p-0">{rules.map((rule) => { const account = accounts.find((item) => item.id === rule.social_account_id); return <div key={rule.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 first:border-t-0"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{rule.name}</p><Badge className={rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>{rule.is_active ? "Active" : "Off"}</Badge><Badge variant="outline">{rule.platform}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{account?.name ?? "Account"} · {rule.source_type} · {rule.match_type} · {rule.keywords.join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">{rule.actions.filter((action) => action.is_active).map((action) => action.action_type).join(" + ") || "Tanpa action aktif"}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={pending} onClick={() => onToggle(rule.id, rule.is_active)}>{rule.is_active ? "Matikan" : "Aktifkan"}</Button><Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Hapus rule" onClick={() => onDelete(rule.id)}><Trash2 className="size-4 text-red-500" /></Button></div></div>; })}</CardContent></Card>;
}

function IncomingView({ incoming, accounts }: { incoming: IncomingSocialEvent[]; accounts: SocialAccount[] }) {
  return <Card className="rounded-xl shadow-none"><CardHeader><CardTitle>Incoming events</CardTitle><CardDescription>Event dari akun sendiri atau keyword ignore tidak akan dibuat menjadi action.</CardDescription></CardHeader><CardContent className="p-0">{incoming.length === 0 ? <Empty title="Belum ada interaksi" text="Scanner akan menyimpan komentar dan pesan baru saat akun automation diaktifkan." /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Waktu</th><th className="px-5 py-3 font-medium">Account</th><th className="px-5 py-3 font-medium">Tipe</th><th className="px-5 py-3 font-medium">Author</th><th className="px-5 py-3 font-medium">Content</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{incoming.map((event) => <tr key={event.id} className="border-b border-border last:border-0"><td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{new Date(event.received_at).toLocaleString("id-ID")}</td><td className="px-5 py-3">{accounts.find((item) => item.id === event.account_id)?.name ?? "—"}</td><td className="px-5 py-3"><Badge variant="outline">{event.platform} · {event.source_type}</Badge></td><td className="px-5 py-3">{event.author_name ?? event.external_id}</td><td className="max-w-[280px] truncate px-5 py-3">{event.content}</td><td className="px-5 py-3"><Badge className={statusTone[event.status] ?? "bg-slate-100 text-slate-600"}>{event.status}</Badge></td></tr>)}</tbody></table></div>}</CardContent></Card>;
}

function ActivityView({ activity }: { activity: AutomationActivity[] }) {
  return <Card className="rounded-xl shadow-none"><CardHeader><CardTitle>Automation activity</CardTitle><CardDescription>Riwayat scanner, queue, action, dan warning keamanan.</CardDescription></CardHeader><CardContent className="p-0">{activity.length === 0 ? <Empty title="Belum ada activity" text="Aktivitas automation akan muncul setelah scanner berjalan." /> : activity.map((item) => <div key={item.id} className="flex items-start gap-3 border-t border-border px-5 py-4 first:border-t-0"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-blue"><ChevronRight className="size-4" /></span><div className="min-w-0"><p className="text-sm font-medium">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{item.event} · {new Date(item.created_at).toLocaleString("id-ID")}</p></div></div>)}</CardContent></Card>;
}

function PostTargets({ urls, pending, onSave }: { urls: string[]; pending: boolean; onSave: (urls: string[]) => void }) {
  const [draft, setDraft] = useState(urls.join("\n"));
  return <div className="space-y-2"><label htmlFor="comment-post-urls" className="text-sm font-medium">Posting yang dipantau</label><Textarea id="comment-post-urls" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://www.instagram.com/p/.../" disabled={pending} /><p className="text-xs text-muted-foreground">Satu URL per baris, maksimal 50 posting. Balasan komentar dan private reply masing-masing sekali per pengguna per posting.</p><Button variant="outline" size="sm" disabled={pending} onClick={() => onSave(draft.split(/\r?\n/).map((url) => url.trim()).filter(Boolean))}>Simpan posting</Button></div>;
}

function SettingsView({ accounts, settings, pending, onSave }: { accounts: SocialAccount[]; settings: Record<string, AutomationSettings>; pending: boolean; onSave: (id: string, value: Omit<AutomationSettings, "social_account_id">) => void }) {
  const [selected, setSelected] = useState(accounts[0]?.id ?? "");
  const current = settings[selected];
  if (!accounts.length) return <Empty title="Belum ada akun sosial" text="Hubungkan akun Facebook atau Instagram terlebih dahulu." />;
  if (!current) return <Empty title="Settings belum tersedia" text="Pilih akun yang valid untuk memuat settings." />;
  const update = (patch: Partial<AutomationSettings>) => onSave(selected, { ...current, ...patch, social_account_id: undefined } as Omit<AutomationSettings, "social_account_id">);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.7fr)]"><Card className="rounded-xl shadow-none"><CardHeader><CardTitle>Per-account controls</CardTitle><CardDescription>Automation selalu dimulai dalam keadaan OFF.</CardDescription></CardHeader><CardContent className="space-y-4"><label className="text-sm font-medium">Social account<select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.platform}</option>)}</select></label><PostTargets key={selected + JSON.stringify(current.comment_post_urls)} urls={current.comment_post_urls ?? []} pending={pending} onSave={(urls) => update({ comment_post_urls: urls })} /><Toggle label="Automation" description="Izinkan rule membuat action dari incoming event." value={current.automation_enabled} onChange={(value) => update({ automation_enabled: value })} /><Toggle label="Comment scanner" description="Cari komentar pada URL posting yang dipantau." value={current.comment_scanner_enabled} onChange={(value) => update({ comment_scanner_enabled: value })} /><Toggle label="Message scanner" description="Cari DM/Messenger baru dari browser profile." value={current.message_scanner_enabled} onChange={(value) => update({ message_scanner_enabled: value })} /><Toggle label="Reply comment" description="Izinkan action membalas komentar." value={current.comment_reply_enabled} onChange={(value) => update({ comment_reply_enabled: value })} /><Toggle label="Comment → private reply" description="Private reply hanya untuk event komentar yang tersimpan." value={current.comment_private_reply_enabled} onChange={(value) => update({ comment_private_reply_enabled: value })} /><Toggle label="Reply message" description="Izinkan balasan DM/Messenger yang masuk." value={current.message_reply_enabled} onChange={(value) => update({ message_reply_enabled: value })} /><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Cooldown (detik)<Input className="mt-2" type="number" min={0} value={current.reply_cooldown_seconds} disabled={pending} onChange={(event) => update({ reply_cooldown_seconds: Number(event.target.value) })} /></label><label className="text-sm font-medium">Max consecutive errors<Input className="mt-2" type="number" min={1} value={current.max_consecutive_errors} disabled={pending} onChange={(event) => update({ max_consecutive_errors: Number(event.target.value) })} /></label></div></CardContent></Card><Card className="rounded-xl border-amber-200 bg-amber-50/60 shadow-none"><CardHeader><CardTitle className="text-amber-950">Safety stop</CardTitle><CardDescription className="text-amber-900/70">CAPTCHA, checkpoint, login challenge, dan temporary block menghentikan worker secara otomatis.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-amber-950"><p>Account akan menjadi <strong>action_required</strong> atau <strong>paused</strong>. Selesaikan challenge secara manual melalui browser account, lalu resume dari Channel.</p><div className="flex items-center gap-2 text-xs font-medium"><CircleAlert className="size-4" /> Tidak ada cold DM atau bypass challenge.</div></CardContent></Card></div>;
}

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors", value ? "border-blue-200 bg-blue-50/70" : "border-border bg-background hover:bg-muted/40")}><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{description}</span></span><span className={cn("relative h-6 w-11 rounded-full transition-colors", value ? "bg-brand-blue" : "bg-slate-200")}><span className={cn("absolute top-1 size-4 rounded-full bg-white transition-transform", value ? "translate-x-6" : "translate-x-1")} /></span></button>;
}

function CreateSocialAccountDialog({ pending, onClose, onSave }: { pending: boolean; onClose: () => void; onSave: (input: { name: string; platform: "facebook" | "instagram"; username?: string; external_user_id?: string }) => void }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram">("instagram");
  const [username, setUsername] = useState("");
  const [externalUserID, setExternalUserID] = useState("");
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-blue">Social account</p><h2 className="mt-1 text-xl font-semibold text-brand-navy">Tambah account</h2><p className="mt-1 text-sm text-muted-foreground">Browser profile akan dibuat terpisah. Jangan masukkan password ke aplikasi.</p></div><Button variant="ghost" size="sm" onClick={onClose}>Tutup</Button></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">Nama account<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Instagram Shop" /></label><label className="block text-sm font-medium">Platform<select value={platform} onChange={(event) => setPlatform(event.target.value as "facebook" | "instagram")} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><label className="block text-sm font-medium">Username <span className="font-normal text-muted-foreground">(opsional)</span><Input className="mt-2" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="namaakun" /></label><label className="block text-sm font-medium">External user ID <span className="font-normal text-muted-foreground">(opsional)</span><Input className="mt-2" value={externalUserID} onChange={(event) => setExternalUserID(event.target.value)} placeholder="ID profil jika tersedia" /></label><div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm leading-6 text-blue-950">Setelah disimpan, Chromium akan dibuka. Login dan 2FA dilakukan manual di browser, lalu klik <strong>Validasi</strong>.</div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Batal</Button><Button className="bg-brand-blue hover:bg-brand-blue/90" disabled={pending || !name.trim()} onClick={() => onSave({ name: name.trim(), platform, ...(username.trim() ? { username: username.trim() } : {}), ...(externalUserID.trim() ? { external_user_id: externalUserID.trim() } : {}) })}><Save data-icon="inline-start" /> Simpan & buka browser</Button></div></div></div>;
}

function CreateRuleDialog({ accounts, pending, onClose, onSave }: { accounts: SocialAccount[]; pending: boolean; onClose: () => void; onSave: (input: { account_id: string; name: string; platform: string; source_type: string; match_type: string; is_active: boolean; priority: number; keywords: string[]; actions: AutoReplyAction[] }) => void }) {
  const [accountID, setAccountID] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((item) => item.id === accountID) ?? accounts[0];
  const [name, setName] = useState("Interested Customer");
  const [source, setSource] = useState("comment");
  const [match, setMatch] = useState("contains");
  const [priority, setPriority] = useState(0);
  const [keywords, setKeywords] = useState("mau, info, tertarik");
  const [actions, setActions] = useState<AutoReplyAction[]>([emptyAction("comment"), { action_type: "send_private_reply", content: "", sort_order: 2, is_active: true, responses: [] }]);
  const setAction = (index: number, patch: Partial<AutoReplyAction>) => setActions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4"><div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-blue">Rule builder</p><h2 className="mt-1 text-xl font-semibold text-brand-navy">Buat auto-reply rule</h2><p className="mt-1 text-sm text-muted-foreground">Rule cocok untuk incoming interaction; bukan untuk cold outreach.</p></div><Button variant="ghost" size="sm" onClick={onClose}>Tutup</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Nama rule<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm font-medium">Account<select value={accountID} onChange={(event) => setAccountID(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.platform}</option>)}</select></label><label className="text-sm font-medium">Source<select value={source} onChange={(event) => { const value = event.target.value; setSource(value); setActions([emptyAction(value)]); }} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="comment">Comment</option><option value="message">Message</option></select></label><label className="text-sm font-medium">Matching<select value={match} onChange={(event) => setMatch(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="exact">Exact</option><option value="contains">Contains</option><option value="starts_with">Starts with</option></select></label><label className="text-sm font-medium">Priority<Input className="mt-2" type="number" min={0} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></label><label className="text-sm font-medium sm:col-span-2">Keywords<span className="mt-1 block text-xs font-normal text-muted-foreground">Pisahkan dengan koma. Matching bersifat case-insensitive.</span><Input className="mt-2" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="mau, info, tertarik" /></label></div><div className="mt-6 rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Actions</p><p className="mt-1 text-xs text-muted-foreground">Urutan dieksekusi dari atas ke bawah.</p></div><Button variant="outline" size="sm" onClick={() => setActions((items) => [...items, { ...emptyAction(source), sort_order: items.length + 1 }])}><Plus data-icon="inline-start" /> Add action</Button></div><div className="mt-4 space-y-3">{actions.map((action, index) => <div key={`${index}-${action.action_type}`} className="rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action {index + 1}</p>{actions.length > 1 && <Button variant="ghost" size="icon-sm" onClick={() => setActions((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4 text-red-500" /></Button>}</div><select value={action.action_type} onChange={(event) => setAction(index, { action_type: event.target.value as AutoReplyAction["action_type"] })} className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="reply_comment" disabled={source !== "comment"}>Reply comment</option><option value="send_private_reply" disabled={source !== "comment"}>Send private reply</option><option value="reply_message" disabled={source !== "message"}>Reply message</option></select><Textarea className="mt-2" value={action.content} onChange={(event) => setAction(index, { content: event.target.value })} placeholder="Tulis response..." /><Input className="mt-2" value={action.responses?.join(" | ") ?? ""} onChange={(event) => setAction(index, { responses: event.target.value.split("|").map((item) => item.trim()).filter(Boolean) })} placeholder="Variasi opsional, pisahkan dengan |" /></div>)}</div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Batal</Button><Button className="bg-brand-blue hover:bg-brand-blue/90" disabled={pending || !account} onClick={() => onSave({ account_id: accountID, name, platform: account.platform, source_type: source, match_type: match, is_active: true, priority, keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean), actions: actions.map((action, index) => ({ ...action, sort_order: index + 1 })) })}><Save data-icon="inline-start" /> Simpan rule</Button></div></div></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <Card className="rounded-xl border-dashed shadow-none"><CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><Bot className="size-7 text-muted-foreground/60" /><p className="mt-3 font-medium text-foreground">{title}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p></CardContent></Card>;
}
