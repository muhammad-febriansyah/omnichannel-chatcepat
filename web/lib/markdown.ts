// Renderer Markdown minimal untuk PRATINJAU knowledge base (bukan parser penuh).
// Konten KB disimpan sebagai teks Markdown (LLM paham Markdown, masuk RAG apa adanya);
// fungsi ini hanya untuk menampilkan preview di dashboard. Semua teks di-escape lebih
// dulu → output aman dipakai dengan dangerouslySetInnerHTML (tak bisa suntik HTML/JS).

import { escapeHtml } from "./wa-format";

// Sentinel non-printable (private-use U+F8FF) penanda fenced code block —
// anti-collision dengan teks pengguna. fromCharCode: tanpa karakter literal di source.
const FENCE = String.fromCharCode(0xf8ff);

// Markup inline pada teks yang SUDAH di-escape (marker * _ ` [ ] tak ikut ter-escape).
function inline(s: string): string {
  let h = s;
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  // [teks](url) — hanya izinkan skema aman, selain itu href dinetralkan.
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const safe = /^(https?:|mailto:)/i.test(url) ? url : "#";
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  h = h.replace(/(^|[^a-zA-Z0-9])_([^_]+)_(?=[^a-zA-Z0-9]|$)/g, "$1<em>$2</em>");
  return h;
}

export function mdToHtml(src: string): string {
  // Lindungi fenced code block, render escaped, sisipkan kembali via sentinel.
  const blocks: string[] = [];
  const work = src.replace(/```([\s\S]*?)```/g, (_m, code: string) => {
    blocks.push(`<pre><code>${escapeHtml(code.replace(/^\n/, ""))}</code></pre>`);
    return `${FENCE}${blocks.length - 1}${FENCE}`;
  });

  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(escapeHtml(para.join(" ")))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of work.split("\n")) {
    const line = raw.replace(/\s+$/, "");

    const ph = line.match(new RegExp(`^${FENCE}(\\d+)${FENCE}$`));
    if (ph) {
      flushPara();
      closeList();
      out.push(blocks[Number(ph[1])]);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeList();
      const lvl = heading[1].length + 1; // # → h2, ## → h3, ### → h4
      out.push(`<h${lvl}>${inline(escapeHtml(heading[2]))}</h${lvl}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(escapeHtml(ol[1]))}</li>`);
      continue;
    }

    closeList();
    para.push(line.trim());
  }
  flushPara();
  closeList();
  return out.join("\n");
}
