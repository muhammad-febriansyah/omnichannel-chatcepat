"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Konfirmasi hapus via AlertDialog (shadcn/base-ui). onConfirm = server action
// (sudah ter-bind id). Action hanya revalidatePath — refresh list di tempat.
export function DeleteButton({
  onConfirm,
  title,
  description,
  successMessage = "Berhasil dihapus",
  triggerLabel = "Hapus",
}: {
  onConfirm: () => Promise<unknown>;
  title: string;
  description: React.ReactNode;
  successMessage?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      try {
        await onConfirm();
        gooeyToast.success(successMessage);
        setOpen(false);
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Gagal menghapus");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={triggerLabel}
        title={triggerLabel}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-danger"
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-red-50 text-danger">
            <AlertTriangle className="size-5" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-danger px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {pending ? "Menghapus…" : "Ya, hapus"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
