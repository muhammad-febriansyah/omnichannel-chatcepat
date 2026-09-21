import { SocialAutomationPanel } from "@/components/app/social-automation-panel";
import { getAutomationPageData } from "@/lib/social-automation-actions";

export default async function AutomationPage() {
  const data = await getAutomationPageData();
  return <div className="p-5 lg:p-7"><SocialAutomationPanel {...data} /></div>;
}
