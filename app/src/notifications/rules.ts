/**
 * Notification rules: domain event in → zero or more notifications out.
 *
 * This file self-registers on the bus (imported lazily by the bus on first
 * emit). To make a new domain event produce a notification, add a case here —
 * tools and UI don't change.
 */
import { subscribe } from "@/events/bus";
import { notify } from "./deliver";
import { db, tables } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { postCohostMessage } from "@/cohost";
import { VIBES, SUPERLATIVES } from "@/cohost/vibes";
import { TAP_INTENTS } from "@/lib/taps";
import type { TapIntent } from "@/db/schema";

async function getEvent(eventId: string) {
  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, eventId));
  return event;
}

subscribe(async (e) => {
  switch (e.type) {
    /* Guest paid: confirm + reveal address, notify host, schedule T-24h reminder. */
    case "ticket.paid": {
      const eventId = e.payload?.eventId as string;
      const guestId = e.payload?.userId as string;
      const event = await getEvent(eventId);
      if (!event) return;

      await notify({
        userId: guestId,
        templateKey: "ticket.confirmed",
        title: `You're in: ${event.title}`,
        body: `Seat confirmed. The address is now unlocked on the event page.`,
        href: `/e/${event.id}`,
      });
      await notify({
        userId: event.hostId,
        templateKey: "host.seat_sold",
        title: `Seat sold — ${event.title}`,
        body: `A guest just booked. Check your roster.`,
        href: `/host/events/${event.id}`,
      });

      const reminderAt = new Date(event.startsAt.getTime() - 24 * 60 * 60 * 1000);
      if (reminderAt > new Date()) {
        await notify({
          userId: guestId,
          templateKey: "event.reminder",
          title: `Tomorrow: ${event.title}`,
          body: `${event.vibe ?? "It's happening."} Doors at ${event.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
          href: `/e/${event.id}`,
          scheduledFor: reminderAt,
        });
      }

      // the Cohost welcomes the new guest into the party chat
      const [row] = await db
        .select({ ticket: tables.tickets, guest: tables.users })
        .from(tables.tickets)
        .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
        .where(eq(tables.tickets.id, e.subjectId));
      if (row) {
        const vibe = VIBES[event.cohostVibe];
        await postCohostMessage(
          event.id,
          vibe.welcome(
            row.guest.name ?? "mystery guest",
            row.ticket.bringItem ?? "good energy",
            row.ticket.persona ? `${row.ticket.persona.emoji} ${row.ticket.persona.card}` : "🃏 The Wildcard",
          ),
        );
      }
      return;
    }

    /* A sequel went live: everyone from the show's past episodes gets first access. */
    case "event.published": {
      const event = await getEvent(e.subjectId);
      if (!event) return;
      const priorEventIds: string[] = [];
      if (event.parentEventId) priorEventIds.push(event.parentEventId);
      if (event.showId) {
        const siblings = await db
          .select({ id: tables.events.id })
          .from(tables.events)
          .where(eq(tables.events.showId, event.showId));
        priorEventIds.push(...siblings.map((s) => s.id).filter((id) => id !== event.id));
      }
      if (priorEventIds.length === 0) return;
      const pastGuests = await db
        .select({ userId: tables.tickets.userId })
        .from(tables.tickets)
        .where(
          and(
            inArray(tables.tickets.eventId, priorEventIds),
            eq(tables.tickets.status, "paid"),
          ),
        );
      const ep = event.episodeNumber ? `S${event.season ?? 1}E${event.episodeNumber} — ` : "";
      for (const g of new Set(pastGuests.map((r) => r.userId))) {
        await notify({
          userId: g,
          templateKey: "runback.first_access",
          title: `New episode: ${ep}${event.title}`,
          body: event.publicAt
            ? `You were there last time — first access is yours until ${event.publicAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, then the link goes wide.`
            : `You were there last time — you get first access before the link goes wide.`,
          href: `/e/${event.id}`,
        });
      }
      return;
    }

    /* A guest checked in at the door — deposit released. */
    case "ticket.checked_in": {
      const guestId = e.payload?.userId as string;
      const eventId = e.payload?.eventId as string;
      if (!e.payload?.depositReleased) return;
      const event = await getEvent(eventId);
      if (!event || !guestId) return;
      await notify({
        userId: guestId,
        templateKey: "deposit.released",
        title: `Deposit released ✓ ${event.title}`,
        body: `You showed up, the hold is gone. Enjoy the night.`,
        href: `/party/${event.id}`,
      });
      return;
    }

    /* A Tap matched (same intent both ways): both people get the good news. */
    case "connection.mutual": {
      const event = await getEvent(e.subjectId);
      const userA = e.payload?.userA as string;
      const userB = e.payload?.userB as string;
      const intent = (e.payload?.intent as TapIntent) ?? "vibe";
      if (!event || !userA || !userB) return;
      const meta = TAP_INTENTS[intent];
      const people = await db
        .select()
        .from(tables.users)
        .where(inArray(tables.users.id, [userA, userB]));
      const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "someone great";
      for (const [me, them] of [
        [userA, userB],
        [userB, userA],
      ] as const) {
        await notify({
          userId: me,
          templateKey: "connection.mutual",
          title: `${meta.emoji} It's a ${meta.label} match with ${nameOf(them)}`,
          body: `You both tapped after ${event.title} — neither of you would've known otherwise. The Cohost already opened your chat.`,
          href: `/match/${event.id}/${them}`,
        });
      }
      return;
    }

    /* Event sold out: tell the host. */
    case "event.sold_out": {
      const event = await getEvent(e.subjectId);
      if (!event) return;
      await notify({
        userId: event.hostId,
        templateKey: "host.sold_out",
        title: `Sold out: ${event.title}`,
        body: `Every seat is taken. New bookings will join the waitlist.`,
        href: `/host/events/${event.id}`,
      });
      return;
    }

    /* A waitlisted guest got promoted into a freed seat. */
    case "ticket.waitlist_promoted": {
      const eventId = e.payload?.eventId as string;
      const guestId = e.payload?.userId as string;
      const event = await getEvent(eventId);
      if (!event) return;
      await notify({
        userId: guestId,
        templateKey: "waitlist.promoted",
        title: `A seat opened up: ${event.title}`,
        body: `You're off the waitlist — complete payment to lock your seat.`,
        href: `/e/${event.id}`,
      });
      return;
    }

    /* AfterParty fired: the Reveal — title card, roll, awards, Taps, feedback. */
    case "afterparty.fired": {
      const event = await getEvent(e.subjectId);
      if (!event) return;
      const titleCard = (e.payload?.titleCard as string) ?? event.titleCard;
      const attendees = await db
        .select({ ticket: tables.tickets, guest: tables.users })
        .from(tables.tickets)
        .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
        .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "paid")));

      for (const { guest } of attendees) {
        await notify({
          userId: guest.id,
          templateKey: "afterparty.drop",
          title: titleCard ? `Last night has a name: "${titleCard}"` : `The roll developed ✨ ${event.title}`,
          body: `Your One Shot reveal, the awards, Overheard cards — and Taps are open for 48 hours. It's all in the Reveal.`,
          href: `/drop/${event.id}`,
        });
      }
      await notify({
        userId: event.hostId,
        templateKey: "afterparty.drop",
        title: `The Reveal is live: ${event.title}`,
        body: `Photos developed and feedback is rolling in. One tap to run it back.`,
        href: `/drop/${event.id}`,
      });

      // the Cohost crowns superlatives: real votes first, improvised when the ballots are empty
      if (attendees.length > 0) {
        const vibe = VIBES[event.cohostVibe];
        const { tallySuperlatives } = await import("@/agent/tools/night");
        const results = await tallySuperlatives(event.id);
        let lines: string[];
        if (results.length > 0) {
          lines = results.map(
            (r) => `${r.category}: ${r.winnerName} (${r.votes} vote${r.votes === 1 ? "" : "s"})`,
          );
        } else {
          const { getTheme } = await import("@/themes");
          const cats = getTheme(event.theme).superlatives.length
            ? getTheme(event.theme).superlatives
            : SUPERLATIVES;
          const shuffled = [...attendees].sort((a, b) => a.ticket.id.localeCompare(b.ticket.id));
          lines = cats
            .slice(0, Math.min(attendees.length, 4))
            .map((award, i) => `${award}: ${shuffled[i % shuffled.length].guest.name ?? "a legend"}`);
        }
        await postCohostMessage(event.id, vibe.superlatives(lines));
      }
      return;
    }

    /* Feedback arrived: tell the host. */
    case "feedback.submitted": {
      const eventId = e.payload?.eventId as string;
      const rating = e.payload?.rating as number;
      const event = await getEvent(eventId);
      if (!event) return;
      await notify({
        userId: event.hostId,
        templateKey: "host.feedback",
        title: `${"★".repeat(rating)}${"☆".repeat(5 - rating)} — ${event.title}`,
        body: rating >= 4 ? `A guest loved it. See your AfterParty summary.` : `A guest left private feedback. Worth a read.`,
        href: `/host/events/${event.id}`,
      });
      return;
    }
  }
});

export {};
