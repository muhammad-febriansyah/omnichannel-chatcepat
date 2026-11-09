// AI features the superadmin maps to a model (client-safe). Keys match the engine
// (engine/app/ai/registry.py FEATURES, ai_usage.feature).

export type AiFeatureKey = "flow_reply" | "simulator" | "embedding";

export const AI_FEATURES: { value: AiFeatureKey; label: string; desc: string; purpose: "chat" | "embedding" }[] = [
  { value: "flow_reply", label: "Balasan AI di flow", desc: "Node AI Agent membalas pelanggan (WA, IG, FB, Telegram)", purpose: "chat" },
  { value: "simulator", label: "Uji AI (simulator)", desc: "Tab Uji AI di node & bandingkan gaya", purpose: "chat" },
  { value: "embedding", label: "Pencarian pengetahuan", desc: "Indeks dokumen & cari jawaban yang relevan (embedding)", purpose: "embedding" },
];

export const PROVIDER_KINDS: { value: "anthropic" | "openai" | "openai_compatible"; label: string; hint: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)", hint: "Chat saja — tidak punya model embedding" },
  { value: "openai", label: "OpenAI", hint: "Chat + embedding (text-embedding-3-small)" },
  { value: "openai_compatible", label: "OpenAI-compatible", hint: "Gemini, DeepSeek, OpenRouter, Groq, dll — isi Base URL" },
];

export const featureLabel = (f: string) => AI_FEATURES.find((x) => x.value === f)?.label ?? f;

// Tenant tokens charged for a typical reply (~1.500 token prompt + 200 token answer).
export function sampleCost(inputMult: number, outputMult: number): number {
  return Math.ceil(1500 * inputMult + 200 * outputMult);
}
