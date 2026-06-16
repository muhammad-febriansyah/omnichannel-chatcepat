/* global React, Icons, Channels, Avatar, Sparkline, classNames, cleanIDR */
const { useState: useStateDash } = React;

const STATS = [
  { id: "msgs",  label: "Pesan Hari Ini",     num: 1234,    suffix: "",  trend: 12.5,  trendUp: true,  icon: Icons.MessageSquare, color: "#3B82F6", spark: [22,28,26,34,40,52,64] },
  { id: "active",label: "Percakapan Aktif",   num: 87,      suffix: "",  trend: 4.2,   trendUp: true,  icon: Icons.Inbox,         color: "#10B981", spark: [70,72,75,80,78,84,87] },
  { id: "resp",  label: "Waktu Respon Rata-rata", num: "2m 34s", suffix: "", trend: 8.1, trendUp: false, icon: Icons.Clock, color: "#F59E0B", spark: [180,165,170,160,155,150,154] },
  { id: "res",   label: "Tingkat Resolusi",   num: "94.2",  suffix: "%", trend: 1.8,   trendUp: true,  icon: Icons.CheckCircle,   color: "#8B5CF6", spark: [90,91,92,93,92,94,94.2] },
];

const CHANNEL_VOLUMES = [
  { ch: "whatsapp", value: 4280 },
  { ch: "instagram", value: 1860 },
  { ch: "messenger", value: 1240 },
  { ch: "telegram", value: 720 },
];

const TEAM = [
  { rank: 1, name: "Budi Santoso", color: "#3B82F6", convs: 47, response: "1m 12s", csat: 4.9 },
  { rank: 2, name: "Dewi Rahayu",  color: "#EC4899", convs: 41, response: "1m 38s", csat: 4.8 },
  { rank: 3, name: "Ari Rizki",    color: "#10B981", convs: 38, response: "2m 04s", csat: 4.7 },
  { rank: 4, name: "Sari Indah",   color: "#F59E0B", convs: 32, response: "2m 21s", csat: 4.6 },
  { rank: 5, name: "Maya Putri",   color: "#8B5CF6", convs: 28, response: "2m 45s", csat: 4.5 },
];

const ACTIVITY = [
  { id: 1, type: "resolved", text: "Budi menyelesaikan percakapan dengan Andi P.", time: "2m lalu" },
  { id: 2, type: "channel",  text: "Channel Instagram terhubung kembali", time: "18m lalu" },
  { id: 3, type: "broadcast",text: "Broadcast 'Promo Akhir Pekan' terkirim ke 234 kontak", time: "1j lalu" },
  { id: 4, type: "tag",      text: "Tag 'VIP' ditambahkan ke Dewi Lestari", time: "2j lalu" },
  { id: 5, type: "team",     text: "Sari Indah bergabung sebagai agent", time: "Kemarin" },
  { id: 6, type: "automation",text: "Otomasi 'Salam Pembuka' dijalankan 47x", time: "Kemarin" },
];

const ACT_ICONS = {
  resolved:   { icon: Icons.CheckCircle, bg: "#DCFCE7", fg: "#10B981" },
  channel:    { icon: Icons.Plug, bg: "#DBEAFE", fg: "#3B82F6" },
  broadcast:  { icon: Icons.Send, bg: "#EDE9FE", fg: "#8B5CF6" },
  tag:        { icon: Icons.Tag, bg: "#FEF3C7", fg: "#F59E0B" },
  team:       { icon: Icons.UserPlus, bg: "#FCE7F3", fg: "#EC4899" },
  automation: { icon: Icons.Zap, bg: "#CFFAFE", fg: "#06B6D4" },
};

function StatCard({ s }) {
  const Ico = s.icon;
  const Trend = s.trendUp ? Icons.TrendUp : Icons.TrendDown;
  const trendColor = s.trendUp ? "#10B981" : "#EF4444";
  return (
    <div className="stat-card">
      <div className="sc-top">
        <span className="sc-icon" style={{ background: s.color + "1F", color: s.color }}>
          <Ico size={20} stroke={s.color}/>
        </span>
        <Sparkline data={s.spark} color={s.color} w={80} h={28}/>
      </div>
      <div className="sc-label">{s.label}</div>
      <div className="sc-num">
        {typeof s.num === "number" ? cleanIDR(s.num) : s.num}<span className="sc-suffix">{s.suffix}</span>
      </div>
      <div className="sc-trend" style={{ color: trendColor }}>
        <Trend size={14} stroke={trendColor}/> <span>{s.trendUp ? "+" : ""}{s.trend}%</span>
        <span className="sc-trend-vs">dari kemarin</span>
      </div>
    </div>
  );
}

