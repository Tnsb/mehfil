/**
 * Booking / roster tools (the Door agent's hands).
 * Seat holding, waitlist, payment hand-off, cancellation with auto-backfill.
 */
import { z } from "zod";
import { db, tables } from "@/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { getPaymentProvider } from "@/payments";
import { assignPersona, assignBringItem } from "@/cohost/vibes";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { eventView, seatsTaken, getEventOrThrow, formatPrice } from "./helpers";

export const bookSeat = defineTool({
  name: "book_seat",
  description:
    "Book a seat at a published event for the current user. If seats are available this reserves one and returns a payment link the guest must complete (free events confirm instantly). If the event is full, the guest joins the waitlist. Answers to the event's checkout questions (e.g. dietary restrictions) can be passed in `answers`.",
  inputSchema: z.object({
    eventId: z.string(),
    answers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Answers keyed by question key, e.g. {\"dietary\": \"vegetarian\"}"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);

    if (event.hostId === userId) return err("Hosts don't need a ticket to their own dinner.");
    if (event.status !== "published" && event.status !== "sold_out")
      return err(`This event is not open for booking (status: ${event.status}).`);
    if (event.startsAt < new Date()) return err("This event has already happened.");

    const [existing] = await db
      .select()
      .from(tables.tickets)
      .where(
        and(
          eq(tables.tickets.eventId, event.id),
          eq(tables.tickets.userId, userId),
          inArray(tables.tickets.status, ["paid", "pending", "waitlisted"]),
        ),
      );
    if (existing) {
      if (existing.status === "paid") return err("You already have a seat at this event.");
      if (existing.status === "waitlisted") return err("You're already on the waitlist.");
      return ok({
        ticketId: existing.id,
        status: "pending",
        paymentUrl: `/pay/${existing.id}`,
        message: "You already reserved a seat — complete payment to lock it in.",
      });
    }

    const taken = await seatsTaken(event.id);
    const full = taken >= event.capacity;

    const ticketId = newId("tkt");
    const [ticket] = await db
      .insert(tables.tickets)
      .values({
        id: ticketId,
        eventId: event.id,
        userId,
        status: full ? "waitlisted" : "pending",
        answers: input.answers ?? {},
      })
      .returning();

    if (full) {
      await emitDomainEvent({
        type: "ticket.waitlisted",
        actorId: userId,
        subjectType: "ticket",
        subjectId: ticketId,
        payload: { eventId: event.id, userId },
      });
      return ok({
        ticketId,
        status: "waitlisted",
        message: `${event.title} is sold out — you're on the waitlist. If a seat opens, you'll be notified immediately.`,
      });
    }

    // free events skip payment entirely
    if (event.priceCents === 0) {
      return await markTicketPaid(ticket.id, userId);
    }

    const provider = getPaymentProvider();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const checkout = await provider.createCheckout(ticket, event, baseUrl);

    await emitDomainEvent({
      type: "ticket.reserved",
      actorId: userId,
      subjectType: "ticket",
      subjectId: ticketId,
      payload: { eventId: event.id, userId, price: formatPrice(event.priceCents) },
    });

    return ok({
      ticketId,
      status: "pending",
      paymentUrl: checkout.url,
      message: `Seat reserved at ${event.title} (${formatPrice(event.priceCents)}). Complete payment at the payment link — the address unlocks right after.`,
    });
  },
});

/**
 * Shared paid-transition: mark paid, emit ticket.paid, flip event to sold_out
 * if that was the last seat. Used by confirm_payment and free-event booking.
 */
export async function markTicketPaid(ticketId: string, actorId: string | null) {
  const [ticket] = await db.select().from(tables.tickets).where(eq(tables.tickets.id, ticketId));
  if (!ticket) return err("Ticket not found.");
  if (ticket.status === "paid") return ok({ ticketId, status: "paid", message: "Already confirmed." });

  const event = await getEventOrThrow(ticket.eventId);

  // joining the party: seat confirmed + personalized invite persona + bring duty
  await db
    .update(tables.tickets)
    .set({
      status: "paid",
      paidAt: new Date(),
      persona: assignPersona(ticketId),
      bringItem: assignBringItem(ticketId),
    })
    .where(eq(tables.tickets.id, ticketId));

  await emitDomainEvent({
    type: "ticket.paid",
    actorId,
    subjectType: "ticket",
    subjectId: ticketId,
    payload: { eventId: event.id, userId: ticket.userId, eventTitle: event.title },
  });

  const taken = await seatsTaken(event.id);
  if (taken >= event.capacity && event.status === "published") {
    await db
      .update(tables.events)
      .set({ status: "sold_out" })
      .where(eq(tables.events.id, event.id));
    await emitDomainEvent({
      type: "event.sold_out",
      actorId: null,
      subjectType: "event",
      subjectId: event.id,
      payload: { title: event.title },
    });
  }

  return ok({
    ticketId,
    status: "paid",
    address: event.locationAddress,
    message: `Confirmed! The address is unlocked: ${event.locationAddress ?? "see event page"}.`,
  });
}

export const confirmPayment = defineTool({
  name: "confirm_payment",
  description:
    "INTERNAL: confirm a ticket payment after the payment provider reports success. Not callable by the chat agent — payment always goes through the checkout flow.",
  inputSchema: z.object({
    ticketId: z.string(),
    providerRef: z.string().optional().describe("Provider session reference (Stripe session id)"),
  }),
  agentCallable: false,
  execute: async (ctx, input) => {
    const [ticket] = await db
      .select()
      .from(tables.tickets)
      .where(eq(tables.tickets.id, input.ticketId));
    if (!ticket) return err("Ticket not found.");
    if (!ctx.isSystem && ctx.userId !== ticket.userId)
      throw new ToolError("This ticket belongs to someone else.");

    const provider = getPaymentProvider();
    if (provider.name !== "mock") {
      if (!input.providerRef) return err("Missing payment reference.");
      const paid = await provider.verifyPayment(input.providerRef);
      if (!paid) return err("Payment not completed yet.");
    }
    return await markTicketPaid(input.ticketId, ctx.userId);
  },
});

export const cancelTicket = defineTool({
  name: "cancel_ticket",
  description:
    "Cancel a ticket. Guests can cancel their own ticket; hosts can cancel any ticket on their event. If a confirmed seat frees up, the oldest waitlisted guest is automatically promoted and notified.",
  inputSchema: z.object({ ticketId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const [ticket] = await db
      .select()
      .from(tables.tickets)
      .where(eq(tables.tickets.id, input.ticketId));
    if (!ticket) return err("Ticket not found.");
    const event = await getEventOrThrow(ticket.eventId);

    if (ticket.userId !== userId && event.hostId !== userId)
      throw new ToolError("You can only cancel your own ticket (or tickets on events you host).");
    if (ticket.status === "cancelled") return err("This ticket is already cancelled.");

    const freedSeat = ticket.status === "paid" || ticket.status === "pending";

    await db
      .update(tables.tickets)
      .set({ status: "cancelled" })
      .where(eq(tables.tickets.id, ticket.id));

    await emitDomainEvent({
      type: "ticket.cancelled",
      actorId: userId,
      subjectType: "ticket",
      subjectId: ticket.id,
      payload: { eventId: event.id, userId: ticket.userId },
    });

    let promoted: string | null = null;
    if (freedSeat) {
      // auto-backfill from the waitlist
      const [next] = await db
        .select()
        .from(tables.tickets)
        .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "waitlisted")))
        .orderBy(asc(tables.tickets.createdAt))
        .limit(1);
      if (next) {
        await db
          .update(tables.tickets)
          .set({ status: "pending" })
          .where(eq(tables.tickets.id, next.id));
        await emitDomainEvent({
          type: "ticket.waitlist_promoted",
          actorId: null,
          subjectType: "ticket",
          subjectId: next.id,
          payload: { eventId: event.id, userId: next.userId },
        });
        promoted = next.id;
      }
      if (event.status === "sold_out" && !promoted) {
        await db
          .update(tables.events)
          .set({ status: "published" })
          .where(eq(tables.events.id, event.id));
      }
    }

    return ok({
      cancelled: ticket.id,
      waitlistPromoted: promoted,
      message: promoted
        ? "Ticket cancelled. The seat was automatically offered to the next guest on the waitlist."
        : "Ticket cancelled.",
    });
  },
});

