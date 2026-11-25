import { timingSafeEqual } from "crypto";
import { readContent, writeContent, MAX_CONTENT_CHARS } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = req.headers.get("x-admin-password") || "";
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [knowledge, instructions] = await Promise.all([
    readContent("knowledge"),
    readContent("instructions"),
  ]);
  return Response.json({ knowledge, instructions });
}

export async function PUT(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { knowledge, instructions } = body as { knowledge?: unknown; instructions?: unknown };

  for (const [name, v] of [["knowledge", knowledge], ["instructions", instructions]] as const) {
    if (v !== undefined && (typeof v !== "string" || v.length > MAX_CONTENT_CHARS)) {
      return Response.json({ error: `${name} must be text under ${MAX_CONTENT_CHARS} characters.` }, { status: 400 });
    }
  }
  try {
    if (typeof knowledge === "string") await writeContent("knowledge", knowledge);
    if (typeof instructions === "string") await writeContent("instructions", instructions);
  } catch (err) {
    console.error("[admin] write failed:", err);
    return Response.json(
      { error: "Could not save. Is the server's file system read-only (e.g. Vercel)? See README." },
      { status: 500 }
    );
  }
  return Response.json({ ok: true });
}
