/**
 * The AI Cohost — every party gets a character in its chat.
 *
 * Like the main agent, it degrades gracefully: with ANTHROPIC_API_KEY it's an
 * LLM speaking in the event's chosen vibe; without, it's canned-personality
 * heuristics. Both write through postCohostMessage, so the chat UI and the
 * notification rules don't care which brain produced the line.
 */
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import type { Event, Message, TapIntent, User } from "@/db/schema";
import { TAP_INTENTS, matchThread } from "@/lib/taps";
import { vibeOverlap } from "@/themes";
import { VIBES } from "./vibes";

export async function postCohostMessage(
  eventId: string,
  body: string,
  thread: string | null = null,
): Promise<Message> {
  const [msg] = await db
    .insert(tables.messages)
    .values({ id: newId("msg"), eventId, thread, userId: null, kind: "cohost", body })
    .returning();
  return msg;
}

/**
 * The Cohost as wingman: when a Tap becomes mutual, it opens the pair's
 * private chat with real context from the night — personas, bring duties,
 * One Shot captions — so nobody has to send a cold "hey".
 */
export async function postWingmanOpener(
  event: Event,
  userA: User,
  userB: User,
  intent: TapIntent,
): Promise<Message> {
  const thread = matchThread(userA.id, userB.id);
  const vibe = VIBES[event.cohostVibe] ?? VIBES.chaotic_bestie;
  const meta = TAP_INTENTS[intent];

  /* gather what actually happened at the table */
  const facts: string[] = [];
  const ticketsByUser: Record<string, { vibeAnswers: Record<string, string> | null; team: string | null }> = {};
  for (const u of [userA, userB]) {
    const [ticket] = await db
      .select()
      .from(tables.tickets)
      .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.userId, u.id)));
    ticketsByUser[u.id] = { vibeAnswers: ticket?.vibeAnswers ?? null, team: ticket?.team ?? null };
    if (ticket?.persona) facts.push(`${u.name} was ${ticket.persona.emoji} ${ticket.persona.card}`);
    if (ticket?.bringItem) facts.push(`${u.name} brought ${ticket.bringItem}`);
    const [photo] = await db
      .select({ caption: tables.photos.caption })
      .from(tables.photos)
      .where(and(eq(tables.photos.eventId, event.id), eq(tables.photos.userId, u.id)));
    if (photo?.caption) facts.push(`${u.name}'s One Shot: "${photo.caption}"`);
  }

  // "you were both team green at trivia" — vibe-check overlap leads
  const a = ticketsByUser[userA.id];
  const b = ticketsByUser[userB.id];
  if (a?.team && a.team === b?.team) facts.unshift(`you were both ${a.team} tonight`);
  const overlap = vibeOverlap(a?.vibeAnswers, b?.vibeAnswers);
  if (overlap) facts.unshift(overlap);

  // opt-in IG handle auto-exchange — because "what's their @" IS the morning-after behavior
  const handles =
    userA.shareHandleOnMatch && userB.shareHandleOnMatch && userA.igHandle && userB.igHandle
      ? `\n\n📸 handles, exchanged: @${userA.igHandle.replace(/^@/, "")} ↔ @${userB.igHandle.replace(/^@/, "")}`
      : "";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { text } = await generateText({
        model: anthropic(process.env.TABLE_AGENT_MODEL ?? "claude-sonnet-4-5"),
        system: `${vibe.prompt}
You are the AI Cohost of "${event.title}" playing wingman. ${userA.name} and ${userB.name} both tapped each other as ${meta.emoji} ${meta.label} (${meta.hint}) after the event. Open their private chat with ONE short message (2-3 sentences) that connects them using real details from the night, then hand the conversation to them. Never mention taps that didn't match.`,
        prompt: `Details from the night:\n${facts.join("\n") || "(no extra details — riff on the event itself)"}\nEvent: ${event.title} — ${event.vibe ?? ""}`,
      });
      return await postCohostMessage(event.id, text.trim() + handles, thread);
    } catch (err) {
      console.error("[cohost] wingman LLM failed, falling back:", err);
    }
  }

  const detail =
    facts.length > 0
      ? `Receipts from the night: ${facts.slice(0, 3).join(" · ")}.`
      : `You were both at ${event.title}. That's already more than most apps give you.`;
  const openers: Record<TapIntent, string> = {
    vibe: `${userA.name} + ${userB.name} — you both tapped ${meta.emoji} Vibe. ${detail} I've done the hard part; someone say something.`,
    collab: `${userA.name} + ${userB.name} — mutual ${meta.emoji} Collab tap. ${detail} Consider this your first standup. What are you building?`,
    crush: `well well WELL. ${userA.name} + ${userB.name} — you both tapped ${meta.emoji} Crush and neither of you would've known otherwise. ${detail} No cold "hey" allowed, I already warmed it up.`,
  };
  return await postCohostMessage(event.id, openers[intent] + handles, thread);
}

