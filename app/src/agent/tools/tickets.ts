/**
 * Booking / roster tools (the Door agent's hands).
 * Seat holding, waitlist, payment hand-off, cancellation with auto-backfill.
 */
import { z } from "zod";
import { db, tables } from "@/db";
import { and, asc, eq, inArray, ne, isNotNull } from "drizzle-orm";
import { newId, newToken } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { getPaymentProvider } from "@/payments";
import { assignPersona, assignBringItem } from "@/cohost/vibes";
import { teamFromVibe } from "@/themes";
import type { Event, TicketKind } from "@/db/schema";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { eventView, seatsTaken, getEventOrThrow, formatPrice } from "./helpers";

/** mystery = 20% off (blind); duo = 10% off per seat, buys two */
export function effectivePriceCents(event: Event, kind: TicketKind): number {
  if (kind === "mystery") return Math.round(event.priceCents * 0.8);
  if (kind === "duo_lead") return Math.round(event.priceCents * 0.9) * 2;
  if (kind === "duo_guest") return 0; // covered by the lead
  return event.priceCents;
}

/** Is this user a past guest of the event's show (or its parent event)? */
async function hasFirstAccess(userId: string, event: Event): Promise<boolean> {
  const priorEventIds: string[] = [];
  if (event.parentEventId) priorEventIds.push(event.parentEventId);
  if (event.showId) {
    const siblings = await db
      .select({ id: tables.events.id })
      .from(tables.events)
      .where(and(eq(tables.events.showId, event.showId), ne(tables.events.id, event.id)));
    priorEventIds.push(...siblings.map((s) => s.id));
  }
  if (priorEventIds.length === 0) return false;
  const [prior] = await db
    .select({ id: tables.tickets.id })
    .from(tables.tickets)
    .where(
      and(
        eq(tables.tickets.userId, userId),
        eq(tables.tickets.status, "paid"),
        inArray(tables.tickets.eventId, priorEventIds),
      ),
    );
  return !!prior;
}

