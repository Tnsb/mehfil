/**
 * Party chat tools — the room where the AI Cohost lives.
 * Access: the host + paid guests only (the chat is behind the door).
 */
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { maybeCohostReply } from "@/cohost";
import { VIBES, VIBE_OPTIONS } from "@/cohost/vibes";
import type { CohostVibe } from "@/db/schema";
import { defineTool, ok, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess } from "./helpers";

export const getPartyChat = defineTool({
  name: "get_party_chat",
  description:
    "Read the party group chat for an event (host + paid guests only). Includes messages from the AI Cohost. Use to answer 'what's happening in the chat?'",
  inputSchema: z.object({
    eventId: z.string(),
    limit: z.number().int().min(1).max(200).default(80),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("The party chat is for confirmed guests only.");

    const rows = await db
      .select({ msg: tables.messages, author: tables.users })
      .from(tables.messages)
      .leftJoin(tables.users, eq(tables.messages.userId, tables.users.id))
      .where(and(eq(tables.messages.eventId, event.id), isNull(tables.messages.thread)))
      .orderBy(asc(tables.messages.createdAt))
      .limit(input.limit);

    const vibe = VIBES[event.cohostVibe];
    return ok({
      cohost: { vibe: event.cohostVibe, name: vibe.name, emoji: vibe.emoji },
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

export const postPartyMessage = defineTool({
  name: "post_party_message",
  description:
    "Post a message to an event's party chat on behalf of the current user (host + paid guests only). The AI Cohost may reply — it answers questions like 'what's the address again?'.",
  inputSchema: z.object({
    eventId: z.string(),
    body: z.string().min(1).max(1000),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("The party chat is for confirmed guests only.");

    await db.insert(tables.messages).values({
      id: newId("msg"),
      eventId: event.id,
      userId,
      kind: "chat",
      body: input.body,
    });

    await emitDomainEvent({
      type: "party.message",
      actorId: userId,
      subjectType: "event",
      subjectId: event.id,
    });

    const reply = await maybeCohostReply(event, ctx.name ?? "guest", input.body);
    return ok({
      posted: true,
      cohostReplied: !!reply,
      ...(reply ? { cohostSaid: reply.body } : {}),
    });
  },
});

export const setCohostVibe = defineTool({
  name: "set_cohost_vibe",
  description: `HOST ONLY: set the AI Cohost's personality for an event. Options: ${VIBE_OPTIONS.map((v) => `"${v.key}" (${v.name})`).join(", ")}.`,
  inputSchema: z.object({
    eventId: z.string(),
    vibe: z.enum(["chaotic_bestie", "formal_butler", "hype_man"]),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId) throw new ToolError("Only the host picks the Cohost's vibe.");

    await db
      .update(tables.events)
      .set({ cohostVibe: input.vibe as CohostVibe })
      .where(eq(tables.events.id, event.id));

    const vibe = VIBES[input.vibe as CohostVibe];
    return ok({ message: `Cohost is now ${vibe.emoji} ${vibe.name}.` });
  },
});
