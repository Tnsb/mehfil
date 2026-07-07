/**
 * AfterParty tools — the loop nobody else has.
 * Fired by the scheduler ~12h after an event (or manually by the host),
 * collects feedback while the night is fresh, and summarizes for the host.
 */
import { z } from "zod";
import { db, tables } from "@/db";
import { and, eq } from "drizzle-orm";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow } from "./helpers";

export const runAfterparty = defineTool({
  name: "run_afterparty",
  description:
    "Fire the AfterParty for an event that has happened: marks it completed and sends every confirmed guest a feedback request. Called automatically by the scheduler ~12h after the event, or manually by the host ('wrap up last night's dinner'). Only works on events whose start time has passed.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const event = await getEventOrThrow(input.eventId);
    if (!ctx.isSystem) {
      const userId = requireUser(ctx);
      if (event.hostId !== userId) throw new ToolError("Only the host can fire the AfterParty.");
    }
    if (event.status === "completed") return err("The AfterParty already ran for this event.");
    if (event.status !== "published" && event.status !== "sold_out")
      return err(`Event is ${event.status} — nothing to wrap up.`);
    if (event.startsAt > new Date())
      return err("This event hasn't happened yet. The AfterParty fires after the night.");

    // completedAt anchors the 48h Taps window (opens now, with the reveal)
    await db
      .update(tables.events)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(tables.events.id, event.id));

    // the notifications module reacts to this and messages every attendee
    await emitDomainEvent({
      type: "afterparty.fired",
      actorId: ctx.userId,
      subjectType: "event",
      subjectId: event.id,
      payload: { title: event.title },
    });

    const attendees = await db
      .select()
      .from(tables.tickets)
      .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "paid")));

    return ok({
      eventId: event.id,
      guestsContacted: attendees.length,
      message: `AfterParty fired for "${event.title}" — ${attendees.length} guests asked for feedback while the night is fresh. Check get_afterparty_summary as responses come in.`,
    });
  },
});

export const submitFeedback = defineTool({
  name: "submit_feedback",
  description:
    "Submit the current user's feedback for an event they attended (1–5 stars + optional comment). High ratings are surfaced publicly to the host; low ratings stay private. One submission per ticket.",
  inputSchema: z.object({
    ticketId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const [ticket] = await db
      .select()
      .from(tables.tickets)
      .where(eq(tables.tickets.id, input.ticketId));
    if (!ticket) return err("Ticket not found.");
    if (ticket.userId !== userId) throw new ToolError("That ticket belongs to someone else.");
    if (ticket.status !== "paid") return err("Only confirmed guests can leave feedback.");

    const [existing] = await db
      .select()
      .from(tables.feedback)
      .where(eq(tables.feedback.ticketId, ticket.id));
    if (existing) return err("Feedback was already submitted for this ticket.");

    await db.insert(tables.feedback).values({
      id: newId("fbk"),
      ticketId: ticket.id,
      eventId: ticket.eventId,
      userId,
      rating: input.rating,
      comment: input.comment,
    });

    await emitDomainEvent({
      type: "feedback.submitted",
      actorId: userId,
      subjectType: "feedback",
      subjectId: ticket.id,
      payload: { eventId: ticket.eventId, rating: input.rating },
    });

    return ok({
      message:
        input.rating >= 4
          ? "Thanks! Glad it was a good night — the host will see this. Keep an eye out for their next date."
          : "Thanks for the honesty — this goes privately to the host so the next one is better.",
      rating: input.rating,
    });
  },
});

export const getAfterpartySummary = defineTool({
  name: "get_afterparty_summary",
  description:
    "HOST ONLY: AfterParty summary for a completed event — response rate, average rating, comments (high ratings public, low ratings marked private), and repeat-guest count. Use to answer 'how did last night go?'",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId && !ctx.isSystem)
      throw new ToolError("Only the host can see the AfterParty summary.");

    const attendees = await db
      .select()
      .from(tables.tickets)
      .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "paid")));

    const responses = await db
      .select({ fb: tables.feedback, guest: tables.users })
      .from(tables.feedback)
      .innerJoin(tables.users, eq(tables.feedback.userId, tables.users.id))
      .where(eq(tables.feedback.eventId, event.id));

    // repeat guests: attendees with a paid ticket to any OTHER event by this host
    let repeatGuests = 0;
    for (const t of attendees) {
      const others = await db
        .select({ id: tables.tickets.id })
        .from(tables.tickets)
        .innerJoin(tables.events, eq(tables.tickets.eventId, tables.events.id))
        .where(
          and(
            eq(tables.tickets.userId, t.userId),
            eq(tables.tickets.status, "paid"),
            eq(tables.events.hostId, event.hostId),
          ),
        );
      if (others.length > 1) repeatGuests++;
    }

    const avg =
      responses.length > 0
        ? responses.reduce((s, r) => s + r.fb.rating, 0) / responses.length
        : null;

    return ok({
      event: { id: event.id, title: event.title, status: event.status },
      guests: attendees.length,
      responses: responses.length,
      responseRate:
        attendees.length > 0 ? `${Math.round((responses.length / attendees.length) * 100)}%` : "—",
      averageRating: avg ? Math.round(avg * 10) / 10 : null,
      repeatGuests,
      comments: responses.map((r) => ({
        guest: r.guest.name ?? "Guest",
        rating: r.fb.rating,
        comment: r.fb.comment,
        visibility: r.fb.rating >= 4 ? "public" : "private to you",
      })),
      suggestion:
        avg && avg >= 4
          ? "Guests loved it — a great moment to open the next date. Create the next event and past guests get first access."
          : "Read the private comments before opening the next date.",
    });
  },
});
