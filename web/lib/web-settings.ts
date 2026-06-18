// Pengaturan website/brand tenant (client-safe). Disimpan di tenants.settings.web_settings.
export interface WebSettings {
  siteName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  seo: { title: string; description: string; keywords: string; ogImage: string };
  social: {
    instagram: string;
    facebook: string;
    twitter: string;
    tiktok: string;
    youtube: string;
    linkedin: string;
    whatsapp: string;
  };
  contact: { email: string; phone: string; address: string };
}

// Dummy default (terisi supaya form tidak kosong).
export const DEFAULT_WEB_SETTINGS: WebSettings = {
  siteName: "ChatCepat",
  tagline: "Satu Inbox untuk Semua Pelanggan",
  description: "Kelola WhatsApp, Instagram, Facebook, dan Telegram dari satu platform yang mudah digunakan.",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  seo: {
    title: "ChatCepat — Omnichannel Inbox & AI Sales Agent",
    description: "Platform CS omnichannel untuk UMKM: balas otomatis AI, broadcast patuh aturan, kolaborasi tim.",
    keywords: "whatsapp, omnichannel, customer service, broadcast, ai agent, chatbot, umkm",
    ogImage: "/logo.png",
  },
  social: {
    instagram: "https://instagram.com/chatcepat",
    facebook: "https://facebook.com/chatcepat",
    twitter: "https://x.com/chatcepat",
    tiktok: "https://tiktok.com/@chatcepat",
    youtube: "https://youtube.com/@chatcepat",
    linkedin: "https://linkedin.com/company/chatcepat",
    whatsapp: "6281200000000",
  },
  contact: {
    email: "halo@chatcepat.id",
    phone: "+62 812-0000-0000",
    address: "Jakarta, Indonesia",
  },
};

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeWebSettings(raw: unknown): WebSettings {
  const r = (raw ?? {}) as Partial<WebSettings>;
  const d = DEFAULT_WEB_SETTINGS;
  const seo = (r.seo ?? {}) as Partial<WebSettings["seo"]>;
  const social = (r.social ?? {}) as Partial<WebSettings["social"]>;
  const contact = (r.contact ?? {}) as Partial<WebSettings["contact"]>;
  return {
    siteName: str(r.siteName, d.siteName),
    tagline: str(r.tagline, d.tagline),
    description: str(r.description, d.description),
    logoUrl: str(r.logoUrl, d.logoUrl),
    faviconUrl: str(r.faviconUrl, d.faviconUrl),
    seo: {
      title: str(seo.title, d.seo.title),
      description: str(seo.description, d.seo.description),
      keywords: str(seo.keywords, d.seo.keywords),
      ogImage: str(seo.ogImage, d.seo.ogImage),
    },
    social: {
      instagram: str(social.instagram, d.social.instagram),
      facebook: str(social.facebook, d.social.facebook),
      twitter: str(social.twitter, d.social.twitter),
      tiktok: str(social.tiktok, d.social.tiktok),
      youtube: str(social.youtube, d.social.youtube),
      linkedin: str(social.linkedin, d.social.linkedin),
      whatsapp: str(social.whatsapp, d.social.whatsapp),
    },
    contact: {
      email: str(contact.email, d.contact.email),
      phone: str(contact.phone, d.contact.phone),
      address: str(contact.address, d.contact.address),
    },
  };
}
