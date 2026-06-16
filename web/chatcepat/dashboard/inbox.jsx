/* global React, Icons, Channels, Avatar, classNames */
const { useState: useStateInbox, useRef: useRefInbox, useEffect: useEffectInbox } = React;

/* Sample data */
const CONVERSATIONS = [
  { id: "c1", name: "Andi Pratama", handle: "+62 812-3456-7890", channel: "whatsapp", preview: "Halo kak, mau tanya stok beras yang 5kg masih ada?", time: "2m", unread: 3, online: true, color: "#3B82F6", agent: "BS", tags: ["VIP","Pelanggan Tetap"] },
  { id: "c2", name: "Siti Nurhaliza", handle: "@siti_nh", channel: "instagram", preview: "Terima kasih atas info pengirimannya 🙏", time: "8m", unread: 0, color: "#EC4899", agent: "DR" },
  { id: "c3", name: "Dewi Lestari", handle: "+62 856-1234-5678", channel: "whatsapp", preview: "Boleh minta katalog produk terbaru?", time: "23m", unread: 1, color: "#10B981", agent: "BS", tags: ["Baru"] },
  { id: "c4", name: "Rizki Maulana", handle: "rizki.m@fb", channel: "messenger", preview: "Dikirim oleh Anda: Baik, akan kami proses sekarang", time: "1j", unread: 0, color: "#F59E0B", agent: "AR" },
  { id: "c5", name: "Putri Wulandari", handle: "@putriwulan", channel: "instagram", preview: "Maaf, apakah bisa COD untuk daerah Bekasi?", time: "2j", unread: 0, color: "#8B5CF6", agent: "DR" },
  { id: "c6", name: "Bagas Setiawan", handle: "+62 877-9988-1122", channel: "telegram", preview: "Saya transfer dari BCA ya kak", time: "3j", unread: 2, color: "#06B6D4", agent: "BS", tags: ["Pembayaran"] },
  { id: "c7", name: "Maya Anggraini", handle: "+62 813-5544-3322", channel: "whatsapp", preview: "Oke kak, ditunggu paketnya 😊", time: "5j", unread: 0, color: "#EF4444", agent: "AR" },
  { id: "c8", name: "Hendra Kusuma", handle: "hendra.k@fb", channel: "messenger", preview: "Apakah masih bisa retur jika produk tidak sesuai?", time: "Kemarin", unread: 0, color: "#F97316", agent: "BS" },
];

const MESSAGES = [
  { id: "m1", side: "in", text: "Halo kak, selamat siang 👋", time: "13:24", group: "start" },
  { id: "m2", side: "in", text: "Mau tanya, apakah beras yang ukuran 5kg masih ada stoknya?", time: "13:24", group: "end" },
  { id: "system1", system: true, text: "Percakapan ditugaskan ke Budi Santoso" },
  { id: "m3", side: "out", text: "Halo kak Andi, selamat siang juga 🙏", time: "13:25", status: "read", agent: "Budi", group: "start" },
  { id: "m4", side: "out", text: "Untuk beras 5kg masih tersedia kak. Saat ini ada 3 varian: Premium, Setra Ramos, dan Pandan Wangi", time: "13:25", status: "read", group: "end" },
  { id: "m5", side: "in", text: "Wah lengkap ya. Boleh dikirim katalognya?", time: "13:27", group: "single" },
  { id: "m6", side: "out", text: "Tentu kak, ini katalog produk kami:", time: "13:28", status: "read", agent: "Budi", group: "start" },
  { id: "m7", side: "out", type: "doc", filename: "Katalog-Beras-Mei-2026.pdf", size: "2.4 MB", time: "13:28", status: "read", group: "end" },
  { id: "m8", side: "in", text: "Terima kasih kak. Yang Pandan Wangi 5kg harganya berapa ya?", time: "13:30", group: "single" },
  { id: "m9", side: "out", text: "Pandan Wangi 5kg harganya Rp 78.000 kak. Untuk pembelian 5pcs ke atas dapat diskon 5% 😊", time: "13:31", status: "delivered", agent: "Budi", group: "single" },
];

