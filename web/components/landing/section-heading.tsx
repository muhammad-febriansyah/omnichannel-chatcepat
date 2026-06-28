import { Sparkles } from "lucide-react";
import { Reveal } from "./reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-brand-blue shadow-sm">
          <Sparkles className="size-3.5" /> {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.1]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
      )}
    </Reveal>
  );
}
