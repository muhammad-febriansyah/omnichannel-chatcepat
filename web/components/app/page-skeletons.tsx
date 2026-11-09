import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading placeholders (shadcn Skeleton) shown by route loading.tsx files while a
// server page fetches its data. Shapes mirror the real layouts so nothing jumps.

function HeaderSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div className="mb-6 space-y-3">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
      {tabs && (
        <div className="flex gap-2 pt-2">
          {[88, 96, 80].map((w) => (
            <Skeleton key={w} className="h-9 rounded-xl" style={{ width: w }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StatGroupSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid overflow-hidden rounded-[20px] bg-card sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("space-y-3 p-5", i > 0 && "border-t border-border sm:border-l sm:border-t-0")}>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-[20px] bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex gap-4 bg-muted/40 px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-t border-border px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-10")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-[20px] bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="max-w-3xl space-y-5 rounded-[20px] bg-card p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((j) => (
            <div key={j} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ))}
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

export function PageSkeleton({ variant = "table" }: { variant?: "table" | "cards" | "form" | "stats" }) {
  return (
    <div className="p-6" aria-busy="true" aria-label="Memuat halaman">
      <HeaderSkeleton tabs={variant === "cards"} />
      {variant === "stats" && (
        <div className="space-y-5">
          <StatGroupSkeleton />
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
          <TableSkeleton rows={4} />
        </div>
      )}
      {variant === "table" && <TableSkeleton />}
      {variant === "cards" && <CardGridSkeleton />}
      {variant === "form" && <FormSkeleton />}
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex h-full min-h-[560px]" aria-busy="true" aria-label="Memuat inbox">
      <div className="w-80 shrink-0 space-y-1 border-r border-border bg-card p-3">
        <Skeleton className="mb-3 h-9 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-6">
          {[60, 40, 70, 35, 55].map((w, i) => (
            <Skeleton key={i} className={cn("h-12 rounded-2xl", i % 2 ? "ml-auto" : "")} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="border-t border-border bg-card p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CanvasSkeleton() {
  return (
    <div className="flex h-full min-h-[560px] flex-col" aria-busy="true" aria-label="Memuat flow">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="ml-auto h-9 w-24 rounded-lg" />
      </div>
      <div className="flex flex-1">
        <div className="w-64 space-y-3 border-r border-border bg-card p-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-muted/30">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-64 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatPaneSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Memuat percakapan">
      <div className="flex items-center gap-3 border-b border-border bg-card p-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex-1 space-y-4 p-6">
        {[60, 40, 70, 35, 55].map((w, i) => (
          <Skeleton key={i} className={cn("h-12 rounded-2xl", i % 2 ? "ml-auto" : "")} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="border-t border-border bg-card p-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
