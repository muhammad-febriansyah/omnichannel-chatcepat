"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MovingCard {
  quote: string;
  name: string;
  title: string;
}

// Aceternity-style InfiniteMovingCards — duplicates items and scrolls via CSS animation.
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "slow",
  className,
}: {
  items: MovingCard[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const container = containerRef.current;
    if (!scroller || !container) return;

    // Duplicate children once so the loop is seamless.
    Array.from(scroller.children).forEach((child) => {
      scroller.appendChild(child.cloneNode(true));
    });

    const dur = speed === "fast" ? "26s" : speed === "normal" ? "44s" : "70s";
    container.style.setProperty("--animation-direction", direction === "left" ? "forwards" : "reverse");
    container.style.setProperty("--animation-duration", dur);
    setStart(true);
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-2",
          start && "motion-safe:animate-[marquee_var(--animation-duration)_linear_infinite] motion-safe:[animation-direction:var(--animation-direction)]",
        )}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            className="relative w-[320px] max-w-full shrink-0 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm sm:w-[400px]"
          >
            <blockquote>
              <p className="text-sm leading-relaxed text-foreground">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-4 flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-semibold text-brand-blue dark:text-brand-light">
                  {item.name.charAt(0)}
                </span>
                <span className="flex flex-col">
                  <cite className="text-sm font-semibold not-italic text-foreground">{item.name}</cite>
                  <span className="text-xs text-muted-foreground">{item.title}</span>
                </span>
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
      <style>{`@keyframes marquee{to{transform:translateX(calc(-50% - 0.5rem))}}`}</style>
    </div>
  );
}
