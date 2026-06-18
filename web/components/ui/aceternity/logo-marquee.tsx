"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MarqueeLogo {
  name: string;
  icon: React.ReactNode;
}

// Aceternity-style logo wall — duplicates items and scrolls seamlessly via CSS animation.
// Grayscale di default, warna saat hover; loop berhenti saat hover & hormati reduced-motion.
export function LogoMarquee({
  items,
  direction = "left",
  speed = "normal",
  className,
}: {
  items: MarqueeLogo[];
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

    // Duplikat anak sekali supaya loop mulus.
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
        "group scroller relative z-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap items-center gap-12 py-2",
          start &&
            "motion-safe:animate-[marquee_var(--animation-duration)_linear_infinite] motion-safe:[animation-direction:var(--animation-direction)] motion-safe:group-hover:[animation-play-state:paused]",
        )}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            className="inline-flex shrink-0 items-center gap-2.5 text-muted-foreground opacity-70 grayscale transition duration-300 hover:text-foreground hover:opacity-100 hover:grayscale-0"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              {item.icon}
            </span>
            <span className="whitespace-nowrap text-base font-semibold tracking-tight">{item.name}</span>
          </li>
        ))}
      </ul>
      <style>{`@keyframes marquee{to{transform:translateX(calc(-50% - 1.5rem))}}`}</style>
    </div>
  );
}
