import { ContactForm } from "@/components/app/contact-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewContactPage() {
  await requirePageAbility("contact.manage");
  return <ContactForm mode="create" />;
}
