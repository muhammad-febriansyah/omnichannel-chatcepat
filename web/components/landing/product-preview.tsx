import { Inbox, Megaphone, Users, Workflow, BarChart3, Bot, Search, Check } from "lucide-react";
import { ChannelLogo, type ChannelKey } from "@/components/app/charts";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

const NAV = [
  { icon: <Inbox className="size-4" />, label: "Inbox", active: true },
  { icon: <Megaphone className="size-4" />, label: "Broadcast" },
  { icon: <Workflow className="size-4" />, label: "Flow" },
  { icon: <Users className="size-4" />, label: "Kontak" },
  { icon: <BarChart3 className="size-4" />, label: "Laporan" },
];

const THREADS: { name: string; ch: ChannelKey; msg: string; time: string; unread?: number; active?: boolean }[] = [
  { name: "Budi Santoso", ch: "whatsapp", msg: "Iya kak, langsung order 2 ya", time: "kini", unread: 2, active: true },
  { name: "Sari Wijaya", ch: "instagram", msg: "Ada warna lain ga kak?", time: "2m" },
  { name: "Andi Pratama", ch: "telegram", msg: "Ongkir ke Bandung berapa?", time: "8m", unread: 1 },
  { name: "Maya Kusuma", ch: "messenger", msg: "Makasih, fast respon 🙏", time: "15m" },
];

export function ProductPreview() {
  return (
    <section className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Produk"
          title="Satu layar untuk semua percakapan"
          description="Inbox terpadu dengan AI Agent, label, dan handover ke agen — dirancang agar tim bergerak cepat tanpa berpindah aplikasi."
        />

        <Reveal className="mt-14">
          <div className="relative">
            {/* glow belakang */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-blue/15 via-violet-400/10 to-emerald-400/15 blur-2xl"
            />

            {/* anotasi mengambang — sorot kapabilitas inti */}
            <div className="absolute -left-6 bottom-16 z-20 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl lg:flex">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Bot className="size-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold text-foreground">AI balas otomatis</span>
                <span className="block text-[11px] text-muted-foreground">rata-rata &lt; 3 detik</span>
              </span>
            </div>
            <div className="absolute -right-5 bottom-16 z-20 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl lg:flex">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-blue/15 text-brand-blue">
                <Users className="size-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold text-foreground">Handover ke agen</span>
                <span className="block text-[11px] text-muted-foreground">mulus saat dibutuhkan</span>
              </span>
            </div>

            {/* browser frame */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
              {/* top bar */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <span className="size-3 rounded-full bg-red-400/80" />
                <span className="size-3 rounded-full bg-amber-400/80" />
                <span className="size-3 rounded-full bg-emerald-400/80" />
                <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  app.chatcepat.id/inbox
                </span>
              </div>

              {/* app shell */}
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_1.2fr]">
                {/* sidebar */}
                <aside className="hidden flex-col gap-1 border-r border-border bg-card p-3 sm:flex">
                  {NAV.map((n) => (
                    <span
                      key={n.label}
                      className={`inline-flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${
                        n.active ? "bg-brand-blue/10 text-brand-blue dark:text-brand-light" : "text-muted-foreground"
                      }`}
                    >
                      {n.icon} {n.label}
                    </span>
                  ))}
                </aside>

                {/* thread list */}
                <div className="border-r border-border">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                    <span className="inline-flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                      <Search className="size-3.5" /> Cari percakapan…
                    </span>
                  </div>
                  <ul>
                    {THREADS.map((t) => (
                      <li
                        key={t.name}
                        className={`flex items-center gap-3 border-b border-border px-3 py-3 ${t.active ? "bg-brand-blue/5" : ""}`}
                      >
                        <span className="relative">
                          <span className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-bold text-white">
                            {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                          </span>
                          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
                            <ChannelLogo ch={t.ch} size={13} />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between">
                            <span className="truncate text-sm font-semibold text-foreground">{t.name}</span>
                            <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-muted-foreground">{t.msg}</span>
                            {t.unread ? (
                              <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white">
                                {t.unread}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* chat panel */}
                <div className="hidden flex-col bg-background/40 sm:flex">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[10px] font-bold text-white">
                        BS
                      </span>
                      Budi Santoso
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> AI aktif
                    </span>
                  </div>
                  <div className="flex-1 space-y-3 p-4">
                    <span className="block max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm">
                      Masih ready stok navy? 🙏
                    </span>
                    <span className="ml-auto block max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-brand-blue to-brand-light px-3 py-2 text-sm text-white shadow-md">
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                        <Bot className="size-3" /> AI Agent
                      </span>
                      Ready 12 pcs Kak! Kirim ke alamat sama? 😊
                    </span>
                    <span className="block max-w-[70%] rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm">
                      Iya kak, order 2 ya
                    </span>
                  </div>
                  <div className="border-t border-border p-3">
                    <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                      Tulis balasan… <span className="ml-auto inline-flex items-center gap-1 text-brand-blue"><Check className="size-3.5" /> Saran AI</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
