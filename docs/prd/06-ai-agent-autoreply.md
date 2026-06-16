# 06 — Auto-reply, Flow Builder & AI Agent

Dependensi: `02`, `05`. Ini "otak" balasan — node "Cocokkan balasan" di diagram.

## Fallback chain (urutan pasti)

Saat `handler != agent`, engine pilih balasan dengan urutan ini, berhenti di yang pertama cocok:

```
1. FLOW STATE   — sedang di tengah flow? lanjutkan node berikutnya.
2. TRIGGER      — pesan cocok keyword/welcome trigger? mulai flow itu.
3. AI AGENT     — agent aktif? jalankan (paham konteks + tool + RAG).
4. FALLBACK     — pesan default ATAU handoff ke agen.
```

Tenant bisa pilih mode: **flow-only**, **AI-only**, atau **hybrid** (flow untuk alur terstruktur spt order, AI untuk pertanyaan bebas). Default: hybrid.

## A. Flow Builder (rule + node terstruktur)

Untuk alur deterministik: pilih menu, tanya jawab bertahap, kumpulkan data order.

### Struktur `flows.definition` (graph)
```jsonc
{
  "nodes": [
    { "id": "start", "type": "trigger", "trigger": { "kind": "keyword", "match": ["menu","mulai"] }, "next": "greet" },
    { "id": "greet", "type": "send_text", "text": "Halo {{nama}} 👋 Pilih:\n1. Katalog\n2. Promo", "next": "wait_menu" },
    { "id": "wait_menu", "type": "wait_reply", "save_as": "menu", "next": "branch_menu" },
    { "id": "branch_menu", "type": "condition",
      "branches": [
        { "if": "menu == '1'", "next": "send_katalog" },
        { "if": "menu == '2'", "next": "send_promo" }
      ], "else": "fallback" },
    { "id": "send_katalog", "type": "send_text", "text": "Ini katalog kami: ...", "next": "handoff" },
    { "id": "handoff", "type": "handoff", "to": "agent" }
  ]
}
```

### Tipe node (v1)
| type | Fungsi |
|---|---|
| `trigger` | Titik masuk (keyword/welcome/fallback) |
| `send_text` | Kirim teks (boleh variabel `{{...}}`) |
| `send_media` | Kirim gambar/file |
| `wait_reply` | Tunggu balasan, simpan ke `context` |
| `condition` | Cabang berdasar ekspresi atas `context` |
| `set_var` | Set variabel |
| `call_tool` | Panggil tool (cek ongkir, dll — lihat bawah) |
| `ai_agent` | Serahkan ke AI agent untuk node ini |
| `handoff` | Alihkan ke agen (set handler=agent) |

Eksekutor flow: state machine murni, deterministik, simpan posisi di `conversation_states` (`05`).

## B. AI Agent (gaya Halo AI)

Untuk pertanyaan bebas / sales conversational. Beda dari chatbot menu: paham konteks, adaptif, bisa eksekusi aksi.

### Komponen
1. **System prompt per tenant** — persona, SOP, gaya bahasa (formal/santai), batasan.
2. **RAG / Knowledge base** — retrieve dari `knowledge_chunks` (pgvector) berdasar pertanyaan. Sumber: file (PDF/DOC), URL website, FAQ, data produk.
3. **Tools** (function calling) — aksi nyata:
   - `cek_ongkir(tujuan, berat)`
   - `buat_invoice(items, contact)`
   - `cek_pembayaran(invoice_id)`
   - `cek_stok(produk)`
   - `buat_appointment(slot)`
   - `eskalasi_ke_agen(alasan)` — selalu tersedia.
   Tool dipanggil via API tenant (webhook/integrasi) — definisi tool di config tenant.
4. **Guardrails / self-check** — sebelum kirim, validasi: tidak janji harga di luar data, tidak halusinasi stok, patuhi SOP. Kalau ragu → eskalasi, bukan ngarang.
5. **Memory percakapan** — N pesan terakhir dari `messages` jadi konteks (eager-loaded, jangan N+1).

### Alur eksekusi AI agent
```
input pesan
  → retrieve KB (top-k pgvector, filter tenant_id)
  → susun prompt: system + KB + riwayat + pesan
  → LLM (boleh function calling)
      ├─ minta tool? → eksekusi tool → feed hasil → ulang
      └─ jawaban final → guardrail check → kirim
  → kalau low-confidence / minta hal di luar kemampuan → eskalasi_ke_agen
```

> KEPUTUSAN: AI agent **stateless per panggilan**; semua konteks dibangun ulang dari DB tiap pesan (LLM tak punya memori antar request). Riwayat diambil via 1 query eager-loaded.

### Knowledge base ingestion
- Upload file / submit URL → `knowledge_documents` (status processing).
- Worker: ekstrak teks → chunk → embed → simpan `knowledge_chunks.embedding`.
- Status → ready. Tampilkan progress (goey-toast `.promise` saat upload, badge status di list).

### Indexing untuk RAG
- Retrieval: `ORDER BY embedding <=> :query_vec LIMIT k` dengan filter `tenant_id` lebih dulu (lihat index `idx_kchunk_tenant` + `ivfflat` di `02`).
- Selalu filter tenant **sebelum** vector search (jangan bocor lintas tenant).

## Config tenant (siapa atur apa)

- `admin` (`flow.manage`, `knowledge.manage`): bikin flow, atur persona AI, kelola KB, daftar tool.
- Mode balasan (flow/AI/hybrid) per channel.
- Jam kerja & pesan out-of-office (`05`).

> TODO PRODUK: provider LLM (mis. model lokal vs API). Abstraksi `LLMProvider` supaya bisa ganti. Pertimbangkan biaya per percakapan ke harga paket tenant.
