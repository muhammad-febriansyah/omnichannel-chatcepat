"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionLink } from "@/components/app/action-link";
import { ChannelIcon } from "@/components/app/channel-icon";
import { CHANNEL_META, type ChannelType } from "@/lib/format";
import { renameChannel } from "@/lib/actions";

export function RenameChannelForm({ id, name: initial, type }: { id: string; name: string; type: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const meta = CHANNEL_META[type as ChannelType];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama channel wajib diisi");
    start(async () => {
      try {
        await renameChannel(id, name);
        gooeyToast.success("Nama channel disimpan");
        router.push("/channels");
      } catch (err) {
        gooeyToast.error(errorMessage(err) ?? "Gagal menyimpan nama");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg p-4 sm:p-6">
      <ActionLink href="/channels" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft className="size-4" /> Kembali
      </ActionLink>
      <form onSubmit={submit} className="space-y-4 rounded-[20px] border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: meta?.color ?? "#94a3b8" }}>
            <ChannelIcon type={type as ChannelType} className="size-5 text-white" />
          </span>
          <div>
            <h1 className="text-base font-semibold">Ubah nama channel</h1>
            <p className="text-xs text-muted-foreground">{meta?.label ?? type} · nama hanya tampil di dashboard dan Inbox</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Nama</span>
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus className="h-10" />
        </label>
        <div className="flex justify-end gap-2">
          <ActionLink href="/channels" variant="outline">
            Batal
          </ActionLink>
          <Button type="submit" disabled={pending || !name.trim() || name.trim() === initial}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </form>
    </div>
  );
}
