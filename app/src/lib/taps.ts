/**
 * Taps — double-blind, intent-matched, tied to the night.
 *
 * Rules encoded here:
 * - Three intents; a match requires BOTH people to pick the same one.
 *   A mismatched or one-way tap is never revealed to anyone.
 * - The window opens when the AfterParty fires (the morning reveal) and
 *   closes 48 hours later — same ritual as the One Shot roll developing.
 */
import type { Event, TapIntent } from "@/db/schema";

export const TAP_WINDOW_MS = 48 * 60 * 60 * 1000;

export const TAP_INTENTS: Record<
  TapIntent,
  { key: TapIntent; label: string; emoji: string; hint: string }
> = {
  vibe: { key: "vibe", label: "Vibe", emoji: "🫶", hint: "good energy, would hang again" },
  collab: { key: "collab", label: "Collab", emoji: "⚡", hint: "let's build / run / work on something" },
  crush: { key: "crush", label: "Crush", emoji: "💘", hint: "you know" },
};

export const TAP_INTENT_KEYS = Object.keys(TAP_INTENTS) as TapIntent[];

export type TapWindow =
  | { state: "locked" } // night not wrapped yet
  | { state: "open"; closesAt: Date }
  | { state: "closed"; closedAt: Date };

export function tapWindow(event: Event, now = new Date()): TapWindow {
  if (event.status !== "completed") return { state: "locked" };
  // fall back to ~12h after start for events completed before completedAt existed
  const anchor = event.completedAt ?? new Date(event.startsAt.getTime() + 12 * 60 * 60 * 1000);
  const closesAt = new Date(anchor.getTime() + TAP_WINDOW_MS);
  return now < closesAt ? { state: "open", closesAt } : { state: "closed", closedAt: closesAt };
}

export function hoursLeft(closesAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((closesAt.getTime() - now.getTime()) / 3_600_000));
}

/** Deterministic private-thread key for a matched pair within an event. */
export function matchThread(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `match:${a}:${b}`;
}
