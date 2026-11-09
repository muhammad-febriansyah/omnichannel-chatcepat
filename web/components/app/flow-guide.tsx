import Link from "next/link";
import { AlertTriangle, ChevronDown, Lightbulb, MousePointerClick, Plug, Rocket, Variable } from "lucide-react";
import { NODE_META } from "@/components/app/flow-builder/meta";
import type { NodeKind } from "@/lib/flow-graph";

type NodeDoc = { kind: NodeKind; what: string; when: string; tips?: string };

const NODE_DOCS: NodeDoc[] = [
  {
    kind: "trigger",
    what: "Titik awal flow. Pilih jenisnya: Keyword (pesan mengandung kata tertentu), Komentar FB/IG, Broadcast terjadwal, Klik tombol, Awal percakapan (pesan pertama, atau kembali setelah sekian jam tidak aktif), atau Cadangan (pesan yang tidak cocok flow lain).",
    when: "Setiap flow wajib punya tepat satu Pemicu. Atur juga “Berlaku untuk akun” bila flow hanya untuk akun tertentu, mis. Instagram toko A.",
    tips: "Flow keyword dicek lebih dulu, lalu Awal percakapan, lalu Cadangan. Kalau tidak ada flow yang cocok, tab Pengaturan Balasan menentukan: pesan tetap atau diam. Supaya dijawab AI, buat flow Cadangan + AI Agent.",
  },
  {
    kind: "broadcast_message",
    what: "Pesan massal yang dikirim pemicu Broadcast terjadwal. WhatsApp biasa: teks (+ gambar). WhatsApp Official: template yang disetujui Meta, lengkap dengan variabel dan tombol.",
    when: "Hanya tepat setelah Pemicu Broadcast terjadwal.",
    tips: "Tiap tombol quick reply punya cabang sendiri; balasan teks lewat cabang “Balasan lain”. Isi balasan tersimpan di {{balasan}}.",
  },
  { kind: "send_text", what: "Mengirim pesan teks. Bisa memakai variabel seperti {{nama}}.", when: "Sapaan, jawaban tetap, konfirmasi, ringkasan pesanan." },
  { kind: "send_media", what: "Mengirim gambar/dokumen dari link publik, dengan caption.", when: "Brosur, pricelist PDF, foto produk." },
  { kind: "send_catalog", what: "Mengirim foto + harga produk aktif dari menu Produk (maks. 10).", when: "Saat pelanggan tanya harga atau katalog.", tips: "Isi kategori untuk mengirim sebagian katalog saja." },
  {
    kind: "reply_comment",
    what: "Membalas komentar secara PUBLIK di bawah komentar Facebook/Instagram. Isi 2–5 variasi; satu dipilih acak tiap komentar.",
    when: "Hanya di flow dengan Pemicu = Komentar FB/IG.",
    tips: "Jangan tulis harga khusus atau data pribadi di balasan publik — arahkan ke DM.",
  },
  {
    kind: "private_reply",
    what: "Mengirim satu DM ke orang yang berkomentar (private reply).",
    when: "Hanya di flow komentar. Meta mengizinkan 1 DM per komentar dalam 7 hari; teks lain di flow digabung ke DM ini.",
    tips: "Akhiri DM dengan pertanyaan agar pelanggan membalas — setelah dibalas, lanjutkan dengan Tunggu Balasan / Menu / AI seperti chat biasa.",
  },
  {
    kind: "menu",
    what: "Menampilkan pilihan bernomor dan membuat cabang per pilihan. Di WhatsApp Official tampil sebagai tombol/list asli.",
    when: "Menu utama, pilihan layanan, survei singkat.",
    tips: "Setiap pilihan harus disambungkan. Jawaban yang tidak dikenali keluar lewat “Tidak dikenali”.",
  },
  { kind: "wait_reply", what: "Menjeda flow sampai pelanggan membalas, lalu menyimpan jawabannya ke variabel.", when: "Form order, booking, minta nomor pesanan.", tips: "Pakai variabelnya di langkah berikutnya, mis. {{alamat}}." },
  { kind: "condition", what: "Membuat cabang berdasarkan isi variabel (sama dengan, mengandung, kosong, dll).", when: "Mengarahkan pelanggan sesuai jawaban, mis. kota = Jakarta → ongkir A." },
  { kind: "set_var", what: "Mengisi variabel dengan nilai tetap.", when: "Menandai sumber/kampanye, mis. sumber = promo_desember." },
  { kind: "add_tag", what: "Memberi tag ke kontak.", when: "Segmentasi untuk broadcast berikutnya, mis. order-baru, tertarik-promo." },
  {
    kind: "ai_agent",
    what: "AI menjawab dari dokumen pengetahuan, katalog, dan promo aktif. Semua diatur langsung di node: peran, gaya balasan, instruksi, contoh jawaban, serta tambah/hapus dokumen dan promo.",
    when: "FAQ, rekomendasi produk, menjawab di luar jam kerja.",
    tips: "Dokumen & promo dipakai bersama semua node AI — cukup tambah sekali. Punya 2 jalur keluar: “Terjawab” dan “Perlu CS”. Sambungkan Perlu CS ke langkah lain (mis. minta data lalu Alihkan) atau biarkan kosong agar langsung dialihkan. Uji dulu di tab “Uji AI”.",
  },
  { kind: "handoff", what: "Menyerahkan percakapan ke CS manusia di Inbox. Bot berhenti membalas percakapan itu.", when: "Komplain, negosiasi, order yang perlu konfirmasi manual." },
];

