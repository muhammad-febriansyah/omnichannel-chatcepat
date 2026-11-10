import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { Bullets, LegalPage, Section, legalLang } from "@/components/landing/legal-page";

type Props = { searchParams: Promise<{ code?: string; lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return legalLang((await searchParams).lang) === "en"
    ? { title: "Data Deletion", description: "How to delete your data from ChatCepat, including data connected through Facebook and Instagram." }
    : { title: "Penghapusan Data", description: "Cara menghapus data Anda dari ChatCepat, termasuk data yang terhubung lewat Facebook dan Instagram." };
}

const SECTIONS = [
  { id: "facebook", title: "Hapus akses Facebook / Instagram" },
  { id: "workspace", title: "Pemilik workspace" },
  { id: "pelanggan", title: "Pelanggan yang pernah chat" },
  { id: "dihapus", title: "Apa yang dihapus" },
];

// Only codes we issue (lib/meta-signed-request confirmationCode) are echoed back.
const CODE = /^DEL-[0-9A-F]{12}$/;

export default async function DataDeletionPage({ searchParams }: Props) {
  const { code: raw, lang } = await searchParams;
  const code = raw && CODE.test(raw) ? raw : null;
  const ws = await getPublicWebSettings();
  const email = ws.contact.email;
  return legalLang(lang) === "en" ? <DeletionEn code={code} email={email} /> : <DeletionId code={code} email={email} />;
}

function DeletionId({ code, email }: { code: string | null; email: string }) {
  return (
    <LegalPage
      lang="id"
      path="/data-deletion"
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

const SECTIONS_EN = [
  { id: "facebook", title: "Remove Facebook / Instagram access" },
  { id: "workspace", title: "Workspace owners" },
  { id: "customers", title: "Customers who chatted with a business" },
  { id: "deleted", title: "What gets deleted" },
];

function DeletionEn({ code, email }: { code: string | null; email: string }) {
  const mail = "font-medium text-brand-blue hover:underline";
  return (
    <LegalPage
      lang="en"
      path="/data-deletion"
      title="Data Deletion"
      updated="November 9, 2026"
      sections={SECTIONS_EN}
      intro={
        <>
          {code && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">Data deletion request received</p>
                <p className="mt-1">
                  Confirmation code: <span className="font-mono font-semibold">{code}</span>
                </p>
                <p className="mt-1">
                  ChatCepat does not store your personal Facebook profile data. Facebook has already removed the app’s access to
                  your account. If you also want other data deleted (see below), send this code to{" "}
                  <a href={`mailto:${email}?subject=${encodeURIComponent(`Data deletion ${code}`)}`} className="font-medium underline">
                    {email}
                  </a>
                  .
                </p>
              </div>
            </div>
          )}
          <p>This page explains how to delete your data from ChatCepat. Requests are processed within 30 days.</p>
        </>
      }
    >
      <Section id="facebook" n={1} title="Remove Facebook / Instagram access">
        <p>To remove ChatCepat’s access to your Facebook or Instagram account:</p>
        <Bullets
          items={[
            <>
              Open Facebook → <b>Settings &amp; privacy</b> → <b>Settings</b> → <b>Business Integrations</b>.
            </>,
            <>
              Select <b>ChatCepat</b> and click <b>Remove</b>. Tick the option to delete data that was shared, if shown.
            </>,
          ]}
        />
        <p>Facebook notifies us, and you receive a confirmation code with a link to this page.</p>
      </Section>

      <Section id="workspace" n={2} title="Workspace owners">
        <Bullets
          items={[
            <>
              <b>Disconnect a channel:</b> in the dashboard, open <b>Channel</b> and disconnect the account. Its access token is deleted
              and its webhook subscription is removed immediately.
            </>,
            <>
              <b>Delete contacts:</b> in <b>Contacts</b>, delete contacts you no longer need.
            </>,
            <>
              <b>Delete the account &amp; all workspace data:</b> email{" "}
              <a href={`mailto:${email}?subject=${encodeURIComponent("Delete ChatCepat account")}`} className={mail}>
                {email}
              </a>{" "}
              from your account’s email address with the subject &ldquo;Delete ChatCepat account&rdquo;.
            </>,
          ]}
        />
      </Section>

      <Section id="customers" n={3} title="Customers who chatted with a business">
        <p>
          If you messaged a business that uses ChatCepat, that business manages your conversation data. Contact the business to ask
          for deletion, or email{" "}
          <a href={`mailto:${email}`} className={mail}>
            {email}
          </a>{" "}
          with the business name and the number / account you used. We will help forward and process your request. To stop receiving
          broadcasts, simply reply <b>STOP</b>.
        </p>
      </Section>

      <Section id="deleted" n={4} title="What gets deleted">
        <Bullets
          items={[
            <>Access tokens and account IDs of connected channels.</>,
            <>The workspace’s conversations, messages, attachments, and contacts.</>,
            <>AI knowledge documents, products, templates, and automations.</>,
            <>User and team member account data.</>,
          ]}
        />
        <p>Payment transaction records may be kept longer when tax regulations require it.</p>
      </Section>
    </LegalPage>
  );
}
