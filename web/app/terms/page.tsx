import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Aturan penggunaan layanan ChatCepat: akun, channel, broadcast, AI, pembayaran, dan tanggung jawab.",
};

const SECTIONS = [
  { id: "layanan", title: "Layanan" },
  { id: "akun", title: "Akun & workspace" },
  { id: "channel", title: "Channel pihak ketiga" },
  { id: "penggunaan", title: "Penggunaan yang dilarang" },
  { id: "broadcast", title: "Broadcast & persetujuan kontak" },
  { id: "ai", title: "Fitur AI" },
  { id: "pembayaran", title: "Paket & pembayaran" },
  { id: "data", title: "Data & privasi" },
  { id: "tanggung-jawab", title: "Batasan tanggung jawab" },
  { id: "penghentian", title: "Penghentian layanan" },
  { id: "hukum", title: "Hukum yang berlaku" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      updated="9 November 2026"
      sections={SECTIONS}
      intro={
        <p>
          Dengan mendaftar atau menggunakan ChatCepat, Anda menyetujui syarat berikut. Jika Anda mendaftar atas nama bisnis, Anda
          menyatakan berwenang mewakili bisnis tersebut.
        </p>
      }
    >
      <Section id="layanan" n={1} title="Layanan">
        <p>
          ChatCepat menyediakan inbox omnichannel untuk WhatsApp, Instagram, Facebook Messenger, dan Telegram, beserta balasan
          otomatis, AI agent, broadcast, katalog produk, dan laporan. Fitur yang tersedia bergantung pada paket yang Anda pilih.
        </p>
      </Section>

      <Section id="akun" n={2} title="Akun & workspace">
        <Bullets
          items={[
            <>Anda wajib memberikan data pendaftaran yang benar dan menjaga kerahasiaan password.</>,
            <>Anda bertanggung jawab atas semua aktivitas di workspace Anda, termasuk yang dilakukan anggota tim.</>,
            <>Beri tahu kami segera jika Anda menduga akun Anda disalahgunakan.</>,
          ]}
        />
      </Section>

      <Section id="channel" n={3} title="Channel pihak ketiga">
        <p>
          Channel yang Anda hubungkan tunduk pada aturan pemiliknya, antara lain WhatsApp Business Policy, Meta Platform Terms,
          Instagram &amp; Facebook Community Standards, dan Telegram Terms of Service. Anda wajib mematuhi aturan tersebut.
        </p>
        <p>
          Fitur WhatsApp tidak resmi (koneksi lewat scan QR) tidak didukung oleh WhatsApp. Nomor yang dipakai dapat dibatasi atau
          diblokir oleh WhatsApp, dan risiko tersebut sepenuhnya ditanggung pemilik nomor. Untuk pemakaian bisnis berskala besar,
          gunakan WhatsApp Official (Cloud API).
        </p>
      </Section>

      <Section id="penggunaan" n={4} title="Penggunaan yang dilarang">
        <Bullets
          items={[
            <>Mengirim spam atau pesan massal ke orang yang tidak memberikan persetujuan.</>,
            <>Mengumpulkan nomor atau data kontak pihak lain tanpa izin (scraping).</>,
            <>Menyebarkan konten penipuan, ilegal, SARA, kekerasan, atau yang melanggar hak orang lain.</>,
            <>Mencoba mengakses data workspace lain, mengganggu sistem, atau merekayasa balik layanan.</>,
          ]}
        />
        <p>Pelanggaran dapat mengakibatkan penangguhan atau penghentian akun tanpa pengembalian dana.</p>
      </Section>

      <Section id="broadcast" n={5} title="Broadcast & persetujuan kontak">
        <p>
          Broadcast hanya boleh dikirim ke kontak yang telah memberikan persetujuan (opt-in). Sistem kami menolak pengiriman ke kontak
          yang belum opt-in atau yang telah berhenti berlangganan. Anda bertanggung jawab memastikan persetujuan tersebut diperoleh
          secara sah.
        </p>
      </Section>

      <Section id="ai" n={6} title="Fitur AI">
        <p>
          Jawaban AI dibuat otomatis berdasarkan dokumen dan pengaturan yang Anda berikan, dan dapat keliru. Anda bertanggung jawab
          memeriksa informasi penting (harga, stok, janji pengiriman) dan menyediakan agen manusia untuk hal yang memerlukan
          keputusan.
        </p>
      </Section>

      <Section id="pembayaran" n={7} title="Paket & pembayaran">
        <Bullets
          items={[
            <>Harga paket ditampilkan di halaman harga dan dapat berubah dengan pemberitahuan sebelumnya.</>,
            <>Pembayaran diproses melalui penyedia pembayaran pihak ketiga. Paket aktif setelah pembayaran terkonfirmasi.</>,
            <>Kuota (misalnya token AI) berlaku sesuai periode paket dan tidak dapat diuangkan.</>,
            <>Kecuali diwajibkan hukum, pembayaran yang sudah diproses tidak dapat dikembalikan.</>,
          ]}
        />
      </Section>

      <Section id="data" n={8} title="Data & privasi">
        <p>
          Data percakapan dan kontak milik workspace Anda. Kami memprosesnya hanya untuk menjalankan layanan, sebagaimana dijelaskan
          di{" "}
          <Link href="/privacy" className="font-medium text-brand-blue hover:underline">
            Kebijakan Privasi
          </Link>
          . Anda bertanggung jawab atas dasar hukum pemrosesan data pelanggan Anda.
        </p>
      </Section>

      <Section id="tanggung-jawab" n={9} title="Batasan tanggung jawab">
        <p>
          Layanan disediakan &ldquo;sebagaimana adanya&rdquo;. Kami berupaya menjaga layanan tetap tersedia, tetapi tidak menjamin
          bebas gangguan, terutama gangguan yang berasal dari penyedia channel pihak ketiga. Sejauh diizinkan hukum, tanggung jawab
          kami terbatas pada jumlah yang Anda bayarkan dalam 3 bulan terakhir.
        </p>
      </Section>

      <Section id="penghentian" n={10} title="Penghentian layanan">
        <p>
          Anda dapat berhenti kapan saja dengan memutus channel dan meminta penghapusan akun. Kami dapat menangguhkan akun yang
          melanggar syarat ini atau aturan penyedia channel.
        </p>
      </Section>

      <Section id="hukum" n={11} title="Hukum yang berlaku">
        <p>Syarat ini tunduk pada hukum Republik Indonesia. Perselisihan diselesaikan secara musyawarah terlebih dahulu.</p>
      </Section>
    </LegalPage>
  );
}
