// Format teks ala WhatsApp untuk composer + preview. WhatsApp TIDAK merender HTML;
// hanya markup-nya sendiri: *tebal*, _miring_, ~coret~, ```monospace```. Editor
// menyimpan plaintext ber-markup ini (bukan HTML) — preview di bawah hanya untuk
// tampilan di dashboard, di-escape dulu supaya aman dari XSS.

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

// Render markup WhatsApp → HTML aman (untuk preview saja). Input di-escape lebih dulu,
// jadi tag apa pun di teks pengguna jadi literal — output tak bisa menyuntik HTML.
export function waToHtml(text: string): string {
  let h = escapeHtml(text);
  // Monospace dulu (```...```), agar isinya tak ikut diproses bold/italic.
  h = h.replace(/```([\s\S]+?)```/g, "<code>$1</code>");
  // Marker harus menempel ke karakter non-spasi (mirip aturan WA), batas kata di luar.
  h = h.replace(/(^|[\s(>])\*([^\s*][^*]*?)\*(?=[\s).,!?<]|$)/g, "$1<strong>$2</strong>");
  h = h.replace(/(^|[\s(>])_([^\s_][^_]*?)_(?=[\s).,!?<]|$)/g, "$1<em>$2</em>");
  h = h.replace(/(^|[\s(>])~([^\s~][^~]*?)~(?=[\s).,!?<]|$)/g, "$1<del>$2</del>");
  h = h.replace(/\n/g, "<br/>");
  return h;
}
