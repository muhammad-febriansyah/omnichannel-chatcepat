"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { resetPassword } from "@/lib/actions";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    start(async () => {
      try {
        await resetPassword(token, password);
        setDone(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Reset password gagal");
      }
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" /> Kembali ke login</Link>
        <div className="mt-8"><h1 className="text-2xl font-bold tracking-tight">Buat password baru</h1><p className="mt-2 text-sm leading-6 text-slate-500">Gunakan password minimal 6 karakter.</p></div>
        {done ? <div className="mt-7 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"><p>Password berhasil diubah.</p><Link href="/login" className="mt-2 inline-block font-semibold underline">Kembali ke login</Link></div> : <form onSubmit={submit} className="mt-7 space-y-5"><div><label className="mb-2 block text-sm font-medium" htmlFor="new-password">Password baru</label><div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" /><input id="new-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-[#2547F9] focus:ring-4 focus:ring-[#2547F9]/10" /></div></div><div><label className="mb-2 block text-sm font-medium" htmlFor="confirm-password">Konfirmasi password</label><input id="confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#2547F9] focus:ring-4 focus:ring-[#2547F9]/10" /></div>{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<button type="submit" disabled={pending || !token} className="h-11 w-full rounded-lg bg-[#2547F9] text-sm font-semibold text-white transition hover:bg-[#1d39cc] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Menyimpan…" : "Simpan password baru"}</button>{!token && <p className="text-sm text-rose-700">Token reset tidak ditemukan. Minta link reset baru.</p>}</form>}
      </section>
    </main>
  );
}
