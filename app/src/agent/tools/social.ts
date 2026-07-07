/**
 * Taps — the earned social graph, double-blind and intent-matched.
 *
 * Design invariants (see src/lib/taps.ts):
 * - Three intents (vibe / collab / crush); a match requires the SAME intent
 *   both ways. Mismatches and one-way taps are never revealed to anyone.
 * - The window opens at the morning reveal and closes 48h later.
 * - On a match, the Cohost opens a private chat with context (the wingman).
 */
import { z } from "zod";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { postWingmanOpener } from "@/cohost";
import { VIBES } from "@/cohost/vibes";
import { TAP_INTENTS, tapWindow, hoursLeft, matchThread } from "@/lib/taps";
import type { TapIntent, User } from "@/db/schema";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess } from "./helpers";

/** The mutual intent between two people at an event, or null. Never expose one-way taps. */
async function getMutualIntent(
  eventId: string,
  userA: string,
  userB: string,
): Promise<TapIntent | null> {
  const rows = await db
    .select()
    .from(tables.connections)
    .where(
      and(
        eq(tables.connections.eventId, eventId),
        or(
          and(eq(tables.connections.fromUserId, userA), eq(tables.connections.toUserId, userB)),
          and(eq(tables.connections.fromUserId, userB), eq(tables.connections.toUserId, userA)),
        ),
      ),
    );
  const out = rows.find((r) => r.fromUserId === userA);
  const back = rows.find((r) => r.fromUserId === userB);
  return out && back && out.intent === back.intent ? out.intent : null;
}

