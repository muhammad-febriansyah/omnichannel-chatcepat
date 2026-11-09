"use client";

import { useState, useTransition } from "react";
import { errorMessage } from "@/lib/action-error";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Switch } from "@/components/ui/switch";
import { setFlowActive } from "@/lib/actions";

// Flow card switch: on = flow answers messages, off = kept as draft.
export function FlowActiveToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setOn(next);
    start(async () => {
      try {
        await setFlowActive(id, next);
        gooeyToast.success(next ? `Flow "${name}" aktif` : `Flow "${name}" dinonaktifkan`);
      } catch (e) {
        setOn(!next);
        gooeyToast.error(errorMessage(e) ?? "Gagal mengubah status flow");
      }
    });
  }

  return (
    <Switch
      checked={on}
      onCheckedChange={change}
      disabled={pending}
      aria-label={on ? `Nonaktifkan flow ${name}` : `Aktifkan flow ${name}`}
      title={on ? "Nonaktifkan flow" : "Aktifkan flow"}
    />
  );
}
