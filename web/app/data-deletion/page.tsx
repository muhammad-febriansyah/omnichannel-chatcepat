import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { Bullets, LegalPage, Section } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Penghapusan Data",
  description: "Cara menghapus data Anda dari ChatCepat, termasuk data yang terhubung lewat Facebook dan Instagram.",
};

const SECTIONS = [
  { id: "facebook", title: "Hapus akses Facebook / Instagram" },
  { id: "workspace", title: "Pemilik workspace" },
  { id: "pelanggan", title: "Pelanggan yang pernah chat" },
  { id: "dihapus", title: "Apa yang dihapus" },
];

// Only codes we issue (lib/meta-signed-request confirmationCode) are echoed back.
const CODE = /^DEL-[0-9A-F]{12}$/;

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await searchParams;
  const code = raw && CODE.test(raw) ? raw : null;
  const ws = await getPublicWebSettings();
  const email = ws.contact.email;

  return (
    <LegalPage
      title="Penghapusan Data"
      updated="9 November 2026"
      sections={SECTIONS}
      intro={
        <>
          {code && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">Permintaan penghapusan data diterima</p>
                <p className="mt-1">
                  Kode konfirmasi: <span className="font-mono font-semibold">{code}</span>
                </p>
                <p className="mt-1">
                  ChatCepat tidak menyimpan data profil Facebook pribadi Anda. Akses aplikasi ke akun Anda sudah dicabut oleh Facebook.
                  Jika Anda juga ingin data lain dihapus (lihat di bawah), kirim kode ini ke{" "}
                  <a href={`mailto:${email}?subject=${encodeURIComponent(`Penghapusan data ${code}`)}`} className="font-medium underline">
                    {email}
                  </a>
                  .
                </p>
              </div>
            </div>
          )}
          <p>Halaman ini menjelaskan cara menghapus data Anda dari ChatCepat. Permintaan diproses paling lama 30 hari.</p>
        </>
      }
    >
      <Section id="facebook" n={1} title="Hapus akses Facebook / Instagram">
        <p>Untuk mencabut akses ChatCepat ke akun Facebook atau Instagram Anda:</p>
        <Bullets
          items={[
            <>
              Buka Facebook → <b>Pengaturan &amp; privasi</b> → <b>Pengaturan</b> → <b>Integrasi Bisnis</b> (Business Integrations).
            </>,
            <>
              Pilih <b>ChatCepat</b>, lalu klik <b>Hapus</b>. Centang opsi untuk menghapus data yang pernah dibagikan bila tersedia.
            </>,
          ]}
        />
        <p>Facebook akan memberi tahu kami, dan Anda akan menerima kode konfirmasi beserta tautan ke halaman ini.</p>
      </Section>

      <Section id="workspace" n={2} title="Pemilik workspace">
        <Bullets
          items={[
            <>
              <b>Putus channel:</b> di dashboard, buka <b>Channel</b> lalu putuskan akun yang ingin dihapus. Token akses dihapus dan
              pendaftaran webhook dicabut saat itu juga.
            </>,
            <>
              <b>Hapus kontak:</b> di menu <b>Kontak</b>, hapus kontak yang tidak lagi diperlukan.
            </>,
            <>
              <b>Hapus akun &amp; seluruh data workspace:</b> kirim email dari alamat akun Anda ke{" "}
              <a href={`mailto:${email}?subject=${encodeURIComponent("Hapus akun ChatCepat")}`} className="font-medium text-brand-blue hover:underline">
                {email}
              </a>{" "}
              dengan subjek &ldquo;Hapus akun ChatCepat&rdquo;.
            </>,
          ]}
        />
      </Section>

      <Section id="pelanggan" n={3} title="Pelanggan yang pernah chat">
        <p>
          Jika Anda pernah mengirim pesan ke sebuah bisnis yang memakai ChatCepat, data percakapan Anda dikelola oleh bisnis tersebut.
          Hubungi bisnis itu untuk meminta penghapusan, atau kirim email ke{" "}
          <a href={`mailto:${email}`} className="font-medium text-brand-blue hover:underline">
            {email}
          </a>{" "}
          dengan menyebutkan nama bisnis dan nomor / akun yang Anda gunakan. Kami akan membantu meneruskan dan memproses permintaan
          Anda. Untuk berhenti menerima broadcast, cukup balas <b>STOP</b>.
        </p>
      </Section>

      <Section id="dihapus" n={4} title="Apa yang dihapus">
        <Bullets
          items={[
            <>Token akses dan ID akun channel yang terhubung.</>,
            <>Percakapan, pesan, lampiran, dan kontak milik workspace.</>,
            <>Dokumen pengetahuan AI, produk, template, dan alur otomatis.</>,
            <>Data akun pengguna dan anggota tim.</>,
          ]}
        />
        <p>Catatan transaksi pembayaran dapat disimpan lebih lama bila diwajibkan oleh peraturan perpajakan.</p>
      </Section>
    </LegalPage>
  );
}
