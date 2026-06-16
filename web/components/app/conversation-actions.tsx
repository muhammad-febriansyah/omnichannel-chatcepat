"use client";

import { useTransition } from "react";
import { Hand, Bot, CheckCircle2, RotateCcw, UserPlus, ChevronDown } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  resolveConversation,
  reopenConversation,
  returnToBot,
  takeoverConversation,
  assignConversation,
} from "@/lib/actions";

export interface ConversationActionsProps {
  conversationId: string;
  status: string;
  handler: string;
  canAssign: boolean;
  agents: { id: string; name: string }[];
}

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-50";

export function ConversationActions({ conversationId, status, handler, canAssign, agents }: ConversationActionsProps) {
  const [pending, start] = useTransition();
  const resolved = status === "resolved";

  function run(fn: () => Promise<void>, okMsg: string) {
    start(async () => {
      try {
        await fn();
        gooeyToast.success(okMsg);
      } catch (err) {
        gooeyToast.error(err instanceof Error ? err.message : "Aksi gagal");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {handler === "bot" ? (
        <button
          disabled={pending}
          onClick={() => run(() => takeoverConversation(conversationId), "Percakapan diambil alih")}
          className={`${btn} border-brand-blue/40 bg-blue-50 text-brand-blue hover:bg-blue-100`}
        >
          <Hand className="size-4" /> Ambil alih
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => run(() => returnToBot(conversationId), "Dikembalikan ke AI agent")}
          className={`${btn} border-border bg-card text-foreground hover:bg-slate-50`}
        >
          <Bot className="size-4" /> Kembalikan ke bot
        </button>
      )}

      {canAssign && agents.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={`${btn} border-border bg-card text-foreground outline-none hover:bg-slate-50`}>
            <UserPlus className="size-4" /> Assign <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
            {agents.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onClick={() => run(() => assignConversation(conversationId, a.id), `Ditugaskan ke ${a.name}`)}
              >
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {resolved ? (
        <button
          disabled={pending}
          onClick={() => run(() => reopenConversation(conversationId), "Percakapan dibuka kembali")}
          className={`${btn} border-border bg-card text-foreground hover:bg-slate-50`}
        >
          <RotateCcw className="size-4" /> Buka lagi
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => run(() => resolveConversation(conversationId), "Percakapan diselesaikan")}
          className={`${btn} border-success/40 bg-emerald-50 text-success hover:bg-emerald-100`}
        >
          <CheckCircle2 className="size-4" /> Selesaikan
        </button>
      )}
    </div>
  );
}