export const bookSeat = defineTool({
  name: "book_seat",
  description:
    "Book a seat at a published event for the current user. Kinds: 'standard'; 'mystery' (the one blind seat, 20% off, only if the host enabled it); 'duo' (two seats at 10% off each — returns a claim link for a +1 who must be NEW to plot). Free events confirm instantly unless they carry a refundable deposit (hold released at door check-in). Full events join the waitlist. Pass vibeAnswers from the vibe-check quiz, acceptWaiver=true for events requiring one (e.g. run clubs), and referredBy when the guest came through someone's referral link.",
  inputSchema: z.object({
    eventId: z.string(),
    answers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Answers keyed by question key, e.g. {\"dietary\": \"vegetarian\"}"),
    kind: z.enum(["standard", "mystery", "duo"]).default("standard"),
    vibeAnswers: z
      .record(z.string(), z.string())
      .optional()
      .describe("Vibe-check quiz answers keyed by question id"),
    acceptWaiver: z.boolean().optional(),
    referredBy: z.string().optional().describe("User id from a referral link"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);

    if (event.hostId === userId) return err("Hosts don't need a ticket to their own night.");
    if (event.status !== "published" && event.status !== "sold_out")
      return err(`This event is not open for booking (status: ${event.status}).`);
    if (event.startsAt < new Date()) return err("This event has already happened.");

    // drop mechanics: early-access window for past guests of the show
    if (event.publicAt && event.publicAt > new Date() && !(await hasFirstAccess(userId, event))) {
      return err(
        `Early access: this drop opens to everyone at ${event.publicAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Guests from previous episodes get first dibs.`,
      );
    }

    // waivers for physical events (run clubs)
    const needsWaiver = event.template === "run_club";
    if (needsWaiver && !input.acceptWaiver)
      return err(
        "This event requires accepting the activity waiver (you confirm you're participating at your own risk). Pass acceptWaiver=true.",
      );

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

    // resolve kind
    let kind: TicketKind = "standard";
    if (input.kind === "mystery") {
      if (!event.mysterySeat) return err("This event doesn't have a mystery seat.");
      const [takenMystery] = await db
        .select({ id: tables.tickets.id })
        .from(tables.tickets)
        .where(
          and(
            eq(tables.tickets.eventId, event.id),
            eq(tables.tickets.kind, "mystery"),
            inArray(tables.tickets.status, ["paid", "pending"]),
          ),
        );
      if (takenMystery) return err("The mystery seat is gone — someone braver got there first.");
      kind = "mystery";
    } else if (input.kind === "duo") {
      if (!event.duoTickets) return err("This event doesn't offer duo tickets.");
      kind = "duo_lead";
    }

    const seatsNeeded = kind === "duo_lead" ? 2 : 1;
    const taken = await seatsTaken(event.id);
    const full = taken + seatsNeeded > event.capacity;

    if (full && kind !== "standard")
      return err("Not enough seats left for that — a standard seat may still fit.");

    const ticketId = newId("tkt");
    const [ticket] = await db
      .insert(tables.tickets)
      .values({
        id: ticketId,
        eventId: event.id,
        userId,
        status: full ? "waitlisted" : "pending",
        answers: input.answers ?? {},
        kind,
        vibeAnswers: input.vibeAnswers ?? null,
        team: input.vibeAnswers ? teamFromVibe(input.vibeAnswers) : null,
        waiverAcceptedAt: needsWaiver ? new Date() : null,
        referredBy: input.referredBy ?? null,
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

    const dueCents =
      event.priceCents > 0 ? effectivePriceCents(event, kind) : event.depositCents;

    // free events with no deposit confirm instantly
    if (dueCents === 0) {
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
      payload: { eventId: event.id, userId, price: formatPrice(dueCents), kind },
    });

    const isDeposit = event.priceCents === 0;
    return ok({
      ticketId,
      status: "pending",
      kind,
      paymentUrl: checkout.url,
      message: isDeposit
        ? `Seat reserved at ${event.title} with a ${formatPrice(dueCents)} refundable hold — it comes back the moment you check in at the door.`
        : `Seat${kind === "duo_lead" ? "s" : ""} reserved at ${event.title} (${formatPrice(dueCents)}${kind === "mystery" ? ", mystery discount applied" : kind === "duo_lead" ? " for two, duo discount applied" : ""}). Complete payment at the payment link — the address unlocks right after.`,
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

  // bib numbers for run-club episodes
  let bibNumber: number | null = null;
  if (event.template === "run_club") {
    const paid = await db
      .select({ id: tables.tickets.id })
      .from(tables.tickets)
      .where(
        and(
          eq(tables.tickets.eventId, event.id),
          eq(tables.tickets.status, "paid"),
          isNotNull(tables.tickets.bibNumber),
        ),
      );
    bibNumber = paid.length + 1;
  }

  // joining the party: seat confirmed + personalized invite persona + bring duty
  await db
    .update(tables.tickets)
    .set({
      status: "paid",
      paidAt: new Date(),
      persona: assignPersona(ticketId),
      bringItem: assignBringItem(ticketId),
      // free events with a deposit: the hold is now in place until check-in
      depositStatus: event.priceCents === 0 && event.depositCents > 0 ? "held" : null,
      bibNumber,
    })
    .where(eq(tables.tickets.id, ticketId));

  // duo: create the +1's claimable seat alongside the lead's
  let duoClaimUrl: string | null = null;
  if (ticket.kind === "duo_lead") {
    const claimCode = newToken().slice(0, 12);
    await db.insert(tables.tickets).values({
      id: newId("tkt"),
      eventId: event.id,
      userId: ticket.userId, // parked on the lead until claimed
      status: "paid",
      kind: "duo_guest",
      claimCode,
      answers: {},
    });
    duoClaimUrl = `/claim/${claimCode}`;
  }

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
    ...(duoClaimUrl ? { duoClaimUrl } : {}),
    message: duoClaimUrl
      ? `Confirmed for two! The address is unlocked: ${event.locationAddress ?? "see event page"}. Send your +1 the claim link — they must be new to plot: ${duoClaimUrl}`
      : `Confirmed! The address is unlocked: ${event.locationAddress ?? "see event page"}.`,
  });
}

export const claimDuoSeat = defineTool({
  name: "claim_duo_seat",
  description:
    "Claim the +1 seat of a duo ticket using its claim code. The claimer must be NEW to plot (no previous paid tickets) — duo tickets exist to bring new people in.",
  inputSchema: z.object({ claimCode: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const [seat] = await db
      .select()
      .from(tables.tickets)
      .where(and(eq(tables.tickets.claimCode, input.claimCode), eq(tables.tickets.kind, "duo_guest")));
    if (!seat) return err("That claim link isn't valid (or was already used).");
    if (seat.userId === userId) return err("You bought this duo — send the link to your +1.");

    const prior = await db
      .select({ id: tables.tickets.id })
      .from(tables.tickets)
      .where(and(eq(tables.tickets.userId, userId), eq(tables.tickets.status, "paid")));
    if (prior.length > 0)
      return err("Duo +1 seats are for people new to plot — you're already one of us. Book your own seat!");

    const event = await getEventOrThrow(seat.eventId);
    await db
      .update(tables.tickets)
      .set({
        userId,
        claimCode: null,
        persona: assignPersona(seat.id),
        bringItem: assignBringItem(seat.id),
        paidAt: new Date(),
      })
      .where(eq(tables.tickets.id, seat.id));

    await emitDomainEvent({
      type: "ticket.paid",
      actorId: userId,
      subjectType: "ticket",
      subjectId: seat.id,
      payload: { eventId: event.id, userId, eventTitle: event.title, duoClaim: true },
    });

    return ok({
      ticketId: seat.id,
      address: event.locationAddress,
      message: `Welcome to plot! You're in at ${event.title}. Address: ${event.locationAddress ?? "see event page"}.`,
    });
  },
});

export const checkInGuest = defineTool({
  name: "check_in_guest",
  description:
    "Check a guest in at the door (host can check in anyone; guests can self check-in once the event starts). Releases their refundable deposit if one was held and unlocks their One Shot.",
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

    const isHost = event.hostId === userId;
    if (!isHost && ticket.userId !== userId)
      throw new ToolError("You can only check in yourself (hosts can check in anyone).");
    if (!isHost && event.startsAt > new Date())
      return err("Self check-in opens when the night starts.");
    if (ticket.status !== "paid") return err("Only confirmed guests can check in.");
    if (ticket.checkedInAt) return err("Already checked in.");

    const releasingDeposit = ticket.depositStatus === "held";
    await db
      .update(tables.tickets)
      .set({
        checkedInAt: new Date(),
        ...(releasingDeposit ? { depositStatus: "released" as const } : {}),
      })
      .where(eq(tables.tickets.id, ticket.id));

    await emitDomainEvent({
      type: "ticket.checked_in",
      actorId: userId,
      subjectType: "ticket",
      subjectId: ticket.id,
      payload: { eventId: event.id, userId: ticket.userId, depositReleased: releasingDeposit },
    });

    return ok({
      checkedIn: true,
      depositReleased: releasingDeposit,
      message: releasingDeposit
        ? "Checked in — the deposit hold is released. One Shot unlocked. 📸"
        : "Checked in. One Shot unlocked. 📸",
    });
  },
});

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
          kind: r.ticket.kind,
          team: r.ticket.team,
          bibNumber: r.ticket.bibNumber,
          checkedIn: !!r.ticket.checkedInAt,
          deposit: r.ticket.depositStatus,
          unclaimedDuoSeat: r.ticket.kind === "duo_guest" && !!r.ticket.claimCode,
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
      revenue: formatPrice(
        rows
          .filter((r) => r.ticket.status === "paid")
          .reduce((sum, r) => sum + effectivePriceCents(event, r.ticket.kind), 0),
      ),
    });
  },
});
