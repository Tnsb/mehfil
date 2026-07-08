/**
 * Episode title cards — the Cohost names the episode the morning after,
 * from what actually happened: the best Overheard quote, feedback, the vibe.
 * "Ep 7: The Pineapple Incident."
 */
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import type { Event } from "@/db/schema";

const PATTERNS = [
  (w: string) => `The ${w} Incident`,
  (w: string) => `The One With the ${w}`,
  (w: string) => `A ${w} Situation`,
  (w: string) => `The ${w} Protocol`,
  (w: string) => `Enter the ${w}`,
];

const FALLBACK_WORDS = ["Midnight", "Encore", "Second Helping", "Plot Twist", "Golden Hour"];

const STOP = new Set(
  "the a an and or but so of in on at to for with was were is are just really very said says had has have not this that it its i you we they he she them then than there here".split(" "),
);

function interestingWord(text: string): string | null {
  const words = text.replace(/[^a-zA-Z ]/g, " ").split(/\s+/).filter(Boolean);
  const candidates = words.filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()));
  if (candidates.length === 0) return null;
  const pick = candidates.sort((a, b) => b.length - a.length)[0];
  return pick.charAt(0).toUpperCase() + pick.slice(1).toLowerCase();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function generateTitleCard(event: Event): Promise<string> {
  // source material: featured Overheard quotes + feedback comments + the vibe
  const quotes = await db
    .select()
    .from(tables.overheard)
    .where(and(eq(tables.overheard.eventId, event.id), eq(tables.overheard.status, "featured")));
  const fb = await db
    .select({ comment: tables.feedback.comment })
    .from(tables.feedback)
    .where(eq(tables.feedback.eventId, event.id));

  const material = [
    ...quotes.map((q) => q.quote),
    ...fb.map((f) => f.comment).filter(Boolean),
    event.vibe ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  if (process.env.ANTHROPIC_API_KEY && material.trim()) {
    try {
      const { text } = await generateText({
        model: anthropic(process.env.TABLE_AGENT_MODEL ?? "claude-sonnet-4-5"),
        system:
          'You write sitcom episode titles. Given raw material from a real night (quotes, feedback), return ONE title of 2-6 words in the style of "The Pineapple Incident" or "The One With the Flaming Wok". No quotes, no episode number, title case, nothing else.',
        prompt: material.slice(0, 1500),
      });
      const clean = text.trim().replace(/^["']|["']$/g, "");
      if (clean && clean.length <= 60) return clean;
    } catch (err) {
      console.error("[titlecard] LLM failed, falling back:", err);
    }
  }

  const word =
    (quotes[0] && interestingWord(quotes[0].quote)) ??
    interestingWord(material) ??
    FALLBACK_WORDS[hash(event.id) % FALLBACK_WORDS.length];
  return PATTERNS[hash(event.id) % PATTERNS.length](word);
}
