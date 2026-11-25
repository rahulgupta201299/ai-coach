/**
 * Hard safety guardrail that runs BEFORE the AI is called.
 * If a message suggests self-harm / suicide / immediate danger, we never send it to
 * the model for "coaching" — we return a fixed, safe response with Indian helplines.
 * (The system prompt also instructs the model to handle subtler cases the same way.)
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bend\s+(my|this)\s+life\b/i,
  /\bend\s+it\s+all\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bself[\s-]?harm/i,
  /\bhurt(ing)?\s+my\s*self\b/i,
  /\bcut(ting)?\s+my\s*self\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\boverdose\b/i,
  /\bkill\s+(him|her|them|someone)\b/i,
];

export function isCrisisMessage(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export const CRISIS_RESPONSE = `I'm really sorry you're going through this, and I'm glad you said something. What you're feeling matters, and you deserve support from a real person right now — this is beyond what a coaching assistant can safely help with.

**Please reach out now:**
- **Tele-MANAS (free, 24×7, Govt. of India):** call **14416** or **1-800-891-4416**
- **Emergency services:** call **112** if you are in immediate danger
- Or contact someone you trust — a friend, family member, or your doctor — and let them know how you're feeling.

If you're outside India, please contact your local emergency number or a crisis line in your country.

You don't have to go through this alone. When you're feeling safer, I'm here to continue our coaching conversation.`;
