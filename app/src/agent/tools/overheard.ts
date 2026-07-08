/**
 * Overheard — anonymous quotes from the night that become typographic cards
 * at the Reveal. Anonymized always; host can turn on moderation.
 */
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess } from "./helpers";

export const submitOverheard = defineTool({
  name: "submit_overheard",
  description:
    "Anonymously submit something overheard at an event ('someone just said…'). The best quotes become shareable Overheard cards at the morning Reveal. Fully anonymous — the submitter is never shown. Only works for people at the event, from kickoff until the Reveal.",
  inputSchema: z.object({
    eventId: z.string(),
    quote: z.string().min(3).max(280),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("Overheard is for people who are actually at the event.");
    if (event.startsAt > new Date())
      return err("Nothing to overhear yet — the night hasn't started.");

    await db.insert(tables.overheard).values({
      id: newId("ovh"),
      eventId: event.id,
      submitterId: userId, // moderation/abuse trail only — never displayed
      quote: input.quote.trim(),
      status: event.moderateOverheard ? "pending" : "featured",
    });

    await emitDomainEvent({
      type: "overheard.submitted",
      actorId: null, // anonymous by design, even in the log
      subjectType: "event",
      subjectId: event.id,
    });

    return ok({
      message: event.moderateOverheard
        ? "Heard. It goes to the host for a quick look, then the Reveal."
        : "Heard. Sealed until the Reveal. 🤫",
    });
  },
});

export const getOverheard = defineTool({
  name: "get_overheard",
  description:
    "Get an event's Overheard quotes (attendees only). Featured quotes appear at the Reveal; the host also sees pending ones awaiting moderation. Quotes are always anonymous.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("Overheard is for people who were at the event.");

    const isHost = event.hostId === userId;
    const rows = await db
      .select()
      .from(tables.overheard)
      .where(eq(tables.overheard.eventId, event.id))
      .orderBy(desc(tables.overheard.createdAt));

    return ok({
      featured: rows
        .filter((q) => q.status === "featured")
        .map((q) => ({ id: q.id, quote: q.quote })),
      ...(isHost
        ? {
            pending: rows
              .filter((q) => q.status === "pending")
              .map((q) => ({ id: q.id, quote: q.quote })),
          }
        : {}),
    });
  },
});

export const moderateOverheard = defineTool({
  name: "moderate_overheard",
  description: "HOST ONLY: feature or hide an Overheard quote.",
  inputSchema: z.object({
    quoteId: z.string(),
    action: z.enum(["feature", "hide"]),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const [quote] = await db
      .select()
      .from(tables.overheard)
      .where(eq(tables.overheard.id, input.quoteId));
    if (!quote) return err("Quote not found.");
    const event = await getEventOrThrow(quote.eventId);
    if (event.hostId !== userId) throw new ToolError("Only the host moderates Overheard.");

    await db
      .update(tables.overheard)
      .set({ status: input.action === "feature" ? "featured" : "hidden" })
      .where(eq(tables.overheard.id, quote.id));

    return ok({ message: input.action === "feature" ? "Featured for the Reveal." : "Hidden." });
  },
});
