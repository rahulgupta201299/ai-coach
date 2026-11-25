# Coach Chatbot — AI coaching assistant (Next.js + Claude)

A mobile-first web chatbot that helps a coach's clients by answering **only from the coach's own
context** (knowledge base + coaching instructions). Built with Next.js (App Router, TypeScript) and
the Claude API. No Python needed — the AI call happens in a Next.js API route.

## Quick start

```bash
cd ~/Documents/coach-chatbot
npm install
cp .env.example .env.local      # then open .env.local and paste your Claude API key
npm run dev                      # http://localhost:3000
```

- Chat: http://localhost:3000
- Admin (edit context): http://localhost:3000/admin  (password = `ADMIN_PASSWORD` in `.env.local`)

### Free option (no credit card): Groq / Gemini / OpenRouter
Set `AI_PROVIDER=openai` and fill the `OPENAI_*` lines in `.env.local` (examples are in `.env.example`).
Groq is the easiest: create a key at https://console.groq.com/keys and use model `openai/gpt-oss-120b`.
Free tiers have daily request limits, so they're for testing/demo, not production.

### Getting a Claude API key
A claude.ai chat subscription does **not** include an API key. Create one at
https://console.anthropic.com → *Settings → API keys*, add a few dollars of credit under
*Billing*, and paste the key into `ANTHROPIC_API_KEY` in `.env.local`. Never commit `.env.local`.

## How the "context area" works

| File | What it controls |
|---|---|
| `content/knowledge.md` | **What** the bot may talk about: focus areas, frameworks, programs, prices, policies, FAQs. The bot answers only from this. |
| `content/instructions.md` | **How** it talks: tone, coaching style, reply length, when to mention programs. |

Both can be edited from `/admin` (changes apply instantly, no redeploy) or directly in the files.
The included content is a **sample** (a fictional "Coach Meera" life & career coach) — replace it
with the real coach's material.

## Guardrails
1. **Hard crisis filter** (`lib/guardrails.ts`): messages about self-harm/suicide/danger never reach
   the model; the user gets a fixed response with Tele-MANAS (14416 / 1-800-891-4416) and 112.
2. **System prompt rules** (`lib/prompt.ts`): stay inside the knowledge base, refuse off-topic
   questions, no medical/legal/financial advice, don't invent prices or policies, resist
   "ignore previous instructions" attempts.

## Project structure
```
app/
  page.tsx              chat page
  admin/page.tsx        password-protected editor for the context
  api/chat/route.ts     calls Claude (streaming), applies guardrails, rate limit
  api/admin/route.ts    read/save knowledge & instructions
components/Chat.tsx     chat UI: streaming, past conversations, mobile drawer
lib/                    prompt builder, guardrails, content file helpers
content/                the coach's knowledge base + instructions
```

## Settings (`.env.local`)
- `ANTHROPIC_MODEL` — default `claude-opus-5-5`; use `claude-sonnet-5-5` or `claude-haiku-5-5` to cut cost.
- `ANTHROPIC_EFFORT` — `low` | `medium` (default) | `high` | `xhigh` | `max`.
- `NEXT_PUBLIC_COACH_NAME`, `NEXT_PUBLIC_BRAND_NAME` — shown in the UI.

## Cost notes
Each reply sends the knowledge base + the last 20 messages. The knowledge base is
**prompt-cached**, so repeat requests within a few minutes are much cheaper.

## Deploying
- **Any Node host / VPS / Render / Railway:** `npm run build && npm start`. The admin editor writes
  to `content/`, so use a persistent disk.
- **Vercel:** works for chat, but its file system is read-only, so edit `content/*.md` in the repo and
  redeploy instead of using `/admin` (or move content into a database/KV store).

## Not included (out of scope for this task)
Sign-up/login, payments (Razorpay/UPI), subscriptions & trials, server-side chat history, admin
analytics, mobile apps. Conversations are saved in the browser's local storage only.
