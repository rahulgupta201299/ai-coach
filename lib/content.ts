import { promises as fs } from "fs";
import path from "path";

/**
 * The coach's "context area": two editable markdown files.
 *  - knowledge.md    -> what the assistant is allowed to talk about (facts, frameworks, programs, FAQs)
 *  - instructions.md -> how it should talk (tone, coaching approach)
 */
const CONTENT_DIR = path.join(process.cwd(), "content");

export type ContentKey = "knowledge" | "instructions";

const FILES: Record<ContentKey, string> = {
  knowledge: "knowledge.md",
  instructions: "instructions.md",
};

export const MAX_CONTENT_CHARS = 200_000; // ~50k tokens, keeps each request affordable

export async function readContent(key: ContentKey): Promise<string> {
  try {
    return await fs.readFile(path.join(CONTENT_DIR, FILES[key]), "utf8");
  } catch {
    return "";
  }
}

export async function writeContent(key: ContentKey, value: string): Promise<void> {
  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.writeFile(path.join(CONTENT_DIR, FILES[key]), value, "utf8");
}
