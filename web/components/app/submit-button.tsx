"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Form submit button that shows a spinner while its server action runs.
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
