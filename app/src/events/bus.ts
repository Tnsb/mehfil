/**
 * Domain event bus.
 *
 * Every state-mutating tool emits a domain event here. Two things happen:
 *  1. The event is appended to the `domain_events` table (the activity log the
 *     agent queries generically — "based on your last 3 dinners…").
 *  2. In-process subscribers run (today: the notifications module; later:
 *     proactive agent triggers, LangGraph workflows, analytics).
 *
 * Adding a new reaction to app activity = subscribing here. No tool changes.
 */
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";

export type DomainEventInput = {
  type: string;
  actorId?: string | null;
  subjectType: "event" | "ticket" | "user" | "feedback";
  subjectId: string;
  payload?: Record<string, unknown>;
};

type Subscriber = (event: DomainEventInput & { id: string }) => Promise<void> | void;

const subscribers: Subscriber[] = [];

export function subscribe(fn: Subscriber) {
  subscribers.push(fn);
}

let subscribersLoaded = false;
async function ensureSubscribersLoaded() {
  if (subscribersLoaded) return;
  subscribersLoaded = true;
  // Lazy import avoids circular imports; modules self-register via subscribe().
  await import("@/notifications/rules");
}

export async function emitDomainEvent(input: DomainEventInput): Promise<void> {
  await ensureSubscribersLoaded();
  const id = newId("dev");
  await db.insert(tables.domainEvents).values({
    id,
    type: input.type,
    actorId: input.actorId ?? null,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    payload: input.payload ?? {},
  });
  for (const fn of subscribers) {
    try {
      await fn({ ...input, id });
    } catch (err) {
      // A failing subscriber must never break the user-facing action.
      console.error(`[bus] subscriber failed for ${input.type}:`, err);
    }
  }
}