export const tapConnect = defineTool({
  name: "tap_connect",
  description:
    "Tap someone from a completed event with one of three intents: 'vibe' (friend energy), 'collab' (build/work/run together), or 'crush'. Pure double-blind: nothing is revealed unless they tap you back with the SAME intent — then it's a match, both are notified, and the Cohost opens a private chat for the pair. Taps only work during the 48h window after the morning reveal. NEVER tell a user about someone else's one-way tap.",
  inputSchema: z.object({
    eventId: z.string(),
    toUserId: z.string(),
    intent: z.enum(["vibe", "collab", "crush"]).describe("vibe = friend, collab = work/projects, crush = romantic"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    if (userId === input.toUserId) return err("Love that confidence, but you can't tap yourself.");
    const event = await getEventOrThrow(input.eventId);

    const window = tapWindow(event);
    if (window.state === "locked") return err("Taps unlock at the morning reveal, with the roll.");
    if (window.state === "closed")
      return err("The Taps window closed 48 hours after the reveal. What happened at the table stays at the table.");

    if (!(await hasPartyAccess(userId, event)) || !(await hasPartyAccess(input.toUserId, event)))
      throw new ToolError("Taps only work between people who were actually at the table.");

    const [existing] = await db
      .select()
      .from(tables.connections)
      .where(
        and(
          eq(tables.connections.eventId, event.id),
          eq(tables.connections.fromUserId, userId),
          eq(tables.connections.toUserId, input.toUserId),
        ),
      );
    if (existing) return err("You already used your tap on them. It stands.");

    const intent = input.intent as TapIntent;
    await db.insert(tables.connections).values({
      id: newId("con"),
      eventId: event.id,
      fromUserId: userId,
      toUserId: input.toUserId,
      intent,
    });

    const mutualIntent = await getMutualIntent(event.id, userId, input.toUserId);

    if (mutualIntent) {
      const people = await db
        .select()
        .from(tables.users)
        .where(inArray(tables.users.id, [userId, input.toUserId]));
      const me = people.find((p) => p.id === userId) as User;
      const them = people.find((p) => p.id === input.toUserId) as User;

      // the wingman opens the private chat before either person sees the match
      await postWingmanOpener(event, me, them, mutualIntent);

      // the rule notifies both sides
      await emitDomainEvent({
        type: "connection.mutual",
        actorId: userId,
        subjectType: "event",
        subjectId: event.id,
        payload: { userA: userId, userB: input.toUserId, intent: mutualIntent },
      });

      const meta = TAP_INTENTS[mutualIntent];
      return ok({
        mutual: true,
        intent: mutualIntent,
        chatUrl: `/match/${event.id}/${input.toUserId}`,
        message: `${meta.emoji} It's a ${meta.label} match — they tapped you too. The Cohost already opened your chat.`,
      });
    }

    await emitDomainEvent({
      type: "connection.tapped",
      actorId: userId,
      subjectType: "event",
      subjectId: event.id,
    });
    return ok({
      mutual: false,
      message: `Tap sealed. If they tap you back as ${TAP_INTENTS[intent].emoji} ${TAP_INTENTS[intent].label} before the window closes (${hoursLeft(window.closesAt)}h left), you'll both know. Otherwise, nobody ever will.`,
    });
  },
});

export const getMatchChat = defineTool({
  name: "get_match_chat",
  description:
    "Read the private chat between the current user and someone they MATCHED with (mutual same-intent tap) at an event. The Cohost's wingman opener is the first message.",
  inputSchema: z.object({
    eventId: z.string(),
    otherUserId: z.string(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    const intent = await getMutualIntent(event.id, userId, input.otherUserId);
    if (!intent) throw new ToolError("No match here.");

    const thread = matchThread(userId, input.otherUserId);
    const rows = await db
      .select({ msg: tables.messages, author: tables.users })
      .from(tables.messages)
      .leftJoin(tables.users, eq(tables.messages.userId, tables.users.id))
      .where(and(eq(tables.messages.eventId, event.id), eq(tables.messages.thread, thread)))
      .orderBy(asc(tables.messages.createdAt));

    const vibe = VIBES[event.cohostVibe];
    return ok({
      intent,
      intentLabel: `${TAP_INTENTS[intent].emoji} ${TAP_INTENTS[intent].label}`,
      messages: rows.map(({ msg, author }) => ({
        id: msg.id,
        kind: msg.kind,
        author: msg.kind === "cohost" ? `${vibe.emoji} ${vibe.name}` : (author?.name ?? "Guest"),
        isSelf: msg.userId === userId,
        body: msg.body,
        at: msg.createdAt?.toISOString(),
      })),
    });
  },
});

export const postMatchMessage = defineTool({
  name: "post_match_message",
  description:
    "Send a message in the current user's private match chat with someone they matched with at an event.",
  inputSchema: z.object({
    eventId: z.string(),
    otherUserId: z.string(),
    body: z.string().min(1).max(1000),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    const intent = await getMutualIntent(event.id, userId, input.otherUserId);
    if (!intent) throw new ToolError("No match here.");

    await db.insert(tables.messages).values({
      id: newId("msg"),
      eventId: event.id,
      thread: matchThread(userId, input.otherUserId),
      userId,
      kind: "chat",
      body: input.body,
    });
    return ok({ posted: true });
  },
});

export const getMyConnections = defineTool({
  name: "get_my_connections",
  description:
    "List the current user's MATCHES (mutual same-intent taps) with intent, the event where they met, and the private chat link. One-way taps are never included or mentioned.",
  inputSchema: z.object({}),
  agentCallable: true,
  execute: async (ctx) => {
    const userId = requireUser(ctx);
    const mine = await db
      .select()
      .from(tables.connections)
      .where(
        or(eq(tables.connections.fromUserId, userId), eq(tables.connections.toUserId, userId)),
      );

    const mutuals: { otherId: string; eventId: string; intent: TapIntent }[] = [];
    for (const c of mine.filter((c) => c.fromUserId === userId)) {
      const back = mine.find(
        (r) => r.eventId === c.eventId && r.fromUserId === c.toUserId && r.toUserId === userId,
      );
      if (back && back.intent === c.intent) {
        mutuals.push({ otherId: c.toUserId, eventId: c.eventId, intent: c.intent });
      }
    }
    if (mutuals.length === 0) return ok({ connections: [] });

    const people = await db
      .select()
      .from(tables.users)
      .where(inArray(tables.users.id, mutuals.map((m) => m.otherId)));
    const events = await db
      .select()
      .from(tables.events)
      .where(inArray(tables.events.id, mutuals.map((m) => m.eventId)));

    return ok({
      connections: mutuals.map((m) => ({
        name: people.find((p) => p.id === m.otherId)?.name ?? "Guest",
        intent: `${TAP_INTENTS[m.intent].emoji} ${TAP_INTENTS[m.intent].label}`,
        metAt: events.find((e) => e.id === m.eventId)?.title ?? "an event",
        chatUrl: `/match/${m.eventId}/${m.otherId}`,
      })),
    });
  },
});

export const getMyWrapped = defineTool({
  name: "get_my_wrapped",
  description:
    "Wrapped-style stats for the current user: nights out, distinct hosts, most-visited host ('your 7th night at Maya's'), people met via mutual taps, One Shots taken. Use for shareable recap cards and personalization.",
  inputSchema: z.object({}),
  agentCallable: true,
  execute: async (ctx) => {
    const userId = requireUser(ctx);
    const attended = await db
      .select({ ticket: tables.tickets, event: tables.events })
      .from(tables.tickets)
      .innerJoin(tables.events, eq(tables.tickets.eventId, tables.events.id))
      .where(and(eq(tables.tickets.userId, userId), eq(tables.tickets.status, "paid")));

    const hosted = await db
      .select({ id: tables.events.id })
      .from(tables.events)
      .where(and(eq(tables.events.hostId, userId), eq(tables.events.status, "completed")));

    const byHost = new Map<string, number>();
    for (const { event } of attended)
      byHost.set(event.hostId, (byHost.get(event.hostId) ?? 0) + 1);
    let topHost: { name: string; count: number } | null = null;
    if (byHost.size > 0) {
      const [hostId, count] = [...byHost.entries()].sort((a, b) => b[1] - a[1])[0];
      const [host] = await db.select().from(tables.users).where(eq(tables.users.id, hostId));
      topHost = { name: host?.name ?? "a host", count };
    }

    const shots = await db
      .select({ id: tables.photos.id })
      .from(tables.photos)
      .where(eq(tables.photos.userId, userId));

    const taps = await db
      .select()
      .from(tables.connections)
      .where(
        or(eq(tables.connections.fromUserId, userId), eq(tables.connections.toUserId, userId)),
      );
    const mutualCount = taps.filter(
      (c) =>
        c.fromUserId === userId &&
        taps.some(
          (r) =>
            r.eventId === c.eventId &&
            r.fromUserId === c.toUserId &&
            r.toUserId === userId &&
            r.intent === c.intent,
        ),
    ).length;

    return ok({
      nightsOut: attended.length,
      nightsHosted: hosted.length,
      distinctHosts: byHost.size,
      topHost,
      oneShotsTaken: shots.length,
      peopleMet: mutualCount,
    });
  },
});
