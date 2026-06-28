import { Pencil, Eye } from "lucide-react";
import { ActionLink } from "./action-link";

// Tombol aksi baris standar: ikon + teks, warna konsisten.
// edit=hijau (success), detail=oranye (warning), hapus=merah (DeleteButton).

export function EditButton({ href, label = "Edit" }: { href: string; label?: string }) {
  return (
    <ActionLink href={href} variant="success" size="sm" aria-label={label}>
      <Pencil className="size-3.5" /> {label}
    </ActionLink>
  );
}

export function DetailButton({ href, label = "Detail" }: { href: string; label?: string }) {
  return (
    <ActionLink href={href} variant="warning" size="sm" aria-label={label}>
      <Eye className="size-3.5" /> {label}
    </ActionLink>
  );
}
