"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Aceternity-style BentoGrid + BentoGridItem.
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  icon,
  index = 0,
}: {
  className?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3), ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand-blue/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative">
        {icon && (
          <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue transition-transform duration-300 group-hover:scale-110 dark:bg-brand-blue/15 dark:text-brand-light">
            {icon}
          </div>
        )}
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}
