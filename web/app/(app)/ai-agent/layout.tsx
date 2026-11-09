import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

// Hidden from clients (menu hideForClient): AI is set up in the flow's AI Agent step.
export default async function AgentsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/flows");
  return children;
}