function ConvList({ activeId, onPick }) {
  const [tab, setTab] = useStateInbox("all");
  const tabs = [
    { id: "all", label: "Semua", count: 127 },
    { id: "unread", label: "Belum Dibaca", count: 12 },
    { id: "mine", label: "Saya", count: 18 },
    { id: "done", label: "Selesai" },
  ];

  return (
    <div className="conv-list">
      {/* sticky header */}
      <div className="cl-head">
        <div className="cl-title-row">
          <div className="cl-title">Inbox <span className="cl-total">(127)</span></div>
          <button className="icon-btn primary-soft" aria-label="Percakapan baru"><Icons.Plus size={18}/></button>
        </div>
        <div className="cl-tabs" role="tablist">
          {tabs.map(t => (
            <button key={t.id}
              role="tab" aria-selected={tab === t.id}
              className={classNames("cl-tab", tab === t.id && "on")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count != null && <span className="cl-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="cl-filters">
          <button className="filter-pill">
            <Icons.Filter size={14}/> <span>Channel</span> <Icons.ChevronDown size={14}/>
          </button>
          <button className="filter-pill">
            <span>Status</span> <Icons.ChevronDown size={14}/>
          </button>
          <button className="filter-pill ml-auto">
            <Icons.ArrowDown size={14}/> <span>Terbaru</span>
          </button>
        </div>
        <div className="cl-search">
          <Icons.Search size={14}/>
          <input placeholder="Cari percakapan..." aria-label="Cari percakapan"/>
        </div>
      </div>

      {/* list */}
      <div className="cl-items" role="list">
        {CONVERSATIONS.map((c) => {
          const isActive = c.id === activeId;
          const unread = c.unread > 0;
          return (
            <button key={c.id}
              role="listitem"
              className={classNames("conv-item", isActive && "active", unread && "unread")}
              onClick={() => onPick(c.id)}
            >
              <Avatar name={c.name} size={44} color={c.color} channel={c.channel} online={c.online} ring/>
              <div className="ci-mid">
                <div className="ci-row1">
                  <span className="ci-name">{c.name}</span>
                  <span className="ci-time">{c.time}</span>
                </div>
                <div className="ci-row2">
                  <span className="ci-preview">{c.preview}</span>
                  {unread ? <span className="ci-unread">{c.unread}</span> : null}
                </div>
                <div className="ci-row3">
                  <span className="ci-agent" title={`Agent: ${c.agent}`}>{c.agent}</span>
                  {c.tags && c.tags.map((t, i) => (
                    <span key={t} className={classNames("ci-tag", `tag-${i % 3}`)}>{t}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatPanel({ conv }) {
  const [draft, setDraft] = useStateInbox("");
  const [typing, setTyping] = useStateInbox(false);
  const taRef = useRefInbox(null);

  useEffectInbox(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 140) + "px";
  }, [draft]);

  if (!conv) return <div className="chat-empty">Pilih percakapan untuk memulai</div>;
  const ch = Channels[conv.channel];

  return (
    <section className="chat-panel">
      {/* header */}
      <header className="chat-head">
        <div className="ch-left">
          <Avatar name={conv.name} size={40} color={conv.color} online={conv.online}/>
          <div className="ch-meta">
            <div className="ch-name-row">
              <span className="ch-name">{conv.name}</span>
              <span className="channel-pill" style={{ borderColor: ch.color, color: ch.color }}>
                {ch.el(14)} <span>{ch.name} Business</span>
              </span>
            </div>
            <div className="ch-handle">
              <span className="online-dot"/> Online · {conv.handle}
            </div>
          </div>
        </div>
        <div className="ch-actions">
          <button className="icon-btn" aria-label="Cari di percakapan"><Icons.Search size={18}/></button>
          <button className="icon-btn" aria-label="Tugaskan"><Icons.UserCheck size={18}/></button>
          <button className="icon-btn" aria-label="Tambah tag"><Icons.Tag size={18}/></button>
          <button className="btn-resolve"><Icons.Check size={16}/> Selesaikan</button>
          <button className="icon-btn" aria-label="Lainnya"><Icons.MoreH size={18}/></button>
        </div>
      </header>

      {/* messages */}
      <div className="msg-area">
        <div className="date-sep"><span>Hari Ini</span></div>

        {MESSAGES.map((m) => {
          if (m.system) {
            return <div key={m.id} className="sys-msg">{m.text}</div>;
          }
          if (m.type === "doc") {
            return (
              <div key={m.id} className={classNames("msg-row", m.side, `g-${m.group||"single"}`)}>
                <div className="msg-bubble doc-card">
                  <div className="doc-icon"><Icons.FileText size={20} stroke="#fff"/></div>
                  <div className="doc-meta">
                    <div className="doc-name">{m.filename}</div>
                    <div className="doc-size">{m.size} · PDF</div>
                  </div>
                  <button className="doc-dl" aria-label="Unduh"><Icons.ArrowDown size={16}/></button>
                </div>
                <div className="msg-time">{m.time} {m.status && <span className="msg-status"><Icons.CheckCheck size={12}/></span>}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className={classNames("msg-row", m.side, `g-${m.group||"single"}`)}>
              {m.side === "out" && m.agent && (m.group === "start" || m.group === "single") && (
                <div className="msg-from">Dikirim oleh {m.agent}</div>
              )}
              <div className="msg-bubble">{m.text}</div>
              <div className="msg-time">
                {m.time}
                {m.side === "out" && m.status === "delivered" && <Icons.CheckCheck size={12} stroke="#94A3B8"/>}
                {m.side === "out" && m.status === "read" && <Icons.CheckCheck size={12} stroke="#3B82F6"/>}
                {m.side === "out" && m.status === "sent" && <Icons.Check size={12} stroke="#94A3B8"/>}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="msg-row in g-single">
            <div className="msg-bubble typing"><span/><span/><span/></div>
          </div>
        )}

        {/* quick replies */}
        <div className="quick-replies">
          <button onClick={() => setDraft("Stok masih tersedia kak. Mau pesan berapa?")}>Stok masih tersedia</button>
          <button onClick={() => setDraft("Untuk pengiriman, kami pakai JNE atau J&T ya kak.")}>Info pengiriman</button>
          <button onClick={() => setDraft("Boleh saya kirimkan rekening pembayaran?")}>Detail pembayaran</button>
        </div>
      </div>

      {/* composer */}
      <div className="composer">
        <div className="comp-toolbar">
          <button className="comp-tool"><Icons.Zap size={14}/> Template</button>
          <button className="comp-tool"><Icons.Sparkles size={14}/> Quick Reply</button>
          <span className="comp-channel">
            Membalas via {ch.el(14)} <strong>{ch.name} Business</strong>
          </span>
        </div>
        <div className="comp-input-wrap">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setTyping(false)}
            placeholder="Ketik pesan..."
            rows={1}
          />
        </div>
        <div className="comp-actions">
          <div className="comp-left">
            <button className="comp-ic" aria-label="Emoji"><Icons.Smile size={18}/></button>
            <button className="comp-ic" aria-label="Lampirkan file"><Icons.Paperclip size={18}/></button>
            <button className="comp-ic" aria-label="Kirim gambar"><Icons.Image size={18}/></button>
            <button className="comp-ic" aria-label="Pesan suara"><Icons.Mic size={18}/></button>
          </div>
          <div className="comp-right">
            <span className="char-count">{draft.length} / 1024</span>
            <button className="comp-schedule" aria-label="Jadwalkan"><Icons.Clock size={16}/></button>
            <button
              className="btn-send"
              disabled={!draft.trim()}
              onClick={() => { setDraft(""); }}
              aria-label="Kirim"
            >
              <Icons.Send size={16}/>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function InboxView() {
  const [activeId, setActive] = useStateInbox("c1");
  const conv = CONVERSATIONS.find(c => c.id === activeId);
  return (
    <div className="inbox-shell">
      <ConvList activeId={activeId} onPick={setActive}/>
      <ChatPanel conv={conv}/>
    </div>
  );
}

Object.assign(window, { InboxView });
