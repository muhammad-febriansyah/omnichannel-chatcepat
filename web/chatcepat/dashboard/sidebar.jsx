/* global React, Icons, CCLogo, classNames */
const { useState: useStateSb } = React;

function Sidebar({ collapsed, active, onNavigate }) {
  const sections = [
    { label: "MENU UTAMA", items: [
      { id: "inbox", icon: Icons.MessageSquare, label: "Inbox", badge: 12 },
      { id: "kontak", icon: Icons.Users, label: "Kontak" },
      { id: "broadcast", icon: Icons.Send, label: "Broadcast" },
      { id: "otomasi", icon: Icons.Zap, label: "Otomasi" },
      { id: "template", icon: Icons.FileText, label: "Template" },
    ]},
    { label: "ANALITIK", items: [
      { id: "dashboard", icon: Icons.LayoutDashboard, label: "Dashboard" },
      { id: "laporan", icon: Icons.BarChart3, label: "Laporan" },
    ]},
    { label: "PENGATURAN", items: [
      { id: "channel", icon: Icons.Plug, label: "Channel", dot: "ok" },
      { id: "tim", icon: Icons.UserPlus, label: "Tim" },
      { id: "tag", icon: Icons.Tag, label: "Tag & Label" },
      { id: "settings", icon: Icons.Settings, label: "Pengaturan" },
    ]},
  ];

  return (
    <aside className={classNames("sidebar", collapsed && "collapsed")} aria-label="Navigasi utama">
      {/* Workspace */}
      <div className="sb-workspace">
        <div className="sb-ws-logo">
          <span className="ws-mono">TS</span>
        </div>
        {!collapsed && (
          <div className="sb-ws-meta">
            <div className="sb-ws-row">
              <span className="sb-ws-name">Toko Sembako Maju</span>
              <span className="plan-badge">Pro</span>
            </div>
            <div className="sb-ws-stat">3/5 channel terhubung</div>
          </div>
        )}
      </div>

      <nav className="sb-nav">
        {sections.map((sec) => (
          <div className="sb-section" key={sec.label}>
            {!collapsed && <div className="sb-section-label">{sec.label}</div>}
            <ul>
              {sec.items.map((it) => {
                const Ico = it.icon;
                const isActive = active === it.id;
                return (
                  <li key={it.id}>
                    <button
                      className={classNames("sb-item", isActive && "active")}
                      onClick={() => onNavigate?.(it.id)}
                      title={collapsed ? it.label : undefined}
                    >
                      <span className="sb-ic"><Ico size={20}/></span>
                      {!collapsed && <span className="sb-label">{it.label}</span>}
                      {!collapsed && it.badge != null && (
                        <span className="sb-badge">{it.badge}</span>
                      )}
                      {it.dot && <span className={classNames("sb-dot", `dot-${it.dot}`)}/>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sb-foot">
        {!collapsed && (
          <div className="usage-card">
            <div className="usage-top">
              <span className="usage-label">Pesan terkirim</span>
              <span className="usage-num">1.234 / 5.000</span>
            </div>
            <div className="usage-bar"><div className="usage-fill" style={{ width: "24.7%" }}/></div>
            <button className="btn-outline-blue small">Upgrade Paket</button>
          </div>
        )}
        <div className="sb-foot-actions">
          <button className="sb-mini" title="Bantuan"><Icons.HelpCircle size={18}/></button>
          <button className="sb-mini" title="Logout"><Icons.LogOut size={18}/></button>
        </div>
      </div>
    </aside>
  );
}

function TopHeader({ onToggleSidebar, view, onView }) {
  const [q, setQ] = useStateSb("");
  return (
    <header className="topbar">
      <div className="tb-left">
        <button
          className="icon-btn"
          onClick={onToggleSidebar}
          aria-label="Tampilkan / sembunyikan menu samping"
          title="Tampilkan / sembunyikan menu"
        >
          <Icons.Menu size={22}/>
        </button>
        <CCLogo size={32}/>
        <div className="tb-tabs">
          <button
            className={classNames("tb-tab", view === "dashboard" && "on")}
            onClick={() => onView("dashboard")}
          >Dashboard</button>
          <button
            className={classNames("tb-tab", view === "inbox" && "on")}
            onClick={() => onView("inbox")}
          >Inbox</button>
        </div>
      </div>

      <div className="tb-search">
        <Icons.Search size={16}/>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kontak, percakapan, atau pesan..."
          aria-label="Pencarian global"
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="tb-right">
        <button className="icon-btn dot" aria-label="Notifikasi">
          <Icons.Bell size={20}/>
          <span className="bell-dot"/>
        </button>
        <button className="icon-btn" aria-label="Bantuan"><Icons.HelpCircle size={20}/></button>
        <button className="icon-btn" aria-label="Pengaturan"><Icons.Settings size={20}/></button>

        <button className="tenant-switcher">
          <span className="tenant-mark">TS</span>
          <span className="tenant-meta">
            <span className="tenant-name">Toko Sembako</span>
            <span className="tenant-role">Owner</span>
          </span>
          <Icons.ChevronDown size={16}/>
        </button>

        <span className="user-avatar">
          <span className="ua-init">BS</span>
          <span className="ua-online"/>
        </span>
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, TopHeader });
