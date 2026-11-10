import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section, legalLang } from "@/components/landing/legal-page";

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return legalLang((await searchParams).lang) === "en"
    ? { title: "Privacy Policy", description: "What data ChatCepat collects, why, who it is shared with, and how to delete it." }
    : { title: "Kebijakan Privasi", description: "Data apa yang dikumpulkan ChatCepat, untuk apa, dengan siapa dibagikan, dan bagaimana menghapusnya." };
}

const UPDATED = { id: "10 November 2026", en: "November 10, 2026" };
const link = "font-medium text-brand-blue hover:underline";

export default async function PrivacyPage({ searchParams }: Props) {
  const lang = legalLang((await searchParams).lang);
  return lang === "en" ? <PrivacyEn /> : <PrivacyId />;
}

function PrivacyId() {
  return (
    <LegalPage
      lang="id"
      path="/privacy"
      title="Kebijakan Privasi"
      updated={UPDATED.id}
      sections={[
        { id: "data", title: "Data yang kami kumpulkan" },
        { id: "meta", title: "Data dari Facebook, Instagram & WhatsApp" },
        { id: "penggunaan", title: "Cara kami menggunakan data" },
        { id: "pihak-ketiga", title: "Pihak ketiga" },
        { id: "keamanan", title: "Keamanan" },
        { id: "penyimpanan", title: "Lama penyimpanan" },
        { id: "hak", title: "Hak Anda & penghapusan data" },
        { id: "perubahan", title: "Perubahan kebijakan" },
      ]}
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
          Saat workspace menghubungkan <b>WhatsApp Business</b> lewat pendaftaran tersemat (Embedded Signup) Meta, kami menerima ID
          WhatsApp Business Account, ID nomor telepon bisnis, dan token akses. Data ini dipakai hanya untuk:
        </p>
        <Bullets
          items={[
            <>Menerima pesan yang dikirim pelanggan ke nomor WhatsApp bisnis tersebut dan mengirim balasan atas nama bisnis.</>,
            <>Membuat dan mengelola template pesan WhatsApp milik bisnis, serta membaca status pengiriman pesan.</>,
            <>Mendaftarkan nomor ke webhook agar pesan baru masuk ke inbox secara real-time.</>,
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
        <p>
          Anda dapat meminta akses, koreksi, atau penghapusan data pribadi Anda. Caranya dijelaskan di halaman{" "}
          <Link href="/data-deletion" className={link}>
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

function PrivacyEn() {
  return (
    <LegalPage
      lang="en"
      path="/privacy"
      title="Privacy Policy"
      updated={UPDATED.en}
      sections={[
        { id: "data", title: "Data we collect" },
        { id: "meta", title: "Data from Facebook, Instagram & WhatsApp" },
        { id: "use", title: "How we use data" },
        { id: "third-parties", title: "Third parties" },
        { id: "security", title: "Security" },
        { id: "retention", title: "Retention" },
        { id: "rights", title: "Your rights & data deletion" },
        { id: "changes", title: "Changes to this policy" },
      ]}
      intro={
        <p>
          ChatCepat (&ldquo;we&rdquo;) is an omnichannel inbox that helps businesses (&ldquo;Users&rdquo; or
          &ldquo;workspaces&rdquo;) reply to customer messages from WhatsApp, Instagram, Facebook Messenger, and Telegram in one
          place. This policy explains what data we process, why, and how you can delete it.
        </p>
      }
    >
      <Section id="data" n={1} title="Data we collect">
        <Bullets
          items={[
            <>
              <b>Account data:</b> name, email, phone number, and password (stored as a hash, never as plain text) of people who sign
              up and of workspace team members.
            </>,
            <>
              <b>Channel data:</b> access tokens and account IDs needed to connect the workspace’s WhatsApp, Facebook Page,
              Instagram, or Telegram account.
            </>,
            <>
              <b>Conversations &amp; contacts:</b> messages, attachments, and comments that the workspace’s customers send to
              connected channels, with the sender’s name, phone number, or account ID, and their consent (opt-in) status for
              broadcasts.
            </>,
            <>
              <b>Content uploaded by the workspace:</b> products, knowledge documents for the AI, templates, and automation settings.
            </>,
            <>
              <b>Payment data:</b> the plan purchased and the transaction status. Card or bank details are processed directly by the
              payment provider and are not stored by us.
            </>,
            <>
              <b>Technical data:</b> access and activity logs needed for security and troubleshooting.
            </>,
          ]}
        />
      </Section>

      <Section id="meta" n={2} title="Data from Facebook, Instagram & WhatsApp">
        <p>When a workspace connects an account with Facebook Login, we request only the permissions the inbox needs:</p>
        <Bullets
          items={[
            <>See the Facebook Pages the person manages and the Instagram Professional accounts linked to those Pages.</>,
            <>Receive and reply to messages (DMs) sent to that Page / Instagram account.</>,
            <>Read and reply to comments on that Page’s / Instagram account’s posts, including sending one private reply to the commenter.</>,
            <>Subscribe the Page to webhooks so new messages arrive in the inbox in real time.</>,
          ]}
        />
        <p>
          When a workspace connects <b>WhatsApp Business</b> through Meta’s Embedded Signup, we receive the WhatsApp Business
          Account ID, the business phone number ID, and an access token. They are used only to:
        </p>
        <Bullets
          items={[
            <>Receive messages customers send to that business number and send replies on behalf of the business.</>,
            <>Create and manage the business’s WhatsApp message templates and read message delivery status.</>,
            <>Subscribe the number to webhooks so new messages arrive in the inbox in real time.</>,
          ]}
        />
        <p>
          We do <b>not</b> sell this data, use it for advertising, or share it with other workspaces. It is used only to show and
          answer conversations in the workspace that connected the account. We do not store the personal Facebook profile of the
          person who logs in beyond what is needed to connect the Page.
        </p>
      </Section>

      <Section id="use" n={3} title="How we use data">
        <Bullets
          items={[
            <>Show conversations in the inbox and send replies written by agents or produced by the workspace’s automations.</>,
            <>Run features the workspace turns on: auto-replies, AI agent, broadcasts to opted-in contacts, reports.</>,
            <>Manage accounts, billing, email notifications, and customer support.</>,
            <>Keep the service secure and prevent abuse, including spam.</>,
          ]}
        />
        <p>Broadcasts can only be sent to contacts who have given consent (opt-in). Contacts can stop at any time by replying STOP.</p>
      </Section>

      <Section id="third-parties" n={4} title="Third parties">
        <p>We share data only as needed with providers that help run the service:</p>
        <Bullets
          items={[
            <>
              <b>Meta Platforms</b> (WhatsApp, Instagram, Facebook Messenger) and <b>Telegram</b>: to receive and send messages through
              the channels the workspace connects.
            </>,
            <>
              <b>AI model providers:</b> when the workspace turns on the AI agent, the customer’s message and relevant knowledge
              documents are sent to the model provider to draft an answer.
            </>,
            <>
              <b>Payment provider</b> (Duitku): to process plan purchases.
            </>,
            <>
              <b>Email provider</b>: to send account emails such as verification and password reset.
            </>,
          ]}
        />
        <p>We may also disclose data when required by applicable Indonesian law.</p>
      </Section>

      <Section id="security" n={5} title="Security">
        <Bullets
          items={[
            <>All connections use HTTPS.</>,
            <>Channel access tokens are stored encrypted (AES-256-GCM).</>,
            <>Passwords are stored as bcrypt hashes.</>,
            <>Each workspace’s data is isolated; one workspace cannot see another’s data.</>,
          ]}
        />
      </Section>

      <Section id="retention" n={6} title="Retention">
        <p>
          Data is kept while the workspace is active. When a channel is disconnected, its access token is deleted and its webhook
          subscription is removed. When an account is deleted, the workspace’s data is removed from our systems within 30 days,
          except data we must keep longer by law (for example, transaction records).
        </p>
      </Section>

      <Section id="rights" n={7} title="Your rights & data deletion">
        <p>
          You can request access to, correction of, or deletion of your personal data. See the{" "}
          <Link href="/data-deletion?lang=en" className={link}>
            Data Deletion
          </Link>{" "}
          page for how.
        </p>
        <p>
          If you are a customer who messaged a business that uses ChatCepat, that business controls your conversation data. You can
          contact the business, or contact us and we will help forward your request.
        </p>
      </Section>

      <Section id="changes" n={8} title="Changes to this policy">
        <p>We may update this policy. Important changes will be announced by email or in the dashboard before they take effect.</p>
      </Section>
    </LegalPage>
  );
}
