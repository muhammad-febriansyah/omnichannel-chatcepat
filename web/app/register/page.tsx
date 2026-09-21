import { getPublicWebSettings } from "@/lib/web-settings-server";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const ws = await getPublicWebSettings();
  return <RegisterForm logoUrl={ws.logoUrl} siteName={ws.siteName} />;
}
