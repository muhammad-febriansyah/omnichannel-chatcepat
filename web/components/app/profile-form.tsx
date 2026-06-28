"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, User, Mail, KeyRound, Camera, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/actions";
import { initials, roleLabel } from "@/lib/format";

const schema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(120, "Nama maksimal 120 karakter"),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.password.length > 0 && v.password.length < 6) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password minimal 6 karakter" });
    }
  });

type FormValues = { name: string; password: string };

export interface ProfileInitial {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10 disabled:cursor-not-allowed disabled:opacity-60";

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [pending, start] = useTransition();
  const [avatar, setAvatar] = useState<string | null>(initial.avatarUrl);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial.name, password: "" },
  });

  const nameVal = watch("name") || initial.name;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file sama lagi
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah");
      setAvatar(data.url as string);
      gooeyToast.success("Foto terunggah — klik Simpan untuk menerapkan");
    } catch (err) {
      gooeyToast.error(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(v: FormValues) {
    start(async () => {
      try {
        await updateProfile({ name: v.name, avatarUrl: avatar, password: v.password || undefined });
        gooeyToast.success("Profil tersimpan");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan profil";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} className="hidden" />

      {/* Kartu foto */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Foto Profil</CardTitle>
          <CardDescription>PNG, JPG, WebP, atau GIF. Maks 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-6">
          <div className="relative size-28">
            <div className="size-28 overflow-hidden rounded-full shadow-lg ring-4 ring-card">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- aset upload user
                <img src={avatar} alt={nameVal} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center bg-gradient-to-br from-brand-navy to-brand-blue text-2xl font-bold tracking-wide text-white">
                  {initials(nameVal)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-2 border-card bg-brand-blue text-white shadow transition hover:bg-brand-blue/90 disabled:opacity-60"
              aria-label="Ganti foto profil"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
          </div>

          <div className="text-center">
            <p className="max-w-[200px] truncate text-sm font-semibold text-foreground">{nameVal}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-navy">
              <ShieldCheck className="size-3" /> {roleLabel(initial.role)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition hover:bg-card disabled:opacity-60"
            >
              <Camera className="size-4" /> {avatar ? "Ganti" : "Unggah"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-60"
              >
                <Trash2 className="size-4" /> Hapus
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kartu identitas */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Informasi Akun</CardTitle>
          <CardDescription>Ubah nama tampilan atau ganti password kamu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input id="name" {...register("name")} placeholder="Nama kamu" className={inputCls} />
              </div>
              {errors.name && <p className="mt-1.5 text-xs font-medium text-danger">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input id="email" value={initial.email} disabled type="email" className={inputCls} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Email tidak bisa diubah.</p>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ganti Password</h3>
            <div className="sm:max-w-sm">
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password baru</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input id="password" {...register("password")} type="password" placeholder="••••••••" className={inputCls} />
              </div>
              {errors.password && <p className="mt-1.5 text-xs font-medium text-danger">{errors.password.message}</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">Kosongkan jika tidak ingin mengganti password.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border">
          <Button type="submit" size="lg" disabled={pending || busy} className="px-5">
            <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
