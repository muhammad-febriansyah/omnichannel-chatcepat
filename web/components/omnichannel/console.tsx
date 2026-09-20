"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CircleDot,
  Clock3,
  Command,
  Camera,
  LayoutDashboard,
  MessageCircle,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type View = "dashboard" | "inbox" | "comments" | "automations" | "contacts" | "channels" | "pending" | "activity" | "settings";
type Channel = { id: string; name: string; channel_type: string; status: string; metadata?: { username?: string; driver?: string }; automation_paused?: boolean; last_error?: string | null };
type Dashboard = Record<string, number>;
type Comment = { id: string; username: string; text: string; post_id: string; status: string; channel_name: string; automation_status: string; commented_at: string };
type Automation = { id: string; name: string; channel_type: string; event_type: string; status: string; runs: number };
type Pending = { id: string; action_type: string; status: string; channel_name: string; username: string; text: string; created_at: string };
type Contact = { id: string; name: string; username?: string; identities: number; created_at: string };
type ActivityItem = { id: string; type: string; description: string; created_at: string };

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: MessageCircle },
  { id: "comments", label: "Comments", icon: MessageSquareText },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "channels", label: "Channels", icon: Camera },
  { id: "pending", label: "Pending Actions", icon: Clock3 },
  { id: "activity", label: "Activity Logs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function statusLabel(status: string) {
  return {
    healthy: "Healthy",
    connected: "Connected",
    needs_attention: "Needs attention",
    challenge_required: "Verification required",
    rate_limited: "Rate limited",
    disabled: "Paused",
    disconnected: "Disconnected",
  }[status] ?? status.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (status === "healthy" || status === "connected" || status === "success") return "success";
  if (["needs_attention", "challenge_required", "rate_limited", "failed"].includes(status)) return "warning";
  return "neutral";
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return <Badge variant={tone === "warning" ? "destructive" : tone === "success" ? "default" : "secondary"}>{statusLabel(status)}</Badge>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function OmnichannelConsole() {
  const [view, setView] = useState<View>("dashboard");
  const [workspaceId, setWorkspaceId] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("omnichannel_workspace_id") || "");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (workspaceId) headers.set("X-Workspace-ID", workspaceId);
    const response = await fetch(`${apiBase}/api${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meData, dashboardData, channelData, commentData, automationData, pendingData, contactData, activityData] = await Promise.all([
        request("/me"), request("/dashboard"), request("/channels"), request("/comments"), request("/automations"), request("/pending-actions"), request("/contacts"), request("/activity"),
      ]);
      if (!workspaceId && meData.workspace_id) {
        setWorkspaceId(meData.workspace_id);
        window.localStorage.setItem("omnichannel_workspace_id", meData.workspace_id);
      }
      setDashboard(dashboardData);
      setChannels(channelData);
      setComments(commentData.data || []);
      setAutomations(automationData || []);
      setPending(pendingData || []);
      setContacts(contactData || []);
      setActivities(activityData || []);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Backend belum merespons" });
    } finally {
      setLoading(false);
    }
  }, [request, workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!workspaceId) return;
    const events = new EventSource(`${apiBase}/api/events?workspace_id=${encodeURIComponent(workspaceId)}`);
    events.onmessage = () => { void refresh(); };
    return () => events.close();
  }, [workspaceId, refresh]);

  const filteredComments = useMemo(() => comments.filter((comment) => `${comment.username} ${comment.text}`.toLowerCase().includes(search.toLowerCase())), [comments, search]);

  function persistWorkspace(value: string) {
    setWorkspaceId(value);
    window.localStorage.setItem("omnichannel_workspace_id", value);
  }

  async function runAction(action: () => Promise<void>, successText: string) {
    try { await action(); setNotice({ type: "success", text: successText }); await refresh(); } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "Aksi gagal" }); }
  }

  const firstChannel = channels[0];

  return (
    <div className="min-h-dvh bg-[#f7f8fb] text-[#162033]">
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
        <aside className="hidden w-[236px] shrink-0 flex-col border-r border-[#e7eaf1] bg-white px-4 py-5 lg:flex">
          <div className="flex items-center gap-3 px-2 pb-8">
            <div className="grid size-9 place-items-center rounded-xl bg-[#2547F9] text-white shadow-[0_7px_18px_rgba(37,71,249,.2)]"><Command className="size-4" /></div>
            <div><p className="text-sm font-semibold tracking-tight">signal<span className="text-[#2547F9]">desk</span></p><p className="text-[10px] uppercase tracking-[.18em] text-slate-400">omnichannel ops</p></div>
          </div>
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          <nav className="flex flex-col gap-1">
            {navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2547F9]/40", view === id ? "bg-[#eef2ff] font-medium text-[#2547F9]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}><Icon className="size-4" />{label}{id === "pending" && pending.length > 0 && <span className="ml-auto rounded-full bg-[#2547F9] px-1.5 py-0.5 text-[10px] text-white">{pending.length}</span>}</button>)}
          </nav>
          <div className="mt-auto rounded-xl border border-[#e7eaf1] bg-[#fbfcff] p-3">
            <div className="mb-2 flex items-center gap-2"><ShieldCheck className="size-4 text-[#2547F9]" /><span className="text-xs font-medium">Safety controls</span></div>
            <p className="text-[11px] leading-relaxed text-slate-500">Outbound actions stop automatically when an account needs attention.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex min-h-[68px] items-center justify-between border-b border-[#e7eaf1] bg-white/95 px-5 backdrop-blur sm:px-8">
            <div><p className="text-[11px] font-medium uppercase tracking-[.16em] text-slate-400">Workspace console</p><h1 className="text-lg font-semibold tracking-tight">{navigation.find((item) => item.id === view)?.label}</h1></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => void refresh()} aria-label="Refresh data" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2547F9]/40"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button><div className="hidden items-center gap-2 rounded-full border border-[#e7eaf1] bg-slate-50 px-3 py-1.5 text-xs sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" />Realtime connected</div></div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-[#e7eaf1] bg-white px-5 py-2 lg:hidden">{navigation.map(({ id, label }) => <button key={id} type="button" onClick={() => setView(id)} className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-xs", view === id ? "bg-[#2547F9] text-white" : "bg-slate-100 text-slate-600")}>{label}</button>)}</div>
          <div className="p-5 sm:p-8">{notice && <div className={cn("mb-5 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm", notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X className="size-4" /></button></div>}{view === "dashboard" && <DashboardView dashboard={dashboard} channels={channels} pending={pending} onNavigate={setView} />}{view === "channels" && <ChannelsView channels={channels} onConnect={() => setShowConnect(true)} onAction={(id, action) => void runAction(() => request(`/channels/${id}/${action}`, { method: "POST" }).then(() => undefined), action === "pause" ? "Automation paused" : "Account resumed")} onMock={(id, channelType) => void runAction(() => request(`/dev/${channelType}/mock-comments`, { method: "POST", body: JSON.stringify({ connection_id: id, post_id: "post-001", count: 50 }) }).then(() => undefined), "50 incoming comments queued")} />}{view === "comments" && <CommentsView comments={filteredComments} search={search} onSearch={setSearch} />}{view === "automations" && <AutomationsView automations={automations} channel={firstChannel} onCreate={() => void runAction(() => request("/automations", { method: "POST", body: JSON.stringify({ name: "Instagram keyword → agent", channel_type: "instagram", event_type: "comment.created", status: "active", conditions: [{ type: "text", operator: "contains", value: "mau", case_sensitive: false }], actions: [{ type: "create_contact", execution_mode: "auto", config: {} }, { type: "add_tag", execution_mode: "auto", config: { tag: "Lead Instagram" } }, { type: "notify_agent", execution_mode: "auto", config: {} }] }) }).then(() => undefined), "Starter automation created")} onToggle={(id, active) => void runAction(() => request(`/automations/${id}/${active ? "deactivate" : "activate"}`, { method: "POST" }).then(() => undefined), active ? "Automation deactivated" : "Automation activated")} />}{view === "pending" && <PendingView pending={pending} onReview={(id, action) => void runAction(() => request(`/pending-actions/${id}/${action}`, { method: "POST" }).then(() => undefined), action === "approve" ? "Action approved" : "Action rejected")} />}{view === "contacts" && <ContactsView contacts={contacts} />}{view === "activity" && <ActivityView activities={activities} />}{view === "inbox" && <InboxView />}{view === "settings" && <SettingsView workspaceId={workspaceId} onSave={persistWorkspace} />}</div>
        </main>
      </div>
      {showConnect && <ConnectDialog onClose={() => setShowConnect(false)} onConnect={(payload) => void runAction(() => request(`/channels/${payload.channel_type}/connect`, { method: "POST", body: JSON.stringify(payload) }).then(() => { setShowConnect(false); }), `${payload.channel_type === "facebook" ? "Facebook" : "Instagram"} account connected`)} />}
    </div>
  );
}

function DashboardView({ dashboard, channels, pending, onNavigate }: { dashboard: Dashboard; channels: Channel[]; pending: Pending[]; onNavigate: (view: View) => void }) {
  const stats = [{ label: "Connected channels", key: "connected_channels", icon: CircleDot }, { label: "Comments today", key: "comments_today", icon: MessageSquareText }, { label: "New contacts", key: "new_contacts", icon: Users }, { label: "Automation runs", key: "automation_runs", icon: Zap }];
  return <div className="flex flex-col gap-7"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-medium text-[#2547F9]">Good morning, team</p><h2 className="max-w-xl text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">Keep every conversation within reach.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">One operating view for Instagram and WhatsApp signals, automation safety, and the next human action.</p></div><Button onClick={() => onNavigate("channels")} className="w-fit bg-[#2547F9] hover:bg-[#1d39cc]"><Plus data-icon="inline-start" /> Connect channel</Button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, key, icon: Icon }) => <Card key={key} className="rounded-xl shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{dashboard[key] ?? 0}</p></div><span className="grid size-10 place-items-center rounded-xl bg-[#eef2ff] text-[#2547F9]"><Icon className="size-4" /></span></CardContent></Card>)}</div><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><Card className="rounded-xl shadow-none"><CardHeader className="flex-row items-start justify-between space-y-0 border-b border-[#eef0f4]"><div><CardTitle>Channel signal</CardTitle><CardDescription>Health state across connected accounts</CardDescription></div><button type="button" onClick={() => onNavigate("channels")} className="flex items-center gap-1 text-xs font-medium text-[#2547F9]">View channels <ArrowRight className="size-3" /></button></CardHeader><CardContent className="p-0">{channels.length === 0 ? <EmptyState icon={Camera} title="No channels yet" text="Connect a mock Instagram account to start the end-to-end flow." action="Connect Instagram" onClick={() => onNavigate("channels")} /> : channels.map((channel) => <div key={channel.id} className="flex items-center justify-between gap-4 border-b border-[#eef0f4] px-5 py-4 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white"><Camera className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{channel.name}</p><p className="truncate text-xs text-slate-500">{channel.metadata?.username ? `@${channel.metadata.username}` : "Instagram"}</p></div></div><StatusBadge status={channel.status} /></div>)}</CardContent></Card><Card className="rounded-xl shadow-none"><CardHeader className="border-b border-[#eef0f4]"><CardTitle>Attention queue</CardTitle><CardDescription>Human review before outbound actions</CardDescription></CardHeader><CardContent className="p-0">{pending.length === 0 ? <EmptyState icon={ShieldCheck} title="Queue is clear" text="Manual actions will appear here when automation needs review." /> : pending.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-[#eef0f4] px-5 py-4 last:border-0"><span className="grid size-8 place-items-center rounded-full bg-amber-50 text-amber-700"><Clock3 className="size-3.5" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{item.action_type.replaceAll("_", " ")}</p><p className="truncate text-xs text-slate-500">{item.username} · {item.text}</p></div></div>)}</CardContent></Card></div></div>;
}

function ChannelsView({ channels, onConnect, onAction, onMock }: { channels: Channel[]; onConnect: () => void; onAction: (id: string, action: "pause" | "resume") => void; onMock: (id: string, channelType: string) => void }) {
  return <div className="flex flex-col gap-6"><PageIntro eyebrow="Channel registry" title="Channels that stay observable." text="Every account has its own health state, rate limit, circuit breaker, and driver. Core automation never calls a provider directly." action={<Button onClick={onConnect} className="bg-[#2547F9] hover:bg-[#1d39cc]"><Plus data-icon="inline-start" /> Connect channel</Button>} />{channels.length === 0 ? <Card className="rounded-xl shadow-none"><EmptyState icon={Camera} title="Connect your first channel" text="Use mock drivers while provider credentials are not available." action="Connect mock channel" onClick={onConnect} /></Card> : <div className="grid gap-4 xl:grid-cols-2">{channels.map((channel) => <Card key={channel.id} className="rounded-xl shadow-none"><CardHeader className="flex-row items-start justify-between space-y-0"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f2f4ff] text-[#2547F9]"><Camera className="size-5" /></span><div><CardTitle>{channel.name}</CardTitle><CardDescription>{channel.metadata?.username ? `@${channel.metadata.username}` : channel.channel_type} · driver {channel.metadata?.driver || "mock"}</CardDescription></div></div><StatusBadge status={channel.status} /></CardHeader><CardContent className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Automation</p><p className="mt-1 font-medium">{channel.automation_paused ? "Paused" : channel.status === "healthy" ? "Running" : "Stopped"}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Safety</p><p className="mt-1 font-medium">Per-account guard active</p></div></div>{channel.last_error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{channel.last_error}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => onAction(channel.id, channel.automation_paused ? "resume" : "pause")}>{channel.automation_paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}{channel.automation_paused ? "Resume" : "Pause"}</Button><Button variant="secondary" size="sm" onClick={() => onMock(channel.id, channel.channel_type)}><MessageSquareText data-icon="inline-start" /> Simulate 50 comments</Button></div></CardContent></Card>)}</div>}</div>;
}

function CommentsView({ comments, search, onSearch }: { comments: Comment[]; search: string; onSearch: (value: string) => void }) { return <div className="flex flex-col gap-6"><PageIntro eyebrow="Inbound signals" title="Comments, normalized." text="Incoming comments become generic events before automation sees them." /><Card className="rounded-xl shadow-none"><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Comment stream</CardTitle><CardDescription>Server-side list · latest first</CardDescription></div><div className="relative w-full max-w-[220px]"><Search className="absolute left-2.5 top-2 size-3.5 text-slate-400" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search user or text" className="pl-8" /></div></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Comment</TableHead><TableHead>Post</TableHead><TableHead>Automation</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{comments.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState icon={MessageSquareText} title="No comments yet" text="Use the mock simulator from Channels to create inbound comments." /></TableCell></TableRow> : comments.map((comment) => <TableRow key={comment.id}><TableCell className="font-medium">@{comment.username}</TableCell><TableCell className="max-w-[260px] truncate">{comment.text}</TableCell><TableCell className="text-slate-500">{comment.post_id}</TableCell><TableCell><StatusBadge status={comment.automation_status} /></TableCell><TableCell><StatusBadge status={comment.status} /></TableCell><TableCell className="text-slate-500">{formatDate(comment.commented_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div>; }

function AutomationsView({ automations, channel, onCreate, onToggle }: { automations: Automation[]; channel?: Channel; onCreate: () => void; onToggle: (id: string, active: boolean) => void }) { return <div className="flex flex-col gap-6"><PageIntro eyebrow="Automation engine" title="Rules that know when to stop." text="Build on normalized events. Outbound actions stay behind health, rate, circuit, and approval checks." action={<Button onClick={onCreate} disabled={!channel} className="bg-[#2547F9] hover:bg-[#1d39cc]"><Plus data-icon="inline-start" /> Create starter rule</Button>} />{!channel && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Connect an Instagram mock account before creating a rule.</div>}<div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><Card className="rounded-xl shadow-none"><CardHeader><CardTitle>Rule library</CardTitle><CardDescription>Conditions are evaluated case-insensitively by default.</CardDescription></CardHeader><CardContent className="p-0">{automations.length === 0 ? <EmptyState icon={Bot} title="No rules yet" text="Create the starter rule to match comments containing “Mau”." /> : automations.map((automation) => <div key={automation.id} className="flex items-center justify-between gap-4 border-t border-[#eef0f4] px-5 py-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{automation.name}</p><StatusBadge status={automation.status} /></div><p className="mt-1 text-xs text-slate-500">{automation.event_type} · {automation.runs} runs</p></div><Button variant="outline" size="sm" onClick={() => onToggle(automation.id, automation.status === "active")}>{automation.status === "active" ? "Deactivate" : "Activate"}</Button></div>)}</CardContent></Card><Card className="rounded-xl bg-[#17223b] text-white shadow-none"><CardHeader><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-200">Starter recipe</p><CardTitle className="text-white">Comment → qualified lead</CardTitle><CardDescription className="text-slate-300">A simple inbound workflow for the mock environment.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">{["Instagram comment received", "Text contains “Mau”", "Create contact + add tag", "Notify agent"].map((item, index) => <div key={item} className="flex items-center gap-3 text-sm"><span className="grid size-6 place-items-center rounded-full bg-white/10 text-xs text-blue-200">{index + 1}</span>{item}</div>)}</CardContent></Card></div></div>; }

function PendingView({ pending, onReview }: { pending: Pending[]; onReview: (id: string, action: "approve" | "reject") => void }) { return <div className="flex flex-col gap-6"><PageIntro eyebrow="Human review" title="Pending actions" text="Manual approval is the safe default for outbound channel actions." /><Card className="rounded-xl shadow-none"><CardContent className="p-0">{pending.length === 0 ? <EmptyState icon={Check} title="Nothing needs review" text="Approved and rejected actions will leave this queue." /> : pending.map((item) => <div key={item.id} className="flex flex-col gap-4 border-b border-[#eef0f4] px-5 py-5 last:border-0 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-full bg-amber-50 text-amber-700"><Clock3 className="size-4" /></span><div><p className="text-sm font-medium">{item.action_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">@{item.username} · {item.text} · {item.channel_name}</p><p className="mt-1 text-[11px] text-slate-400">{formatDate(item.created_at)}</p></div></div><div className="flex gap-2"><Button size="sm" onClick={() => onReview(item.id, "approve")} className="bg-[#2547F9] hover:bg-[#1d39cc]"><Check data-icon="inline-start" /> Approve</Button><Button size="sm" variant="outline" onClick={() => onReview(item.id, "reject")}><X data-icon="inline-start" /> Reject</Button></div></div>)}</CardContent></Card></div>; }

function ContactsView({ contacts }: { contacts: Contact[] }) { return <div className="flex flex-col gap-6"><PageIntro eyebrow="Unified identity" title="Contacts, not channels." text="One contact can hold Instagram, WhatsApp, and future Facebook identities." /><Card className="rounded-xl shadow-none"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Username</TableHead><TableHead>Identities</TableHead><TableHead>Added</TableHead></TableRow></TableHeader><TableBody>{contacts.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState icon={Users} title="No contacts yet" text="Incoming mock comments will create contact identities automatically." /></TableCell></TableRow> : contacts.map((contact) => <TableRow key={contact.id}><TableCell className="font-medium">{contact.name}</TableCell><TableCell className="text-slate-500">{contact.username ? `@${contact.username}` : "—"}</TableCell><TableCell>{contact.identities}</TableCell><TableCell className="text-slate-500">{formatDate(contact.created_at)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></div>; }

function ActivityView({ activities }: { activities: ActivityItem[] }) { return <div className="flex flex-col gap-6"><PageIntro eyebrow="Audit trail" title="Everything leaves a signal." text="Connection changes, automation runs, approvals, and failures are kept in one activity stream." /><Card className="rounded-xl shadow-none"><CardContent className="p-0">{activities.length === 0 ? <EmptyState icon={Activity} title="No activity yet" text="Your first connection or incoming comment will appear here." /> : activities.map((item) => <div key={item.id} className="flex items-start gap-3 border-b border-[#eef0f4] px-5 py-4 last:border-0"><span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-[#eef2ff] text-[#2547F9]"><Activity className="size-3.5" /></span><div><p className="text-sm font-medium">{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.type} · {formatDate(item.created_at)}</p></div></div>)}</CardContent></Card></div>; }

function InboxView() { return <div className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-[#dfe4ee] bg-white px-6 text-center"><MessageCircle className="mb-3 size-8 text-[#2547F9]" /><h2 className="text-lg font-semibold">Inbox foundation is ready</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">The same normalized contact and channel connection model powers the inbox. Add a conversation adapter when the next channel’s inbound contract is ready.</p></div>; }

function SettingsView({ workspaceId, onSave }: { workspaceId: string; onSave: (value: string) => void }) { const [value, setValue] = useState(workspaceId); const [paused, setPaused] = useState(false); const [saving, setSaving] = useState(false); useEffect(() => { const headers = workspaceId ? { "X-Workspace-ID": workspaceId } : undefined; void fetch(`${apiBase}/api/settings/automation`, { headers }).then((response) => response.json()).then((body) => setPaused(Boolean(body.pause_all_instagram_automations))).catch(() => undefined); }, [workspaceId]); async function toggle() { setSaving(true); try { const headers = new Headers({ "Content-Type": "application/json" }); if (workspaceId) headers.set("X-Workspace-ID", workspaceId); const response = await fetch(`${apiBase}/api/settings/automation`, { method: "POST", headers, body: JSON.stringify({ pause_all_instagram_automations: !paused }) }); if (!response.ok) throw new Error("Kill switch update failed"); setPaused(!paused); } finally { setSaving(false); } } return <div className="flex flex-col gap-6"><PageIntro eyebrow="Workspace controls" title="Settings" text="Keep the workspace boundary explicit when using the API directly." /><Card className="max-w-xl rounded-xl shadow-none"><CardHeader><CardTitle>Workspace ID</CardTitle><CardDescription>Optional in development. Without it, the API uses the first seeded tenant.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><Label htmlFor="workspace-id">Workspace UUID</Label><Input id="workspace-id" value={value} onChange={(event) => setValue(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" /><Button className="w-fit bg-[#2547F9] hover:bg-[#1d39cc]" onClick={() => onSave(value)}>Save workspace</Button></CardContent></Card><Card className="max-w-xl rounded-xl shadow-none"><CardHeader><CardTitle>Pause all Instagram automations</CardTitle><CardDescription>Global kill switch for Instagram outbound actions.</CardDescription></CardHeader><CardContent><button type="button" role="switch" aria-checked={paused} disabled={saving} onClick={() => void toggle()} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors", paused ? "border-amber-300 bg-amber-50" : "border-[#e7eaf1] bg-white hover:bg-slate-50")}><span><span className="block text-sm font-medium">{paused ? "Automation paused" : "Automation running"}</span><span className="mt-1 block text-xs text-slate-500">{paused ? "Resume only after the account has been reviewed." : "Healthy accounts can process eligible actions."}</span></span><span className={cn("relative h-6 w-11 rounded-full transition-colors", paused ? "bg-amber-500" : "bg-slate-200")}><span className={cn("absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform", paused ? "translate-x-6" : "translate-x-1")} /></span></button></CardContent></Card><div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> Instagram safety switch</div><p className="mt-2 leading-6">When an account is unhealthy, rate limited, challenge-gated, expired, or disabled, worker execution stops. Complete verification manually, then reconnect or resume from Channels.</p></div></div>; }

function ConnectDialog({ onClose, onConnect }: { onClose: () => void; onConnect: (payload: { name: string; username: string; driver: string; channel_type: string }) => void }) { const [channelType, setChannelType] = useState("instagram"); const [name, setName] = useState("Instagram development"); const [username, setUsername] = useState("demo_account"); const isFacebook = channelType === "facebook"; return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4"><div role="dialog" aria-modal="true" aria-labelledby="connect-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#2547F9]">Development driver</p><h2 id="connect-title" className="mt-1 text-xl font-semibold">Connect {isFacebook ? "Facebook" : "Instagram"}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog" className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="size-4" /></button></div><p className="mt-3 text-sm leading-6 text-slate-500">Use mock for local flow. The unofficial Facebook adapter is isolated and does not implement restriction bypass.</p><div className="mt-5 flex flex-col gap-4"><div className="flex flex-col gap-2"><Label htmlFor="channel-type">Channel</Label><select id="channel-type" value={channelType} onChange={(event) => { setChannelType(event.target.value); setName(event.target.value === "facebook" ? "Facebook development" : "Instagram development"); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></div><div className="flex flex-col gap-2"><Label htmlFor="account-name">Account name</Label><Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="username">Username / page</Label><Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} /></div><div className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">Driver: <strong>mock</strong> · Health: <strong>healthy</strong> · Rate limit: conservative per account</div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="bg-[#2547F9] hover:bg-[#1d39cc]" onClick={() => onConnect({ name, username, driver: "mock", channel_type: channelType })}>Connect account</Button></div></div></div>; }

function PageIntro({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) { return <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#2547F9]">{eyebrow}</p><h2 className="text-3xl font-semibold tracking-[-.04em] text-slate-950">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{text}</p></div>{action}</div>; }
function EmptyState({ icon: Icon, title, text, action, onClick }: { icon: typeof Activity; title: string; text: string; action?: string; onClick?: () => void }) { return <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center"><span className="grid size-11 place-items-center rounded-xl bg-[#eef2ff] text-[#2547F9]"><Icon className="size-5" /></span><p className="mt-2 text-sm font-medium">{title}</p><p className="max-w-sm text-xs leading-5 text-slate-500">{text}</p>{action && onClick && <Button variant="outline" size="sm" className="mt-3" onClick={onClick}>{action}</Button>}</div>; }
