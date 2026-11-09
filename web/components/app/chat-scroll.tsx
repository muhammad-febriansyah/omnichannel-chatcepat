"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Scroll area for a chat thread: starts at the newest message, follows new messages
// while the agent is at the bottom, and shows a "to latest" button otherwise.
export function ChatScroll({ count, className, children }: { count: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const toBottom = (smooth: boolean) => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // First paint: jump to the end without animation.
  useEffect(() => toBottom(false), []);

  // New messages: follow only if the agent was already at the bottom.
  useEffect(() => {
    if (atBottom.current) toBottom(true);
  }, [count]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          atBottom.current = near;
          setShowJump(!near);
        }}
        className={cn("h-full overflow-y-auto overscroll-contain", className)}
      >
        {children}
      </div>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label="Ke pesan terbaru"
        onClick={() => toBottom(true)}
        className={cn(
          "absolute bottom-4 right-5 size-9 rounded-full bg-white text-[#54656f] shadow-md transition-all hover:bg-white dark:bg-[#202c33] dark:text-[#aebac1]",
          showJump ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}
