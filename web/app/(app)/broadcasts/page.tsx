import { redirect } from "next/navigation";

// Broadcast now lives in Automation (flow trigger "Broadcast terjadwal").
export default function BroadcastsPage() {
  redirect("/flows?tab=broadcast");
}
