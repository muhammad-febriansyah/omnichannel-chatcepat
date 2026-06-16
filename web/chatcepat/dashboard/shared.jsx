/* global React */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Lucide-style icons ---------- */
const I = ({ size = 20, stroke = "currentColor", fill = "none", sw = 1.75, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>{children}</svg>
);

const Icons = {
  MessageSquare: (p) => <I {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></I>,
  Users: (p) => <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></I>,
  Send: (p) => <I {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></I>,
  Zap: (p) => <I {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></I>,
  FileText: (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></I>,
  LayoutDashboard: (p) => <I {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></I>,
  BarChart3: (p) => <I {...p}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></I>,
  Plug: (p) => <I {...p}><path d="M12 22v-5"/><path d="M9 7V2"/><path d="M15 7V2"/><path d="M6 13V8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/></I>,
  UserPlus: (p) => <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></I>,
  Tag: (p) => <I {...p}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></I>,
  Settings: (p) => <I {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></I>,
  Search: (p) => <I {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></I>,
  Bell: (p) => <I {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></I>,
  HelpCircle: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></I>,
  ChevronDown: (p) => <I {...p}><polyline points="6 9 12 15 18 9"/></I>,
  ChevronRight: (p) => <I {...p}><polyline points="9 18 15 12 9 6"/></I>,
  ChevronLeft: (p) => <I {...p}><polyline points="15 18 9 12 15 6"/></I>,
  Plus: (p) => <I {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></I>,
  Filter: (p) => <I {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></I>,
  ArrowDown: (p) => <I {...p}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></I>,
  ArrowUp: (p) => <I {...p}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></I>,
  MoreH: (p) => <I {...p}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></I>,
  CheckCheck: (p) => <I {...p}><polyline points="18 7 9 18 4 13"/><polyline points="22 9 13 20 12.5 19.5"/></I>,
  Check: (p) => <I {...p}><polyline points="20 6 9 17 4 12"/></I>,
  Paperclip: (p) => <I {...p}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></I>,
  Smile: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></I>,
  Image: (p) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></I>,
  Mic: (p) => <I {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></I>,
  Calendar: (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>,
  Clock: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></I>,
  TrendUp: (p) => <I {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></I>,
  TrendDown: (p) => <I {...p}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></I>,
  CheckCircle: (p) => <I {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></I>,
  AlertCircle: (p) => <I {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></I>,
  LogOut: (p) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></I>,
  Menu: (p) => <I {...p}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></I>,
  X: (p) => <I {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></I>,
  Play: (p) => <I {...p}><polygon points="5 3 19 12 5 21 5 3"/></I>,
  Phone: (p) => <I {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></I>,
  UserCheck: (p) => <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></I>,
  Sparkles: (p) => <I {...p}><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/></I>,
  Inbox: (p) => <I {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></I>,
  Command: (p) => <I {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></I>,
};

/* ---------- Channel logos ---------- */
const Channels = {
  whatsapp: { color: "#25D366", name: "WhatsApp", el: (s=16) => (
    <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25D366"/>
      <path fill="#fff" d="M22.6 9.4A9 9 0 0 0 8.2 20.2l-1.2 4.5 4.6-1.2a9 9 0 0 0 4.3 1.1h0a9 9 0 0 0 6.7-15.2zm-2.6 8.1c-.2-.1-1.3-.7-1.5-.7s-.4-.1-.5.1c-.1.2-.6.7-.7.9s-.3.1-.5 0a6.1 6.1 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2 4.7 4.7 0 0 0 1 2.5 10.7 10.7 0 0 0 4.1 3.6c2.4 1 2.5.7 3 .7a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c-.1-.1-.2-.2-.4-.3z"/>
    </svg>
  )},
  instagram: { color: "#DD2A7B", name: "Instagram", el: (s=16) => (
    <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden="true">
      <defs><linearGradient id={`ig${s}`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FCB045"/><stop offset=".5" stopColor="#FD1D1D"/><stop offset="1" stopColor="#833AB4"/>
      </linearGradient></defs>
      <rect width="32" height="32" rx="8" fill={`url(#ig${s})`}/>
      <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="16" cy="16" r="3.6" fill="none" stroke="#fff" strokeWidth="1.8"/>
      <circle cx="20.6" cy="11.4" r="1" fill="#fff"/>
    </svg>
  )},
  messenger: { color: "#0084FF", name: "Messenger", el: (s=16) => (
    <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0084FF"/>
      <path fill="#fff" d="M16 7C10.5 7 6 11 6 16c0 2.7 1.4 5.1 3.6 6.8V26l3.3-1.8c.9.3 1.9.4 3 .4 5.5 0 10-4 10-9s-4.4-9-9.9-9zm1 12.1-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z"/>
    </svg>
  )},
  telegram: { color: "#0088CC", name: "Telegram", el: (s=16) => (
    <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0088CC"/>
      <path fill="#fff" d="m23.5 9.6-2.7 12.7c-.2.9-.7 1.1-1.5.7L15 19.6l-2 2c-.2.2-.4.4-.8.4l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L9.3 16.9l-3.9-1.2c-.8-.3-.9-.8.2-1.2L22.4 8.5c.7-.3 1.3.2 1.1 1.1z"/>
    </svg>
  )},
};

/* ---------- ChatCepat logo ---------- */
function CCLogo({ size = 32, variant = "dark", withWordmark = true }) {
  const moonColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  const accent = variant === "white" ? "#60A5FA" : "#3B82F6";
  const wordColor = variant === "white" ? "#FFFFFF" : "#1E2A78";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path d="M 36 24 A 12 12 0 1 1 24 12 A 9 9 0 1 0 36 24 Z" fill={moonColor}/>
        <circle cx="32" cy="14" r="5" fill={accent}/>
        <circle cx="30" cy="14" r="1" fill={moonColor}/>
        <circle cx="32" cy="14" r="1" fill={moonColor}/>
        <circle cx="34" cy="14" r="1" fill={moonColor}/>
      </svg>
      {withWordmark && (
        <span style={{
          fontFamily: "Poppins, sans-serif", fontWeight: 700,
          fontSize: size * 0.5, letterSpacing: "-0.02em", color: wordColor,
        }}>Chat<span style={{ color: accent }}>Cepat</span></span>
      )}
    </div>
  );
}

/* ---------- Avatar ---------- */
function Avatar({ name, size = 36, color, channel, online, ring }) {
  const initials = (name || "?").split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const palette = ["#3B82F6","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#06B6D4","#F97316","#64748B"];
  const bg = color || palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      <span className="avatar-initials" style={{
        background: bg, fontSize: size * 0.38,
        boxShadow: ring ? "0 0 0 2px #fff" : "none"
      }}>{initials}</span>
      {channel && (
        <span className="avatar-channel" style={{ width: size*0.42, height: size*0.42 }}>
          {Channels[channel].el(size*0.42)}
        </span>
      )}
      {online && <span className="avatar-online" style={{ width: size*0.28, height: size*0.28 }}/>}
    </span>
  );
}

/* ---------- Helpers ---------- */
function classNames(...xs) { return xs.filter(Boolean).join(" "); }

function cleanIDR(n) {
  return n.toLocaleString("id-ID");
}

/* ---------- Mini sparkline ---------- */
function Sparkline({ data, color = "#3B82F6", w = 100, h = 32 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  const id = `sg-${color.replace("#","")}-${data.join("")}`.replace(/\W/g,"");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28"/>
          <stop offset="1" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---------- Mascot (small) ---------- */
function MiniMascot({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="mm-body" cx="0.35" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#FFFFFF"/><stop offset="0.55" stopColor="#F4F8FF"/><stop offset="1" stopColor="#C7D6FF"/>
        </radialGradient>
      </defs>
      <path d="M 145 100 A 55 55 0 1 1 90 45 A 42 42 0 1 0 145 100 Z" fill="url(#mm-body)" stroke="#B8C8F0" strokeWidth="1"/>
      <ellipse cx="78" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65"/>
      <ellipse cx="120" cy="115" rx="7" ry="4.5" fill="#FFB4C5" opacity="0.65"/>
      <g fill="#1E2A78">
        <ellipse cx="86" cy="98" rx="3.2" ry="4.2"/><ellipse cx="112" cy="98" rx="3.2" ry="4.2"/>
        <circle cx="87.2" cy="96.5" r="1.1" fill="#fff"/><circle cx="113.2" cy="96.5" r="1.1" fill="#fff"/>
      </g>
      <path d="M 90 118 Q 99 126 108 118" fill="none" stroke="#1E2A78" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

Object.assign(window, { Icons, Channels, CCLogo, Avatar, Sparkline, MiniMascot, classNames, cleanIDR });
