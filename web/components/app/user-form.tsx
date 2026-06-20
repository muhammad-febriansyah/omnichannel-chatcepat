"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, ArrowLeft, User, Mail, KeyRound, Activity } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ActionLink } from "@/components/app/action-link";
import { Button } from "@/components/ui/button";
import { createUser, updateUser } from "@/lib/actions";

function makeSchema(isEdit: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, "Nama wajib diisi").max(120, "Nama maksimal 120 karakter"),
      email: z.string().trim().email("Email tidak valid"),
      status: z.enum(["active", "invited", "disabled"]),
      password: z.string(),
    })
    .superRefine((v, ctx) => {
      if (!isEdit && v.password.length < 6) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Password minimal 6 karakter" });
      }
      if (isEdit && v.password.length > 0 && v.password.length < 6) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Password minimal 6 karakter" });
      }
    });
}

type FormValues = {
  name: string;
  email: string;
  status: "active" | "invited" | "disabled";
  password: string;
};

export interface UserInitial {
  name: string;
  email: string;
  status: "active" | "invited" | "disabled";
}

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10 disabled:cursor-not-allowed disabled:opacity-60";

export function UserForm({
  mode,
  userId,
  initial,
}: {
  mode: "create" | "edit";
  userId?: string;
  initial?: UserInitial;
}) {
  const [pending, start] = useTransition();
  const isEdit = mode === "edit";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(isEdit)),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      status: initial?.status ?? "active",
      password: "",
    },
  });

  function onSubmit(v: FormValues) {
    start(async () => {
      try {
        if (isEdit && userId) {
          await updateUser(userId, { name: v.name, status: v.status, password: v.password || undefined });
        } else {
          await createUser({ name: v.name, email: v.email, password: v.password });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan user";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="w-full p-6">
      <Link
        href="/settings/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Tim
      </Link>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isEdit ? "Edit Anggota Tim" : "Undang Anggota Tim"}</CardTitle>
            <CardDescription>
              {isEdit ? "Ubah status atau reset password anggota." : "Buat akun untuk anggota tim baru."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identitas</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="name" {...register("name")} placeholder="Budi Santoso" className={inputCls} />
                  </div>
                  {errors.name && <p className="mt-1.5 text-xs font-medium text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="email" {...register("email")} disabled={isEdit} type="email" placeholder="budi@bisnis.com" className={inputCls} />
                  </div>
                  {errors.email && <p className="mt-1.5 text-xs font-medium text-danger">{errors.email.message}</p>}
                  {isEdit && <p className="mt-1.5 text-xs text-muted-foreground">Email tidak bisa diubah.</p>}
                </div>
              </div>
            </div>

            {isEdit && (
              <div className="border-t border-border pt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Akses</h3>
                <div className="sm:max-w-sm">
                  <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-foreground">Status</label>
                  <div className="relative">
                    <Activity className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select id="status" {...register("status")} className={`${inputCls} pr-8`}>
                      <option value="active">Aktif</option>
                      <option value="invited">Diundang</option>
                      <option value="disabled">Nonaktif</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isEdit ? "Reset Password" : "Password"}
              </h3>
              <div className="sm:max-w-sm">
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                  {isEdit ? "Password baru" : "Password awal"}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="password" {...register("password")} type="password" placeholder="••••••••" className={inputCls} />
                </div>
                {errors.password && <p className="mt-1.5 text-xs font-medium text-danger">{errors.password.message}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {isEdit ? "Kosongkan jika tidak ingin mengganti password." : "Minimal 6 karakter. Beritahu anggota untuk login."}
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <ActionLink href="/settings/users" variant="outline" className="px-5">
              Batal
            </ActionLink>
            <Button type="submit" size="lg" disabled={pending} className="px-5">
              <Save className="size-4" /> {pending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Buat Akun"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
