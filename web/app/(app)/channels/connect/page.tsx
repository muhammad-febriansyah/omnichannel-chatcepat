import { waUnofficialEnabled } from "@/lib/channel-policy";
import { ConnectChannelForm } from "./connect-channel";

export default function ConnectChannelPage() {
  return <ConnectChannelForm waUnofficialEnabled={waUnofficialEnabled()} />;
}
