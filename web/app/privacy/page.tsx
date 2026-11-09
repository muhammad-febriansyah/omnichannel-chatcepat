import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Data apa yang dikumpulkan ChatCepat, untuk apa, dengan siapa dibagikan, dan bagaimana menghapusnya.",
};

const SECTIONS = [
  { id: "data", title: "Data yang kami kumpulkan" },
  { id: "meta", title: "Data dari Facebook, Instagram & WhatsApp" },
  { id: "penggunaan", title: "Cara kami menggunakan data" },
  { id: "pihak-ketiga", title: "Pihak ketiga" },
  { id: "keamanan", title: "Keamanan" },
  { id: "penyimpanan", title: "Lama penyimpanan" },
  { id: "hak", title: "Hak Anda & penghapusan data" },
  { id: "perubahan", title: "Perubahan kebijakan" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      updated="9 November 2026"
      sections={SECTIONS}
      intro={
        <p>
          ChatCepat (&ldquo;kami&rdquo;) adalah platform inbox omnichannel yang membantu bisnis (&ldquo;Pengguna&rdquo; atau
          &ldquo;workspace&rdquo;) membalas pesan pelanggan dari WhatsApp, Instagram, Facebook Messenger, dan Telegram di satu
          tempat. Kebijakan ini menjelaskan data apa yang kami proses, untuk apa, dan bagaimana Anda dapat menghapusnya.
        </p>
      }
    >
      <Section id="data" n={1} title="Data yang kami kumpulkan">
        <Bullets
          items={[
            <>
              <b>Data akun:</b> nama, email, nomor telepon, dan password (disimpan sebagai hash, bukan teks asli) dari orang yang
              mendaftar dan anggota tim workspace.
            </>,
            <>
              <b>Data channel:</b> token akses dan ID akun yang diperlukan untuk menghubungkan WhatsApp, Facebook Page, Instagram,
              atau Telegram milik workspace.
            </>,
            <>
              <b>Percakapan &amp; kontak:</b> pesan, lampiran, dan komentar yang dikirim pelanggan workspace ke channel yang
              terhubung, beserta nama, nomor telepon, atau ID akun pengirim, serta status persetujuan (opt-in) mereka untuk menerima
              broadcast.
            </>,
            <>
              <b>Konten yang diunggah workspace:</b> produk, dokumen pengetahuan untuk AI, template, dan pengaturan alur otomatis.
            </>,
            <>
              <b>Data pembayaran:</b> paket yang dibeli dan status transaksi. Data kartu atau rekening diproses langsung oleh
              penyedia pembayaran, tidak disimpan oleh kami.
            </>,
            <>
              <b>Data teknis:</b> log akses dan log aktivitas yang diperlukan untuk keamanan dan pemecahan masalah.
            </>,
          ]}
        />
      </Section>

      <Section id="meta" n={2} title="Data dari Facebook, Instagram & WhatsApp">
        <p>
          Saat workspace menghubungkan akun lewat Login dengan Facebook, kami meminta izin yang diperlukan untuk fitur inbox saja:
        </p>
        <Bullets
          items={[
            <>Melihat daftar Facebook Page yang dikelola dan akun Instagram Professional yang tertaut ke Page tersebut.</>,
            <>Menerima dan membalas pesan (DM) yang dikirim orang ke Page / akun Instagram tersebut.</>,
            <>Membaca dan membalas komentar pada postingan Page / akun Instagram tersebut, termasuk mengirim satu pesan pribadi ke pemberi komentar.</>,
            <>Mendaftarkan Page ke webhook agar pesan baru masuk ke inbox secara real-time.</>,
          ]}
        />
        <p>
          Kami <b>tidak</b> menjual data ini, tidak memakainya untuk iklan, dan tidak membagikannya ke workspace lain. Data hanya
          dipakai untuk menampilkan dan membalas percakapan di workspace yang menghubungkan akun tersebut. Kami tidak menyimpan
          profil Facebook pribadi orang yang login selain yang diperlukan untuk menghubungkan Page.
        </p>
      </Section>

      <Section id="penggunaan" n={3} title="Cara kami menggunakan data">
        <Bullets
          items={[
            <>Menampilkan percakapan di inbox dan mengirim balasan yang ditulis agen atau dibuat oleh alur otomatis workspace.</>,
            <>Menjalankan fitur yang diaktifkan workspace: balasan otomatis, AI agent, broadcast ke kontak yang sudah opt-in, laporan.</>,
            <>Mengelola akun, tagihan, notifikasi email, dan dukungan pelanggan.</>,
            <>Menjaga keamanan layanan dan mencegah penyalahgunaan, termasuk spam.</>,
          ]}
        />
        <p>Broadcast hanya dapat dikirim ke kontak yang telah memberikan persetujuan (opt-in). Kontak dapat berhenti kapan saja dengan membalas STOP.</p>
      </Section>

      <Section id="pihak-ketiga" n={4} title="Pihak ketiga">
        <p>Kami hanya membagikan data seperlunya kepada penyedia yang membantu menjalankan layanan:</p>
        <Bullets
          items={[
            <>
              <b>Meta Platforms</b> (WhatsApp, Instagram, Facebook Messenger) dan <b>Telegram</b>: untuk menerima dan mengirim pesan
              lewat channel yang dihubungkan workspace.
            </>,
            <>
              <b>Penyedia model AI:</b> bila workspace mengaktifkan AI agent, isi pesan pelanggan dan dokumen pengetahuan yang relevan
              dikirim ke penyedia model untuk menyusun jawaban.
            </>,
            <>
              <b>Penyedia pembayaran</b> (Duitku): untuk memproses pembelian paket.
            </>,
            <>
              <b>Penyedia email</b>: untuk mengirim email akun seperti verifikasi dan reset password.
            </>,
          ]}
        />
        <p>Kami juga dapat mengungkapkan data bila diwajibkan oleh hukum yang berlaku di Indonesia.</p>
      </Section>

      <Section id="keamanan" n={5} title="Keamanan">
        <Bullets
          items={[
            <>Semua koneksi memakai HTTPS.</>,
            <>Token akses channel disimpan terenkripsi (AES-256-GCM).</>,
            <>Password disimpan sebagai hash bcrypt.</>,
            <>Data setiap workspace dipisahkan; satu workspace tidak dapat melihat data workspace lain.</>,
          ]}
        />
      </Section>

      <Section id="penyimpanan" n={6} title="Lama penyimpanan">
        <p>
          Data disimpan selama workspace aktif. Saat channel diputus, token akses channel tersebut dihapus dan pendaftaran webhook
          dicabut. Saat akun dihapus, data workspace dihapus dari sistem kami dalam waktu paling lama 30 hari, kecuali data yang wajib
          disimpan lebih lama menurut hukum (misalnya catatan transaksi).
        </p>
      </Section>

      <Section id="hak" n={7} title="Hak Anda & penghapusan data">
        <p>Anda dapat meminta akses, koreksi, atau penghapusan data pribadi Anda. Caranya dijelaskan di halaman{" "}
          <Link href="/data-deletion" className="font-medium text-brand-blue hover:underline">
            Penghapusan Data
          </Link>
          .
        </p>
        <p>
          Jika Anda adalah pelanggan yang pernah mengirim pesan ke sebuah bisnis pengguna ChatCepat, bisnis tersebut adalah pengendali
          data percakapan Anda. Anda dapat menghubungi bisnis tersebut, atau menghubungi kami dan kami akan membantu meneruskan
          permintaan Anda.
        </p>
      </Section>

      <Section id="perubahan" n={8} title="Perubahan kebijakan">
        <p>Kami dapat memperbarui kebijakan ini. Perubahan penting akan diberitahukan lewat email atau dashboard sebelum berlaku.</p>
      </Section>
    </LegalPage>
  );
}
