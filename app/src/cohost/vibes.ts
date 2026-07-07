/**
 * The AI Cohost's personalities + the deterministic pools used for
 * personalized invites (personas) and bring-something assignments.
 */
import type { CohostVibe, TicketPersona } from "@/db/schema";

export type VibeSpec = {
  key: CohostVibe;
  name: string;
  emoji: string;
  /** system prompt persona for the LLM cohost */
  prompt: string;
  /** canned lines for the offline cohost */
  welcome: (guest: string, bring: string, persona: string) => string;
  hype: (title: string) => string;
  superlatives: (lines: string[]) => string;
  addressAnswer: (address: string) => string;
  fallback: string[];
};

export const VIBES: Record<CohostVibe, VibeSpec> = {
  chaotic_bestie: {
    key: "chaotic_bestie",
    name: "Chaotic Bestie",
    emoji: "😜",
    prompt:
      "You are the party's chaotic best friend: lowercase, unhinged but loving, lots of energy, occasional caps for EMPHASIS. Short texts only (1-3 sentences).",
    welcome: (g, b, p) =>
      `${g.toUpperCase()} IS COMING!!! ok listen ${g}, you're bringing ${b} (non-negotiable) and your card is ${p}. this is already the best night of my life`,
    hype: (t) => `24 HOURS until ${t}!!! hydrate. charge your phone. you get ONE photo tomorrow, make it count 📸`,
    superlatives: (lines) => `ok the votes are in 🏆\n${lines.join("\n")}\nno appeals. court is adjourned.`,
    addressAnswer: (a) => `for the 100th time (love you): ${a} 📍`,
    fallback: [
      "this chat is already iconic",
      "i simply cannot wait",
      "who's bringing the drama? kidding. unless…",
    ],
  },
  formal_butler: {
    key: "formal_butler",
    name: "Formal Butler",
    emoji: "🎩",
    prompt:
      "You are an impeccably formal butler hosting the gathering: dry wit, perfect grammar, subtly savage. Short responses (1-3 sentences).",
    welcome: (g, b, p) =>
      `A warm welcome to ${g}. You have been entrusted with ${b}. Your card for the evening: ${p}. Do dress accordingly.`,
    hype: (t) => `A gentle reminder: ${t} commences in 24 hours. Each guest is permitted precisely one photograph. Choose your moment with dignity.`,
    superlatives: (lines) => `The evening's honours, as observed:\n${lines.join("\n")}\nCongratulations to all. Mostly.`,
    addressAnswer: (a) => `The address, once more, is ${a}. I shall not repeat it a fourth time.`,
    fallback: [
      "Very good. Carry on.",
      "I have taken note.",
      "How thrilling. Do continue.",
    ],
  },
  hype_man: {
    key: "hype_man",
    name: "Unhinged Hype Man",
    emoji: "📣",
    prompt:
      "You are an unhinged hype man MC-ing the party: ALL ENERGY, sports-announcer cadence, everyone is a legend. Short responses (1-3 sentences).",
    welcome: (g, b, p) =>
      `🚨 NEW LEGEND ALERT 🚨 ${g} JUST JOINED THE ROSTER! Assignment: ${b}. Card drawn: ${p}. THE LINEUP IS STACKED!`,
    hype: (t) => `📣 T-MINUS 24 HOURS TO ${t.toUpperCase()}! ONE SHOT PER LEGEND TOMORROW — NO RETAKES, ALL GLORY!`,
    superlatives: (lines) => `🏆 THE AWARDS CEREMONY 🏆\n${lines.join("\n")}\nEVERYBODY GETS A RING!`,
    addressAnswer: (a) => `📍 THE ARENA: ${a}! BE THERE!`,
    fallback: [
      "THE ENERGY IN THIS CHAT IS UNDEFEATED!",
      "SOMEBODY SAY SOMETHING SO I CAN HYPE IT!",
      "LEGENDS ONLY IN HERE!",
    ],
  },
};

export const VIBE_OPTIONS = Object.values(VIBES).map((v) => ({
  key: v.key,
  name: v.name,
  emoji: v.emoji,
}));

/* ---- deterministic pools for personalized invites ---- */

const PERSONAS: TicketPersona[] = [
  { card: "The Wildcard", emoji: "🃏", line: "Nobody knows what you'll do next. Neither do you." },
  { card: "The Icebreaker", emoji: "🔥", line: "First to laugh, first to make strangers into friends." },
  { card: "The Last to Leave", emoji: "🌙", line: "The night doesn't end until you say it does." },
  { card: "The Vibe Curator", emoji: "🪩", line: "The room follows your energy. Use it wisely." },
  { card: "The Snack Oracle", emoji: "🥑", line: "You always know what the table needs before it does." },
  { card: "The Storyteller", emoji: "📖", line: "One story from you and the whole table leans in." },
  { card: "The Plus-One Magnet", emoji: "✨", line: "People just want to sit next to you. It's a gift." },
  { card: "The DJ in Spirit", emoji: "🎧", line: "You will fight for the aux and you will win." },
];

const BRING_ITEMS = [
  "ice (a heroic amount)",
  "one playlist banger",
  "limes",
  "something sweet",
  "your best gossip",
  "a mystery bottle",
  "chips (the loud kind)",
  "napkins & good manners",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function assignPersona(ticketId: string): TicketPersona {
  return PERSONAS[hash(ticketId) % PERSONAS.length];
}

export function assignBringItem(ticketId: string): string {
  return BRING_ITEMS[hash(`bring:${ticketId}`) % BRING_ITEMS.length];
}

/** superlative titles for the AfterParty awards */
export const SUPERLATIVES = [
  "🏆 MVP of the night",
  "😂 Funniest single sentence",
  "🕺 Most likely to start the dancing",
  "🍽️ Cleaned their plate first",
  "🧊 Most heroic ice run",
  "🎤 Aux cord champion",
];
