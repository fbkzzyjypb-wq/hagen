import type { ChatMessage, Settings } from "./types";

export type ChatTransport = { baseUrl: string; apiKey: string; model: string; label: string };

/** Chat i appen når en leverandør er satt opp med nøkkel og modell. Ellers null, og spørsmålet åpnes i Claude-appen. */
export function resolveTransport(settings: Settings): ChatTransport | null {
  if (settings.llmBaseUrl && settings.llmApiKey && settings.llmModel) {
    return { baseUrl: settings.llmBaseUrl, apiKey: settings.llmApiKey, model: settings.llmModel, label: providerShortName(settings.llmBaseUrl) };
  }
  return null;
}

/** Ferdige oppsett for leverandører med gratisnivå og OpenAI-kompatibelt API. */
export const LLM_PRESETS: { id: string; label: string; short: string; baseUrl: string; keyUrl: string; hint: string }[] = [
  {
    id: "gemini",
    label: "Google Gemini (gratis)",
    short: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    hint: "Lag nøkkel i Google AI Studio. Gratisnivået krever ikke kort. Velg en Flash-modell.",
  },
  {
    id: "groq",
    label: "Groq (gratis)",
    short: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    hint: "Rask. Gratisnivået krever ikke kort. Velg f.eks. en Llama-modell.",
  },
  {
    id: "openrouter",
    label: "OpenRouter (gratis modeller)",
    short: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    hint: "Mange modeller. Gratis modeller har «:free» i navnet, ca. 50 forespørsler per dag.",
  },
];

export function providerShortName(baseUrl?: string): string {
  return LLM_PRESETS.find((p) => p.baseUrl === baseUrl)?.short ?? "KI";
}

type StreamArgs = {
  transport: ChatTransport;
  system: string;
  context: string;
  history: Pick<ChatMessage, "role" | "content">[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
};

function headers(apiKey: string): HeadersInit {
  return { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
}

function describeError(status: number, body: string): Error {
  if (status === 400 && /image|vision|multimodal/i.test(body)) {
    return new Error("Modellen støtter ikke bilder. Velg en Gemini Flash-modell, eller en Llama 4-modell hos Groq, i innstillinger.");
  }
  if (status === 401 || status === 403) return new Error("API-nøkkelen ble avvist av leverandøren.");
  if (status === 429) return new Error("Gratiskvoten er brukt opp for nå. Prøv igjen om litt.");
  if (status === 404) return new Error("Fant ikke modellen. Velg en annen modell i innstillinger.");
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    detail = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? "");
  } catch {
    // ignorer
  }
  return new Error(`Leverandøren svarte ${status}${detail ? `: ${detail.slice(0, 160)}` : "."}`);
}

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type RequestMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

async function chatRequest(
  transport: ChatTransport,
  messages: RequestMessage[],
  { stream, maxTokens, signal }: { stream: boolean; maxTokens?: number; signal?: AbortSignal }
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${transport.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: headers(transport.apiKey),
      body: JSON.stringify({ model: transport.model, stream, ...(maxTokens ? { max_tokens: maxTokens } : {}), messages }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error("Fikk ikke kontakt med leverandøren. Sjekk nettforbindelsen.");
  }
  if (!res.ok) throw describeError(res.status, await res.text().catch(() => ""));
  return res;
}

/** Leser en SSE-strøm fra chat/completions og gir tekstbitene etter hvert. */
async function readStream(res: Response, onText: (delta: string) => void): Promise<string> {
  if (!res.body) throw new Error("Leverandøren svarte uten innhold.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    const json = JSON.parse(payload) as { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } };
    if (json.error?.message) throw new Error(json.error.message);
    const delta = json.choices?.[0]?.delta?.content;
    if (delta) {
      text += delta;
      onText(delta);
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);
  if (!text) throw new Error("Leverandøren svarte uten tekst.");
  return text;
}

function textFromCompletion(json: { choices?: { message?: { content?: string | null } }[] }): string {
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Leverandøren svarte uten tekst.");
  return text;
}

/** Strømmer et svar fra en OpenAI-kompatibel leverandør (chat/completions med SSE). */
export async function streamAnswer({ transport, system, context, history, onText, signal }: StreamArgs): Promise<string> {
  const res = await chatRequest(
    transport,
    [{ role: "system", content: `${system}\n\n${context}` }, ...history.map((m) => ({ role: m.role, content: m.content }))],
    { stream: true, signal }
  );
  return readStream(res, onText);
}

type CompleteArgs = {
  transport: ChatTransport;
  system: string;
  messages: Pick<ChatMessage, "role" | "content">[];
  maxTokens?: number;
  signal?: AbortSignal;
};

/** Ett kort svar uten strømming, f.eks. til titler og sammendrag. */
export async function completeText({ transport, system, messages, maxTokens = 300, signal }: CompleteArgs): Promise<string> {
  const res = await chatRequest(transport, [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))], {
    stream: false,
    maxTokens,
    signal,
  });
  return textFromCompletion(await res.json());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Kunne ikke lese bildet."));
    reader.readAsDataURL(blob);
  });
}

/** Brukermelding med tekst og bilde (data-URL), slik OpenAI-kompatible leverandører vil ha det. */
async function imageMessage(text: string, image: Blob): Promise<RequestMessage> {
  return { role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: await blobToDataUrl(image) } }] };
}

type ImageArgs = { transport: ChatTransport; system: string; prompt: string; image: Blob; signal?: AbortSignal };

/** Strømmer et svar om et bilde. Krever en modell som tåler bilder (Gemini Flash, Llama 4). */
export async function streamWithImage({ transport, system, prompt, image, signal, onText }: ImageArgs & { onText: (delta: string) => void }): Promise<string> {
  const res = await chatRequest(transport, [{ role: "system", content: system }, await imageMessage(prompt, image)], { stream: true, signal });
  return readStream(res, onText);
}

/** Ett svar om et bilde uten strømming, f.eks. JSON med kandidater. */
export async function completeWithImage({ transport, system, prompt, image, signal, maxTokens = 600 }: ImageArgs & { maxTokens?: number }): Promise<string> {
  const res = await chatRequest(transport, [{ role: "system", content: system }, await imageMessage(prompt, image)], { stream: false, maxTokens, signal });
  return textFromCompletion(await res.json());
}

/** Henter modellene nøkkelen har tilgang til (GET /models). */
export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, { headers: headers(apiKey) });
  } catch {
    throw new Error("Fikk ikke kontakt med leverandøren. Sjekk adressen og nettforbindelsen.");
  }
  if (!res.ok) throw describeError(res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id.replace(/^models\//, "")).sort((a, b) => a.localeCompare(b));
}