export const getMyTickets = defineTool({
  name: "get_my_tickets",
  description:
    "List the current user's tickets across all events (upcoming and past), with status and event info. Use to answer 'what am I going to?'",
  inputSchema: z.object({}),
  agentCallable: true,
  execute: async (ctx) => {
    const userId = requireUser(ctx);
    const rows = await db
      .select({ ticket: tables.tickets, event: tables.events })
      .from(tables.tickets)
      .innerJoin(tables.events, eq(tables.tickets.eventId, tables.events.id))
      .where(eq(tables.tickets.userId, userId));

    return ok({
      tickets: rows.map(({ ticket, event }) => ({
        ticketId: ticket.id,
        status: ticket.status,
        answers: ticket.answers,
        event: eventView(event, { includeAddress: ticket.status === "paid" }),
        ...(ticket.status === "pending" ? { paymentUrl: `/pay/${ticket.id}` } : {}),
      })),
    });
  },
});

export const getEventRoster = defineTool({
  name: "get_event_roster",
  description:
    "HOST ONLY: full roster for an event you host — confirmed guests (with dietary answers), pending payments, waitlist, revenue so far. Use to answer 'who's coming Saturday?'",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId && !ctx.isSystem)
      throw new ToolError("Only the host can see the roster.");

    const rows = await db
      .select({ ticket: tables.tickets, guest: tables.users })
      .from(tables.tickets)
      .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
      .where(eq(tables.tickets.eventId, event.id))
      .orderBy(asc(tables.tickets.createdAt));

    const byStatus = (s: string) =>
      rows
        .filter((r) => r.ticket.status === s)
        .map((r) => ({
          ticketId: r.ticket.id,
          name: r.guest.name ?? r.guest.email,
          answers: r.ticket.answers,
          bookedAt: r.ticket.createdAt?.toISOString(),
        }));

    const paid = byStatus("paid");
    return ok({
      event: eventView(event, {
        includeAddress: true,
        seatsLeft: event.capacity - (await seatsTaken(event.id)),
      }),
      confirmed: paid,
      pendingPayment: byStatus("pending"),
      waitlist: byStatus("waitlisted"),
      revenue: formatPrice(paid.length * event.priceCents),
    });
  },
});