/* Bar chart: volume per channel */
function ChannelVolumeChart() {
  const data = CHANNEL_VOLUMES;
  const max = Math.max(...data.map(d => d.value));
  const yTicks = 5;
  const step = Math.ceil(max / yTicks / 500) * 500;
  const yMax = step * yTicks;

  return (
    <div className="chart-card chart-bar">
      <div className="cc-head">
        <div>
          <h3 className="cc-title">Volume Pesan per Channel</h3>
          <p className="cc-sub">7 hari terakhir</p>
        </div>
        <button className="filter-pill">7 Hari <Icons.ChevronDown size={14}/></button>
      </div>
      <div className="bar-wrap">
        <div className="bar-yaxis">
          {[...Array(yTicks + 1)].map((_, i) => (
            <span key={i}>{cleanIDR((yMax - i * step))}</span>
          ))}
        </div>
        <div className="bar-grid">
          {[...Array(yTicks + 1)].map((_, i) => <span key={i} className="bar-line"/>)}
          <div className="bars">
            {data.map((d) => {
              const ch = Channels[d.ch];
              const pct = (d.value / yMax) * 100;
              return (
                <div className="bar-col" key={d.ch}>
                  <div className="bar-tip">{cleanIDR(d.value)}</div>
                  <div className="bar" style={{
                    height: `${pct}%`,
                    background: `linear-gradient(180deg, ${ch.color}, ${ch.color}CC)`
                  }}/>
                  <div className="bar-label">
                    {ch.el(16)} <span>{ch.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Donut: distribution per channel */
function ChannelDonut() {
  const data = CHANNEL_VOLUMES;
  const total = data.reduce((a, b) => a + b.value, 0);
  const R = 70, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="chart-card">
      <div className="cc-head">
        <div>
          <h3 className="cc-title">Distribusi Channel</h3>
          <p className="cc-sub">Total {cleanIDR(total)} pesan</p>
        </div>
      </div>
      <div className="donut-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#F1F5F9" strokeWidth="22"/>
          {data.map((d) => {
            const len = (d.value / total) * C;
            const ch = Channels[d.ch];
            const dash = `${len} ${C - len}`;
            const el = (
              <circle key={d.ch}
                cx="100" cy="100" r={R}
                fill="none"
                stroke={ch.color}
                strokeWidth="22"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 100 100)"
              />
            );
            offset += len;
            return el;
          })}
          <text x="100" y="96" textAnchor="middle" fontSize="14" fill="#64748B" fontWeight="500">Total</text>
          <text x="100" y="118" textAnchor="middle" fontSize="22" fill="#1E2A78" fontWeight="700">{cleanIDR(total)}</text>
        </svg>
        <ul className="donut-legend">
          {data.map(d => (
            <li key={d.ch}>
              <span className="dl-ic">{Channels[d.ch].el(16)}</span>
              <span className="dl-name">{Channels[d.ch].name}</span>
              <span className="dl-num">{cleanIDR(d.value)}</span>
              <span className="dl-pct">{Math.round((d.value/total)*100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TopPerformers() {
  return (
    <div className="panel-card">
      <div className="cc-head">
        <div>
          <h3 className="cc-title">Top Performer Tim</h3>
          <p className="cc-sub">Berdasarkan resolusi minggu ini</p>
        </div>
        <button className="link-btn">Lihat Semua <Icons.ChevronRight size={14}/></button>
      </div>
      <div className="team-table" role="table">
        <div className="tt-head" role="row">
          <span>#</span>
          <span>Agent</span>
          <span>Percakapan</span>
          <span>Respon</span>
          <span>CSAT</span>
        </div>
        {TEAM.map(a => (
          <div className="tt-row" role="row" key={a.rank}>
            <span className={classNames("tt-rank", a.rank <= 3 && `r${a.rank}`)}>{a.rank}</span>
            <span className="tt-agent">
              <Avatar name={a.name} size={32} color={a.color}/>
              <span className="tt-name">{a.name}</span>
            </span>
            <span className="tt-num">{a.convs}</span>
            <span className="tt-num mono">{a.response}</span>
            <span className="tt-csat">
              <span className="tt-csat-num">{a.csat}</span>
              <span className="tt-csat-bar"><span style={{ width: `${(a.csat/5)*100}%` }}/></span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed() {
  return (
    <div className="panel-card">
      <div className="cc-head">
        <div>
          <h3 className="cc-title">Aktivitas Terbaru</h3>
          <p className="cc-sub">Live update</p>
        </div>
        <button className="link-btn">Lihat Semua <Icons.ChevronRight size={14}/></button>
      </div>
      <ul className="activity-feed">
        {ACTIVITY.map((a) => {
          const meta = ACT_ICONS[a.type];
          const Ico = meta.icon;
          return (
            <li key={a.id}>
              <span className="af-ic" style={{ background: meta.bg, color: meta.fg }}>
                <Ico size={14} stroke={meta.fg}/>
              </span>
              <div className="af-body">
                <p>{a.text}</p>
                <span className="af-time">{a.time}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DashboardView() {
  const [range, setRange] = useStateDash("7d");
  const ranges = [
    { id: "today", label: "Hari Ini" },
    { id: "7d",    label: "7 Hari Terakhir" },
    { id: "30d",   label: "30 Hari Terakhir" },
    { id: "ytd",   label: "Tahun Berjalan" },
  ];
  const [open, setOpen] = useStateDash(false);

  return (
    <div className="dashboard-shell">
      <div className="dash-page-head">
        <div>
          <h1 className="dash-greet">Selamat Pagi, Budi! <span className="wave">👋</span></h1>
          <p className="dash-date">Jumat, 8 Mei 2026</p>
        </div>
        <div className="dash-range" onMouseLeave={() => setOpen(false)}>
          <button className="range-btn" onClick={() => setOpen(o => !o)}>
            <Icons.Calendar size={16}/>
            <span>{ranges.find(r => r.id === range).label}</span>
            <Icons.ChevronDown size={16}/>
          </button>
          {open && (
            <div className="range-menu">
              {ranges.map(r => (
                <button key={r.id}
                  className={classNames("range-opt", r.id === range && "on")}
                  onClick={() => { setRange(r.id); setOpen(false); }}
                >{r.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stats-row">
        {STATS.map(s => <StatCard key={s.id} s={s}/>)}
      </div>

      <div className="charts-row">
        <ChannelVolumeChart/>
        <ChannelDonut/>
      </div>

      <div className="panels-row">
        <TopPerformers/>
        <ActivityFeed/>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardView });
