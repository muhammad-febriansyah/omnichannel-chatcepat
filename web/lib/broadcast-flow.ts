// Shared pieces of the flow trigger "Broadcast terjadwal" (client + server, no React).

import type { PreviewButton } from "@/components/app/wa-template-preview";
import type { TemplateParam, TemplateParamSource } from "./flow-graph";

// Approved WA template offered in the "Pesan Broadcast" step. channelId = the WABA
// channel that owns it (a template only works on that account).
export type BroadcastTemplateOpt = {
  name: string;
  body: string;
  language: string;
  channelId: string;
  variableCount: number;
  headerFormat: string;
  headerText: string;
  footer: string;
  buttons: PreviewButton[];
};

export const PARAM_SOURCE_LABEL: Record<TemplateParamSource, string> = {
  contact_name: "Nama kontak",
  contact_phone: "Nomor kontak",
  static: "Teks tetap",
};

export const BROADCAST_CHANNEL_TYPES = ["wa_official", "wa_unofficial"];

// <input type="datetime-local"> works in the browser's zone; schedules are WIB.
// "2026-11-08T09:00" (WIB) → ISO UTC.
export function wibInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO UTC → "2026-11-08T09:00" in WIB.
export function isoToWibInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}

export function formatWib(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "jadwal tidak valid";
  return `${d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
}

// Template body with {{n}} shown the way a recipient would roughly see it.
export function previewTemplateBody(body: string, params: TemplateParam[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => {
    const p = params[Number(n) - 1];
    if (!p) return m;
    if (p.source === "contact_name") return "[Nama kontak]";
    if (p.source === "contact_phone") return "[Nomor kontak]";
    return p.value || m;
  });
}