/** Should the cohost jump in on this guest message? */
function wantsCohost(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("cohost") ||
    lower.includes("?") ||
    /\b(address|where|when|what time|bring|wear|icebreaker)\b/.test(lower)
  );
}

/**
 * Maybe generate a cohost reply to a guest message. Returns the posted
 * message, or null if the cohost stayed quiet.
 */
export async function maybeCohostReply(
  event: Event,
  authorName: string,
  text: string,
): Promise<Message | null> {
  if (!wantsCohost(text)) return null;
  const vibe = VIBES[event.cohostVibe] ?? VIBES.chaotic_bestie;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const recent = await db
        .select()
        .from(tables.messages)
        .where(and(eq(tables.messages.eventId, event.id), isNull(tables.messages.thread)))
        .orderBy(desc(tables.messages.createdAt))
        .limit(12);
      const transcript = recent
        .reverse()
        .map((m) => `${m.kind === "cohost" ? "COHOST" : "guest"}: ${m.body}`)
        .join("\n");

      const { text: reply } = await generateText({
        model: anthropic(process.env.TABLE_AGENT_MODEL ?? "claude-sonnet-4-5"),
        system: `${vibe.prompt}
You are the AI Cohost of "${event.title}" (${event.vibe ?? "a party"}), happening ${event.startsAt.toLocaleString()}.
The address is ${event.locationAddress ?? "not set yet"} — everyone in this chat has paid, so you may share it.
Guests each get exactly ONE photo tonight (One Shot) that reveals the morning after.
Reply to the last guest message. Stay in character. 1-3 short sentences, no quotation marks around your reply.`,
        prompt: `${transcript}\n${authorName}: ${text}`,
      });
      return await postCohostMessage(event.id, reply.trim());
    } catch (err) {
      console.error("[cohost] LLM reply failed, falling back:", err);
    }
  }

  /* offline cohost */
  const lower = text.toLowerCase();
  let reply: string;
  if (/\b(address|where)\b/.test(lower)) {
    reply = event.locationAddress
      ? vibe.addressAnswer(event.locationAddress)
      : "the host hasn't dropped the address yet — the SECOND they do, you'll hear it from me.";
  } else if (/\b(when|what time)\b/.test(lower)) {
    reply = vibe.addressAnswer(
      event.startsAt.toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" }),
    );
  } else if (/\bbring\b/.test(lower)) {
    const [ticket] = await db
      .select({ bringItem: tables.tickets.bringItem, name: tables.users.name })
      .from(tables.tickets)
      .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
      .where(eq(tables.tickets.eventId, event.id));
    reply = ticket?.bringItem
      ? `assignments are sacred. check your invite card — it's all there.`
      : vibe.fallback[0];
  } else {
    reply = vibe.fallback[Math.floor(Math.random() * vibe.fallback.length)];
  }
  return await postCohostMessage(event.id, reply);
}
