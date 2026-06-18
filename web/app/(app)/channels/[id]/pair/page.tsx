import { Pairing } from "./pairing";
import { requirePageAbility } from "@/lib/session";

export default async function PairChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAbility("channel.connect");
  const { id } = await params;
  return <Pairing channelId={id} />;
}
