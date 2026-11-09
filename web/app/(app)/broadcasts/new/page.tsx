import { redirect } from "next/navigation";

// New broadcasts are flows: start from a broadcast template on the canvas.
export default function NewBroadcastPage() {
  redirect("/flows?tab=template&kat=broadcast");
}
