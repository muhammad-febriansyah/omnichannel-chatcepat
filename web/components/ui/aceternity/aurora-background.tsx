"use client";

import { cn } from "@/lib/utils";

// Aceternity-style Aurora Background — animated conic/gradient glow behind hero.
// Pure CSS keyframe driven (defined inline) so it respects prefers-reduced-motion.
export function AuroraBackground({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-background",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 motion-safe:animate-[aurora_18s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 20%, rgba(59,130,246,0.22), transparent 60%), radial-gradient(55% 55% at 80% 30%, rgba(96,165,250,0.20), transparent 60%), radial-gradient(60% 60% at 50% 90%, rgba(30,42,120,0.20), transparent 60%)",
          backgroundSize: "200% 200%",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0,var(--background)_85%)]"
      />
      {/* keyframes injected once via global style */}
      <style>{`@keyframes aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`}</style>
      {children}
    </div>
  );
}
