import { cookies } from "next/headers";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { REF_COOKIE, normalizeCode } from "@/lib/referral";
import RegisterForm from "./register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [ws, { ref }, store] = await Promise.all([getPublicWebSettings(), searchParams, cookies()]);
  // Link ?ref= wins; otherwise the code remembered from an earlier visit.
  const referralCode = normalizeCode(ref) || normalizeCode(store.get(REF_COOKIE)?.value);
  return <RegisterForm logoUrl={ws.logoUrl} siteName={ws.siteName} referralCode={referralCode} />;
}
