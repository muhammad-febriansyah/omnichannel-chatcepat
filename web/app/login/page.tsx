import { getActiveWebSettings } from "@/lib/web-settings-server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const ws = await getActiveWebSettings();
  return <LoginForm logoUrl={ws.logoUrl} siteName={ws.siteName} />;
}
