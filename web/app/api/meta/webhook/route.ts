// /api/meta/webhook — proxy webhook Meta (Messenger/Instagram/WA Cloud) ke gateway.
// Callback URL publik dipasang di Meta App Dashboard menunjuk ke domain web,
// route ini meneruskan server-to-server ke gateway (sembunyikan GATEWAY_URL, hindari
// expose gateway ke internet). Body POST diteruskan RAW byte-for-byte agar HMAC
// X-Hub-Signature-256 tetap valid (gateway yang verifikasi signature + verify token).

const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8080";

// GET = verifikasi challenge (hub.mode / hub.verify_token / hub.challenge).
// Token diverifikasi gateway (META_VERIFY_TOKEN); teruskan query apa adanya.
export async function GET(request: Request) {
  const qs = new URL(request.url).search;
  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY}/webhooks/meta/fb${qs}`, {
      signal: request.signal,
    });
  } catch {
    return new Response("gateway tidak dapat dihubungi", { status: 502 });
  }
  // Gateway balas challenge string (200) atau 403; teruskan apa adanya.
  return new Response(await upstream.text(), { status: upstream.status });
}

// POST = event inbound. Pilih path gateway dari field `object` payload:
//   whatsapp_business_account → /wa ; page/instagram → /fb (handler sama fb+ig).
export async function POST(request: Request) {
  const sig = request.headers.get("X-Hub-Signature-256") ?? "";
  const body = await request.arrayBuffer();

  let path = "/webhooks/meta/fb";
  try {
    const obj = JSON.parse(new TextDecoder().decode(body))?.object;
    if (obj === "whatsapp_business_account") path = "/webhooks/meta/wa";
  } catch {
    // payload non-JSON / kosong → biarkan gateway yang tolak.
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sig,
      },
      body,
      signal: request.signal,
    });
  } catch {
    return new Response("gateway tidak dapat dihubungi", { status: 502 });
  }
  return new Response(await upstream.text(), { status: upstream.status });
}
