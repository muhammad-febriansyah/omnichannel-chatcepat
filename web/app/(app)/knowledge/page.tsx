import { redirect } from "next/navigation";

// The knowledge base lives in Automation → Pengetahuan.
export default function KnowledgePage() {
  redirect("/flows?tab=pengetahuan");
}
