import type { ElementType } from "react";

// Uniform page header: title + description + actions (right) + optional tabs row.
// Used on every list/detail page so hierarchy and spacing stay consistent.
export function PageHeader({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode; // e.g. pill tabs under the title
  icon?: ElementType; // deprecated: title icon is no longer rendered
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px] sm:leading-9">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-4">{tabs}</div>}
    </div>
  );
}
