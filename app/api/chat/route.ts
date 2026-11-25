import { buildSystemPrompt } from "@/lib/prompt";
import { isCrisisMessage, CRISIS_RESPONSE } from "@/lib/guardrails";
import { streamReply, missingKey, ProviderError, PROVIDER, type ChatMessage } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY = 20; // last N messages sent to the model (keeps cost bounded)
const MAX_MESSAGE_CHARS = 4000;

// Very small in-memory rate limiter (per IP). Swap for Redis/Upstash in production.
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

function textStream(text: string) {
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many messages. Please wait a minute." }, { status: 429 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = (body.messages || [])
    .filter(
      (m): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY);

  // Conversation must start with a user turn and end with one.
  while (messages.length && messages[0].role !== "user") messages.shift();
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    return Response.json({ error: "No message to answer." }, { status: 400 });
  }

  // 1) Hard safety guardrail — never sent to the model.
  if (isCrisisMessage(last.content)) {
    return textStream(CRISIS_RESPONSE);
  }

  const missing = missingKey();
  if (missing) {
    return Response.json(
      { error: `Server is missing ${missing}. Add it to .env.local and restart.` },
      { status: 500 }
    );
  }

  const { rules, knowledge } = await buildSystemPrompt();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamReply({ rules, knowledge, messages })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error(`[chat] ${PROVIDER} API error:`, err);
        const status = err instanceof ProviderError ? err.status : undefined;
        let msg = "Sorry, something went wrong. Please try again in a moment.";
        if (status === 401 || status === 403) msg = "The API key is invalid. Please check it in .env.local.";
        else if (status === 429) msg = "The AI service is busy or the free limit was reached. Please try again shortly.";

        if (process.env.NODE_ENV !== "production") {
          // In development, show the real reason so setup problems are easy to fix.
          const detail = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`\n\n_${msg}_\n\n\`\`\`\nDev details (${PROVIDER}${status ? `, HTTP ${status}` : ""}): ${detail}\n\`\`\``)
          );
        } else {
          controller.enqueue(encoder.encode(`\n\n_${msg}_`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
