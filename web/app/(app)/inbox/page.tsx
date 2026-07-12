import { Inbox } from "lucide-react";

export default function InboxEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue dark:bg-blue-500/10">
        <Inbox className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Pilih percakapan</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Pilih percakapan di sebelah kiri untuk mulai membalas.
      </p>
    </div>
  );
}
