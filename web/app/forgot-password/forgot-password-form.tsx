"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetLink("");
    start(async () => {
      try {
        const result = await requestPasswordReset(email);
        setMessage("Jika email terdaftar, link reset password dikirim ke email tersebut.");
        if (result.resetToken) setResetLink(`/reset-password?token=${encodeURIComponent(result.resetToken)}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Permintaan reset password gagal");
      }
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Kembali ke login
        </Link>
        <div className="mt-8">
          <h1 className="text-2xl font-bold tracking-tight">Lupa password?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Masukkan email akun kamu untuk membuat link reset password.</p>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium" htmlFor="reset-email">Email</label>
          <div className="relative -mt-3">
            <Mail className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
            <input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#2547F9] focus:ring-4 focus:ring-[#2547F9]/10" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {resetLink && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><p className="font-medium">Development reset link</p><Link href={resetLink} className="mt-1 block break-all text-xs underline">Buka reset password</Link></div>}
          <button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-[#2547F9] text-sm font-semibold text-white transition hover:bg-[#1d39cc] disabled:cursor-progress disabled:opacity-60">{pending ? "Membuat link…" : "Kirim link reset"}</button>
        </form>
      </section>
    </main>
  );
}
