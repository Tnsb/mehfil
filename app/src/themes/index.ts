/**
 * Themes — the identity engine. A theme re-renders the event, not re-skins it:
 * palette, cover art, One Shot film stock, superlative categories, icebreakers,
 * plot twists, and a one-tap host playlist. Verticals are themes + template
 * config, never new code paths.
 */
import type { TwistIntensity } from "@/db/schema";

export type FilmStock = {
  name: string;
  /** css filter applied to the still */
  filter: string;
  /** 0..1 grain opacity burned in at capture */
  grain: number;
  frame: "letterbox" | "polaroid" | "vhs";
  /** color of the burned-in title/timestamp text */
  burnColor: string;
};

export type ThemePack = {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  /** page + cover gradient */
  palette: { from: string; to: string; accent: string };
  filmStock: FilmStock;
  superlatives: string[];
  icebreakers: string[];
  dressCode: string;
  playlist: { title: string; tracks: string[] };
};

export const THEMES: Record<string, ThemePack> = {
  classic: {
    key: "classic",
    name: "House Classic",
    emoji: "🏠",
    tagline: "warm lights, good people, no agenda",
    palette: { from: "#ff7847", to: "#e5397f", accent: "#ffc94a" },
    filmStock: {
      name: "Disposable '98",
      filter: "contrast(1.08) saturate(1.15) brightness(1.02)",
      grain: 0.14,
      frame: "letterbox",
      burnColor: "#fff6ec",
    },
    superlatives: [
      "🏆 MVP of the night",
      "😂 Funniest single sentence",
      "🕺 First on the dance floor",
      "🌙 Last to leave",
    ],
    icebreakers: [
      "Everyone: worst date story, 30 seconds each.",
      "Hot take round — food opinions only.",
      "Who here has the weirdest hidden talent? Prove it.",
    ],
    dressCode: "come as you are, leave as a legend",
    playlist: {
      title: "house classic energy",
      tracks: ["Dreams — Fleetwood Mac", "Golden — Harry Styles", "Juice — Lizzo", "September — Earth, Wind & Fire", "Levitating — Dua Lipa"],
    },
  },
  y2k: {
    key: "y2k",
    name: "Y2K Rooftop",
    emoji: "📟",
    tagline: "low-rise jeans, high expectations",
    palette: { from: "#8b5cf6", to: "#06b6d4", accent: "#f0abfc" },
    filmStock: {
      name: "VHS-C 2001",
      filter: "contrast(1.15) saturate(1.35) hue-rotate(-8deg)",
      grain: 0.22,
      frame: "vhs",
      burnColor: "#a7f3d0",
    },
    superlatives: [
      "📟 Most Y2K outfit",
      "💿 Aux cord champion",
      "📸 Most paparazzi'd",
      "🪩 Dance floor dictator",
    ],
    icebreakers: [
      "What was your first screen name? Explain yourself.",
      "Defend one 2000s fashion crime you committed.",
      "Ringtone you had memorized — hum it.",
    ],
    dressCode: "butterfly clips, cargo, chrome — commit",
    playlist: {
      title: "y2k rooftop",
      tracks: ["Toxic — Britney Spears", "Hey Ya! — OutKast", "Murder on the Dancefloor — Sophie Ellis-Bextor", "Ignition (Remix) — R. Kelly", "Say My Name — Destiny's Child"],
    },
  },
  manor: {
    key: "manor",
    name: "Murder at the Manor",
    emoji: "🕯️",
    tagline: "one of you did it. dinner first.",
    palette: { from: "#312e51", to: "#7f1d1d", accent: "#d4af37" },
    filmStock: {
      name: "Gothic Sepia",
      filter: "sepia(0.45) contrast(1.2) brightness(0.92)",
      grain: 0.18,
      frame: "polaroid",
      burnColor: "#d4af37",
    },
    superlatives: [
      "🕯️ Most suspicious all evening",
      "🎭 Best in character",
      "🔎 Sharpest detective",
      "💀 Most dramatic death",
    ],
    icebreakers: [
      "State your alibi for 9pm. You have 20 seconds.",
      "Accuse the person to your left of something absurd.",
      "What's your character's darkest secret? Lie well.",
    ],
    dressCode: "black tie, hidden motives",
    playlist: {
      title: "suspects & candlelight",
      tracks: ["Bang Bang — Nancy Sinatra", "Seven Devils — Florence + the Machine", "Way Down We Go — KALEO", "Bad Guy — Billie Eilish", "In the Hall of the Mountain King — Grieg"],
    },
  },
  chai: {
    key: "chai",
    name: "Monsoon Chai Evening",
    emoji: "🌧️",
    tagline: "rain on the window, cutting chai, no phones",
    palette: { from: "#0e7490", to: "#4d7c0f", accent: "#fbbf24" },
    filmStock: {
      name: "Monsoon 120",
      filter: "contrast(1.05) saturate(0.9) brightness(1.05) sepia(0.12)",
      grain: 0.12,
      frame: "polaroid",
      burnColor: "#fef3c7",
    },
    superlatives: [
      "☕ Best chai opinion",
      "📖 Best storyteller",
      "🌧️ Coziest human",
      "🍪 Snack destroyer",
    ],
    icebreakers: [
      "Best rainy-day memory, one minute each.",
      "Chai or coffee — defend your life choice.",
      "A song that sounds like the monsoon. Queue it.",
    ],
    dressCode: "softest thing you own",
    playlist: {
      title: "monsoon & masala",
      tracks: ["Tum Hi Ho — Arijit Singh", "Iktara — Amit Trivedi", "Coffee — beabadoobee", "Kabira — Tochi Raina", "Holocene — Bon Iver"],
    },
  },
  finish_line: {
    key: "finish_line",
    name: "Finish Line",
    emoji: "🏁",
    tagline: "miles first, brunch after",
    palette: { from: "#16a34a", to: "#0ea5e9", accent: "#facc15" },
    filmStock: {
      name: "Finish-Line Kodak",
      filter: "contrast(1.18) saturate(1.25)",
      grain: 0.1,
      frame: "letterbox",
      burnColor: "#fefce8",
    },
    superlatives: [
      "🏁 Strongest finish",
      "🗣️ Best mid-run conversation",
      "⏰ Most heroic early alarm",
      "🥞 First to mention brunch",
    ],
    icebreakers: [
      "Race-day superstition — everyone has one, what's yours?",
      "Your running villain origin story, 30 seconds.",
      "Flat white or electrolytes? There's a right answer.",
    ],
    dressCode: "bib on, excuses off",
    playlist: {
      title: "negative splits",
      tracks: ["Run the World — Beyoncé", "Stronger — Kanye West", "Physical — Dua Lipa", "Eye of the Tiger — Survivor", "Born to Run — Bruce Springsteen"],
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = "classic";

export function getTheme(key: string | null | undefined): ThemePack {
  return THEMES[key ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME];
}

/* ---------------- plot twists (Cohost mid-event surprises) ---------------- */

export const TWISTS: Record<Exclude<TwistIntensity, "off">, string[]> = {
  chill: [
    "🌀 PLOT TWIST: flash vote — best outfit in the room. Reply with a name, results in 10.",
    "🌀 PLOT TWIST: everyone swap seats with the person you've talked to least. Go.",
    "🌀 PLOT TWIST: phones in the middle for the next 20 minutes. I'll know.",
  ],
  spicy: [
    "🌀 PLOT TWIST: the person who arrived last gives a 60-second toast. Now.",
    "🌀 PLOT TWIST: two truths and a lie, table-wide, worst liar does the dishes.",
    "🌀 PLOT TWIST: everyone reveals their most recent photo... caption only. Describe it, don't show it.",
  ],
  chaos: [
    "🌀 PLOT TWIST: accent round. Everyone speaks in a different accent for 10 minutes. No breaking.",
    "🌀 PLOT TWIST: the host must be addressed only as 'Chef' for the rest of the night.",
    "🌀 PLOT TWIST: silent minute. 60 seconds, no words, eye contact encouraged. Starting… now.",
  ],
};

/* ---------------- vibe check (30-second RSVP quiz, one tap each) ---------- */

export type VibeQuestion = {
  id: string;
  prompt: string;
  options: { key: string; label: string }[];
};

export const VIBE_CHECK: VibeQuestion[] = [
  {
    id: "energy",
    prompt: "Your natural habitat at a party",
    options: [
      { key: "kitchen", label: "🍳 kitchen counter" },
      { key: "dancefloor", label: "🪩 wherever the music is" },
      { key: "couch", label: "🛋️ deep talk on the couch" },
    ],
  },
  {
    id: "hour",
    prompt: "Your best hour",
    options: [
      { key: "golden", label: "🌇 golden hour" },
      { key: "midnight", label: "🌙 midnight" },
      { key: "3am", label: "🌌 3am deep talks" },
    ],
  },
  {
    id: "role",
    prompt: "In the group project of life you are",
    options: [
      { key: "planner", label: "📋 the planner" },
      { key: "wildcard", label: "🃏 the wildcard" },
      { key: "glue", label: "🧲 the glue" },
    ],
  },
];

export const TEAMS = ["Team Gold", "Team Grape", "Team Mint"] as const;

/** deterministic team from vibe answers — used for seating/games */
export function teamFromVibe(answers: Record<string, string>): string {
  const s = Object.values(answers).sort().join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TEAMS[h % TEAMS.length];
}

/** human line for vibe overlap — the wingman uses this on matches */
export function vibeOverlap(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined,
): string | null {
  if (!a || !b) return null;
  for (const q of VIBE_CHECK) {
    if (a[q.id] && a[q.id] === b[q.id]) {
      const opt = q.options.find((o) => o.key === a[q.id]);
      if (opt) return `you both picked ${opt.label}`;
    }
  }
  return null;
}