const STEPS = [
  { icon: Rocket, title: "Buat flow", text: "Klik Flow Baru atau pakai Template." },
  { icon: MousePointerClick, title: "Susun langkah", text: "Seret langkah ke kanvas, tarik titik bulat untuk menyambungkan." },
  { icon: Variable, title: "Isi pengaturan", text: "Klik langkah untuk mengisi teks, keyword, dan akun." },
  { icon: Plug, title: "Simpan & aktifkan", text: "Klik Simpan → pilih Aktifkan. Flow langsung membalas." },
];

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-[20px] bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

function Tip({ children, tone = "tip" }: { children: React.ReactNode; tone?: "tip" | "warn" }) {
  const Icon = tone === "warn" ? AlertTriangle : Lightbulb;
  return (
    <div
      className={
        tone === "warn"
          ? "flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          : "flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function FlowGuide() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-[20px] bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-brand-blue text-xs font-bold text-white">{i + 1}</span>
              <s.icon className="size-4 text-brand-blue" />
            </div>
            <p className="font-semibold">{s.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      <Section title="Fungsi setiap langkah (node)" defaultOpen>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {NODE_DOCS.map((d) => {
            const m = NODE_META[d.kind];
            const Icon = m.icon;
            return (
              <div key={d.kind} className="rounded-xl border border-border p-3.5">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-sm" style={{ background: m.color }}>
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{m.label}</p>
                    <p className="text-[11px] uppercase tracking-wide">{m.group}</p>
                  </div>
                </div>
                <p className="text-foreground/90">{d.what}</p>
                <p className="mt-1.5">
                  <b className="text-foreground">Kapan dipakai:</b> {d.when}
                </p>
                {d.tips && (
                  <p className="mt-1.5">
                    <b className="text-foreground">Tips:</b> {d.tips}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Broadcast WhatsApp terjadwal">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Buat flow dengan Pemicu <b>Broadcast terjadwal</b>, atau pakai template di{" "}
            <Link href="/flows?tab=template&kat=broadcast" className="font-medium text-brand-blue hover:underline">
              Template → Broadcast
            </Link>
            .
          </li>
          <li>Di Pemicu, pilih akun WhatsApp pengirim, penerima (semua kontak opt-in atau tag tertentu), dan waktu kirim.</li>
          <li>
            Isi <b>Pesan Broadcast</b>. Untuk WhatsApp Official pilih template yang sudah disetujui; tombolnya otomatis jadi cabang di kanvas.
          </li>
          <li>Sambungkan langkah berikutnya: Kondisi, Kirim Teks, Beri Tag, AI Agent, atau Alihkan ke Agen — dijalankan saat kontak membalas.</li>
          <li>
            Simpan → <b>Kirim/Jadwalkan</b>. Progres, jumlah terkirim, dan klik tombol ada di tab{" "}
            <Link href="/flows?tab=broadcast" className="font-medium text-brand-blue hover:underline">
              Riwayat Broadcast
            </Link>
            .
          </li>
        </ol>
        <Tip tone="warn">
          Hanya kontak <b>opt-in</b> yang dikirimi; balasan STOP otomatis membuat kontak opt-out. Satu flow = satu kali kirim: menyimpan ulang setelah terkirim
          tidak mengirim lagi. Simpan sebagai draft sebelum waktunya untuk membatalkan jadwal.
        </Tip>
      </Section>

      <Section title="Auto-reply komentar & DM Facebook/Instagram">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Hubungkan Facebook Page / Instagram Professional di menu <Link href="/channels" className="font-medium text-brand-blue hover:underline">Channel</Link> (Login dengan Facebook). Akun yang terhubung
            sebelum fitur komentar ada perlu <b>dihubungkan ulang</b> agar izin balas komentar ikut diberikan.
          </li>
          <li>
            Buat flow dengan Pemicu <b>Komentar FB/IG</b>, atau pakai template <b>Komentar → DM Otomatis</b>.
          </li>
          <li>
            Pilih akun di “Akun Facebook/Instagram” (kosong = semua akun). Isi kata kunci bila hanya komentar tertentu yang dibalas, dan ID postingan bila
            hanya untuk postingan/Reels tertentu.
          </li>
          <li>
            Tambahkan <b>Balas Komentar</b> (publik) dan/atau <b>Kirim DM</b> (pribadi). Untuk lanjut ngobrol, tambahkan Tunggu Balasan / Menu / AI Agent setelah
            Kirim DM.
          </li>
          <li>Simpan → Aktifkan. Komentar baru akan dibalas otomatis dan muncul di Inbox dengan label 💬 Komentar.</li>
        </ol>
        <p>
          Untuk DM biasa (bukan komentar), pakai Pemicu Keyword / Awal percakapan / Cadangan dan atur “Berlaku untuk akun” agar flow hanya membalas akun tertentu.
        </p>
        <Tip tone="warn">
          Aturan Meta: 1 DM per komentar (maks. 7 hari setelah komentar). Balasan biasa di DM hanya boleh dalam 24 jam sejak pesan terakhir pelanggan. Hindari
          membalas semua komentar dengan teks yang sama persis — isi beberapa variasi.
        </Tip>
        <Tip>
          Flow dengan kata kunci didahulukan dari flow “semua komentar”. Jadi Anda bisa punya flow “harga → DM katalog” sekaligus flow “semua komentar → terima
          kasih”.
        </Tip>
      </Section>

      <Section title="Variabel yang bisa dipakai">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["{{nama}}", "Nama pelanggan (bila diketahui)"],
            ["{{pesan}}", "Pesan terakhir pelanggan"],
            ["{{komentar}}", "Isi komentar (flow komentar)"],
            ["{{post_id}}", "ID postingan yang dikomentari"],
            ["{{nama_variabel}}", "Jawaban yang disimpan Tunggu Balasan / Menu / Set Variabel"],
          ].map(([v, d]) => (
            <li key={v} className="flex items-baseline gap-2 rounded-lg border border-border px-3 py-2">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{v}</code>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Urutan balasan otomatis">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Percakapan sedang dipegang CS → bot diam.</li>
          <li>Pelanggan sedang di tengah flow (Tunggu Balasan/Menu) → flow dilanjutkan.</li>
          <li>Klik tombol broadcast → flow Pemicu “Klik tombol”.</li>
          <li>Keyword cocok → flow Keyword. Pesan pertama (atau kembali setelah lama diam) → flow Awal percakapan.</li>
          <li>Tidak ada yang cocok → flow Cadangan (mis. template CS AI 24 Jam). Tanpa flow Cadangan → pesan default “pesan Anda kami terima”.</li>
        </ol>
        <p>Komentar FB/IG hanya dibalas flow Komentar — flow Cadangan/AI tidak pernah membalas komentar secara publik.</p>
      </Section>

      <Section title="Tips agar flow rapi & aman">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Klik <b>Rapikan</b> di kanvas untuk menata otomatis, <b>Pas layar</b> untuk melihat semua langkah.</li>
          <li>Langkah bertanda merah belum lengkap — klik untuk melihat masalahnya. Flow tidak bisa disimpan sebelum beres.</li>
          <li>Popup Simpan menampilkan flow aktif lain yang keyword-nya bentrok.</li>
          <li>Simpan sebagai Draft dulu, uji AI di tab “Uji AI”, baru aktifkan.</li>
          <li>Selalu sediakan jalan ke CS (Alihkan ke Agen) untuk komplain dan pertanyaan rumit.</li>
        </ul>
      </Section>
    </div>
  );
}
