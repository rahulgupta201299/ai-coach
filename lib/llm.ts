import Anthropic from "@anthropic-ai/sdk";

/**
 * One function that streams a reply from whichever AI provider is configured.
 *
 *   AI_PROVIDER=anthropic  -> Claude (paid, needs Console credits)
 *   AI_PROVIDER=openai     -> any OpenAI-compatible API, including FREE tiers:
 *                             Groq, Google Gemini, OpenRouter (see .env.example)
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };
type Input = { rules: string; knowledge: string; messages: ChatMessage[] };

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

export function missingKey(): string | null {
  if (PROVIDER === "openai") return process.env.OPENAI_API_KEY ? null : "OPENAI_API_KEY";
  return process.env.ANTHROPIC_API_KEY ? null : "ANTHROPIC_API_KEY";
}

export async function* streamReply(input: Input): AsyncGenerator<string> {
  if (PROVIDER === "openai") yield* streamOpenAICompatible(input);
  else yield* streamAnthropic(input);
}

// ---------------- Claude ----------------
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
const EFFORT: Effort = EFFORTS.includes(process.env.ANTHROPIC_EFFORT as Effort)
  ? (process.env.ANTHROPIC_EFFORT as Effort)
  : "medium";

async function* streamAnthropic({ rules, knowledge, messages }: Input) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  try {
    const response = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 2048,
      output_config: { effort: EFFORT },
      system: [
        { type: "text", text: rules },
        // Knowledge base is large and rarely changes -> cache it to cut cost & latency.
        { type: "text", text: knowledge, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });
    for await (const event of response) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new ProviderError(err.message, err.status);
    throw err;
  }
}

// ---------------- OpenAI-compatible (Groq / Gemini / OpenRouter / OpenAI) ----------------
async function* streamOpenAICompatible({ rules, knowledge, messages }: Input) {
  const base = (process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "openai/gpt-oss-120b",
      stream: true,
      max_tokens: 2048,
      messages: [{ role: "system", content: `${rules}\n\n${knowledge}` }, ...messages],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new ProviderError(`${res.status} ${text.slice(0, 500)}`, res.status);
  }

  // Parse Server-Sent Events: lines like `data: {...}` ending with `data: [DONE]`
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }
}
