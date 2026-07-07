/**
 * Generic activity + discovery tools. `get_my_activity` reads the append-only
 * domain-event log, so the agent can answer "based on my last N dinners…"
 * questions for ANY feature without bespoke queries.
 */
import { z } from "zod";
import { db, tables } from "@/db";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { defineTool, ok, requireUser } from "../types";
import { eventView, seatsTaken } from "./helpers";

export const getMyActivity = defineTool({
  name: "get_my_activity",
  description:
    "The current user's recent activity from the append-only event log: events created/published, seats booked, feedback given, etc. Use for personalization ('based on your last few dinners…') and 'what happened recently?' questions.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(20),
    types: z
      .array(z.string())
      .optional()
      .describe("Filter by domain event types, e.g. ['ticket.paid', 'event.published']"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const conditions = [eq(tables.domainEvents.actorId, userId)];
    if (input.types?.length) conditions.push(inArray(tables.domainEvents.type, input.types));

    const rows = await db
      .select()
      .from(tables.domainEvents)
      .where(and(...conditions))
      .orderBy(desc(tables.domainEvents.createdAt))
      .limit(input.limit);

    return ok({
      activity: rows.map((r) => ({
        type: r.type,
        subject: `${r.subjectType}:${r.subjectId}`,
        payload: r.payload,
        at: r.createdAt?.toISOString(),
      })),
    });
  },
});

export const discoverEvents = defineTool({
  name: "discover_events",
  description:
    "List upcoming published events anyone can book: title, vibe, price, seats left, date, and public location hint (never the address). Use when a guest asks 'what's happening?' or wants something to attend.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(12),
  }),
  agentCallable: true,
  execute: async (_ctx, input) => {
    const rows = await db
      .select()
      .from(tables.events)
      .where(
        and(
          inArray(tables.events.status, ["published", "sold_out"]),
          gt(tables.events.startsAt, new Date()),
        ),
      )
      .orderBy(tables.events.startsAt)
      .limit(input.limit);

    const result = [];
    for (const event of rows) {
      result.push(
        eventView(event, {
          includeAddress: false,
          seatsLeft: event.capacity - (await seatsTaken(event.id)),
        }),
      );
    }
    return ok({ events: result });
  },
});
