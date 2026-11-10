import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section, legalLang } from "@/components/landing/legal-page";

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return legalLang((await searchParams).lang) === "en"
    ? { title: "Terms of Service", description: "Rules for using ChatCepat: accounts, channels, broadcasts, AI, payments, and liability." }
    : { title: "Syarat & Ketentuan", description: "Aturan penggunaan layanan ChatCepat: akun, channel, broadcast, AI, pembayaran, dan tanggung jawab." };
}

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

export default async function TermsPage({ searchParams }: Props) {
  return legalLang((await searchParams).lang) === "en" ? <TermsEn /> : <TermsId />;
}

function TermsId() {
  return (
    <LegalPage
      lang="id"
      path="/terms"
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

const SECTIONS_EN = [
  { id: "service", title: "The service" },
  { id: "account", title: "Accounts & workspaces" },
  { id: "channels", title: "Third-party channels" },
  { id: "prohibited", title: "Prohibited use" },
  { id: "broadcast", title: "Broadcasts & contact consent" },
  { id: "ai", title: "AI features" },
  { id: "billing", title: "Plans & payment" },
  { id: "data", title: "Data & privacy" },
  { id: "liability", title: "Limitation of liability" },
  { id: "termination", title: "Termination" },
  { id: "law", title: "Governing law" },
];

function TermsEn() {
  return (
    <LegalPage
      lang="en"
      path="/terms"
      title="Terms of Service"
      updated="November 9, 2026"
      sections={SECTIONS_EN}
      intro={
        <p>
          By signing up for or using ChatCepat, you agree to these terms. If you sign up on behalf of a business, you confirm you are
          authorized to act for that business.
        </p>
      }
    >
      <Section id="service" n={1} title="The service">
        <p>
          ChatCepat provides an omnichannel inbox for WhatsApp, Instagram, Facebook Messenger, and Telegram, with auto-replies, an AI
          agent, broadcasts, a product catalog, and reports. Available features depend on your plan.
        </p>
      </Section>

      <Section id="account" n={2} title="Accounts & workspaces">
        <Bullets
          items={[
            <>You must provide accurate sign-up details and keep your password confidential.</>,
            <>You are responsible for all activity in your workspace, including by team members.</>,
            <>Tell us right away if you suspect your account is being misused.</>,
          ]}
        />
      </Section>

      <Section id="channels" n={3} title="Third-party channels">
        <p>
          Channels you connect are subject to their owners’ rules, including the WhatsApp Business Policy, Meta Platform Terms,
          Instagram &amp; Facebook Community Standards, and Telegram Terms of Service. You must follow those rules.
        </p>
        <p>
          The unofficial WhatsApp connection (QR pairing) is not supported by WhatsApp. The number used may be limited or banned by
          WhatsApp, and that risk is borne entirely by the number’s owner. For business use at scale, use WhatsApp Official
          (Cloud API).
        </p>
      </Section>

      <Section id="prohibited" n={4} title="Prohibited use">
        <Bullets
          items={[
            <>Sending spam or bulk messages to people who have not given consent.</>,
            <>Collecting other people’s numbers or contact data without permission (scraping).</>,
            <>Spreading fraudulent, illegal, hateful, or violent content, or content that infringes others’ rights.</>,
            <>Trying to access other workspaces’ data, disrupting the system, or reverse engineering the service.</>,
          ]}
        />
        <p>Violations may lead to suspension or termination of the account without refund.</p>
      </Section>

      <Section id="broadcast" n={5} title="Broadcasts & contact consent">
        <p>
          Broadcasts may only be sent to contacts who have given consent (opt-in). Our system refuses to send to contacts who have not
          opted in or have unsubscribed. You are responsible for obtaining that consent lawfully.
        </p>
      </Section>

      <Section id="ai" n={6} title="AI features">
        <p>
          AI answers are generated automatically from the documents and settings you provide and can be wrong. You are responsible for
          checking important information (prices, stock, delivery promises) and for having a human agent available for decisions.
        </p>
      </Section>

      <Section id="billing" n={7} title="Plans & payment">
        <Bullets
          items={[
            <>Plan prices are shown on the pricing page and may change with prior notice.</>,
            <>Payments are processed by a third-party payment provider. A plan becomes active once payment is confirmed.</>,
            <>Quotas (for example AI tokens) apply to the plan period and cannot be exchanged for money.</>,
            <>Unless required by law, processed payments are non-refundable.</>,
          ]}
        />
      </Section>

      <Section id="data" n={8} title="Data & privacy">
        <p>
          Conversation and contact data belong to your workspace. We process them only to run the service, as described in the{" "}
          <Link href="/privacy?lang=en" className="font-medium text-brand-blue hover:underline">
            Privacy Policy
          </Link>
          . You are responsible for the legal basis for processing your customers’ data.
        </p>
      </Section>

      <Section id="liability" n={9} title="Limitation of liability">
        <p>
          The service is provided &ldquo;as is&rdquo;. We work to keep it available but do not guarantee it is free of interruptions,
          especially those caused by third-party channel providers. To the extent permitted by law, our liability is limited to the
          amount you paid in the last 3 months.
        </p>
      </Section>

      <Section id="termination" n={10} title="Termination">
        <p>
          You can stop at any time by disconnecting your channels and asking us to delete your account. We may suspend accounts that
          break these terms or the channel providers’ rules.
        </p>
      </Section>

      <Section id="law" n={11} title="Governing law">
        <p>These terms are governed by the laws of the Republic of Indonesia. Disputes are first resolved through good-faith discussion.</p>
      </Section>
    </LegalPage>
  );
}
