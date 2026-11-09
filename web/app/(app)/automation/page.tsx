import { redirect } from "next/navigation";
import { SocialAutomationPanel } from "@/components/app/social-automation-panel";
import { getAutomationPageData } from "@/lib/social-automation-actions";
import { requirePageAbility } from "@/lib/session";

export default async function AutomationPage() {
  const session = await requirePageAbility("flow.manage");
  // Hidden from clients (menu hideForClient); only the platform admin opens it.
  if (session.role !== "admin") redirect("/flows");
  const data = await getAutomationPageData();
  return <div className="p-5 lg:p-7"><SocialAutomationPanel {...data} /></div>;
}
