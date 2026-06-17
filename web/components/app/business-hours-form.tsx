"use client";

import { useState, useTransition } from "react";
import { Save, Clock } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DAYS, type BusinessHours, type DayKey } from "@/lib/business-hours";
import { saveBusinessHours } from "@/lib/actions";

export function BusinessHoursForm({ initial }: { initial: BusinessHours }) {
  const [bh, setBh] = useState<BusinessHours>(initial);
  const [pending, start] = useTransition();

  function setDay(key: DayKey, patch: Partial<BusinessHours["days"][DayKey]>) {
    setBh((s) => ({ ...s, days: { ...s.days, [key]: { ...s.days[key], ...patch } } }));
  }

  function submit() {
    start(async () => {
      try {
        await saveBusinessHours(bh);
        gooeyToast.success("Jam kerja tersimpan");
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Gagal menyimpan jam kerja");
      }
    });
  }

  const timeCls =
    "h-10 rounded-lg border border-border bg-background px-2.5 text-sm tabular-nums outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="w-full p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="size-5 text-brand-blue" /> Jam Kerja
          </CardTitle>
          <CardDescription>
            Atur jam operasional (WIB). Di luar jam, chat masuk ditandai luar-jam dan dibalas pesan out-of-office.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="divide-y divide-slate-100 rounded-xl border border-border">
            {DAYS.map(({ key, label }) => {
              const d = bh.days[key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <label className="flex w-32 cursor-pointer select-none items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => setDay(key, { enabled: e.target.checked })}
                      className="peer absolute size-0 opacity-0"
                    />
                    <span className="grid size-[18px] shrink-0 place-items-center rounded-md border-[1.5px] border-muted-foreground/40 bg-card transition-colors peer-checked:border-brand-blue peer-checked:bg-brand-blue">
                      <svg className="size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </label>

                  {d.enabled ? (
                    <div className="flex items-center gap-2">
                      <input type="time" value={d.open} onChange={(e) => setDay(key, { open: e.target.value })} className={timeCls} />
                      <span className="text-sm text-muted-foreground">s/d</span>
                      <input type="time" value={d.close} onChange={(e) => setDay(key, { close: e.target.value })} className={timeCls} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Tutup</span>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label htmlFor="ooo" className="mb-1.5 block text-sm font-medium text-foreground">
              Pesan di luar jam operasional
            </label>
            <textarea
              id="ooo"
              rows={3}
              value={bh.outOfOffice}
              onChange={(e) => setBh((s) => ({ ...s, outOfOffice: e.target.value }))}
              placeholder="Pesan otomatis saat di luar jam kerja…"
              className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Dikirim sekali saat kontak menghubungi di luar jam.</p>
          </div>
        </CardContent>

        <CardFooter className="justify-end border-t border-border">
          <button
            onClick={submit}
            disabled={pending}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Jam Kerja"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
