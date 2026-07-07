/**
 * The scheduler tick — the one entry point for time-based behavior.
 *
 * Called by /api/cron (Vercel Cron in prod, manual/curl in dev). It:
 *  1. Delivers notifications whose `scheduledFor` has arrived (T-24h reminders).
 *  2. Auto-fires the AfterParty for events that ended ~12h ago.
 *
 * New scheduled behavior = a new step in this file, usually calling a tool
 * with the system context.
 */
import { db, tables } from "@/db";
import { and, eq, gt, lte, isNotNull, inArray } from "drizzle-orm";
import { deliverNow } from "./deliver";
import { runTool, SYSTEM_CONTEXT } from "@/agent/registry";
import { emitDomainEvent } from "@/events/bus";
import { postCohostMessage } from "@/cohost";
import { VIBES } from "@/cohost/vibes";

const AFTERPARTY_DELAY_MS = 12 * 60 * 60 * 1000;
const HYPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function schedulerTick(): Promise<{
  deliveredScheduled: number;
  afterpartiesFired: number;
  hypesDropped: number;
}> {
  const now = new Date();

  // 1. deliver due scheduled notifications
  const due = await db
    .select()
    .from(tables.notifications)
    .where(
      and(
        eq(tables.notifications.status, "queued"),
        isNotNull(tables.notifications.scheduledFor),
        lte(tables.notifications.scheduledFor, now),
      ),
    );
  for (const n of due) await deliverNow(n.id);

  // 2. auto-fire AfterParty for events that ended ~12h ago
  const cutoff = new Date(now.getTime() - AFTERPARTY_DELAY_MS);
  const ended = await db
    .select()
    .from(tables.events)
    .where(
      and(
        inArray(tables.events.status, ["published", "sold_out"]),
        lte(tables.events.startsAt, cutoff),
      ),
    );
  let fired = 0;
  for (const event of ended) {
    const result = await runTool("run_afterparty", SYSTEM_CONTEXT, { eventId: event.id });
    if (result.ok) fired++;
  }

  // 3. T-24h: the Cohost drops a hype message in each party chat (once)
  const upcoming = await db
    .select()
    .from(tables.events)
    .where(
      and(
        inArray(tables.events.status, ["published", "sold_out"]),
        gt(tables.events.startsAt, now),
        lte(tables.events.startsAt, new Date(now.getTime() + HYPE_WINDOW_MS)),
      ),
    );
  let hypes = 0;
  for (const event of upcoming) {
    const [already] = await db
      .select({ id: tables.domainEvents.id })
      .from(tables.domainEvents)
      .where(
        and(
          eq(tables.domainEvents.type, "cohost.hyped"),
          eq(tables.domainEvents.subjectId, event.id),
        ),
      );
    if (already) continue;
    await postCohostMessage(event.id, VIBES[event.cohostVibe].hype(event.title));
    await emitDomainEvent({
      type: "cohost.hyped",
      actorId: null,
      subjectType: "event",
      subjectId: event.id,
    });
    hypes++;
  }

  return { deliveredScheduled: due.length, afterpartiesFired: fired, hypesDropped: hypes };
}
