import { Pairing } from "./pairing";

export default async function PairChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Pairing channelId={id} />;
}
