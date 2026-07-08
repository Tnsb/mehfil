/**
 * Event lifecycle tools (the Setup agent's hands).
 */
import { z } from "zod";
import { db, tables } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { THEMES, THEME_KEYS, DEFAULT_THEME } from "@/themes";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { eventView, seatsTaken, getEventOrThrow } from "./helpers";

/** Next episode number within a show. */
async function nextEpisodeNumber(showId: string): Promise<number> {
  const rows = await db
    .select({ id: tables.events.id })
    .from(tables.events)
    .where(eq(tables.events.showId, showId));
  return rows.length + 1;
}

export const createEvent = defineTool({
  name: "create_event",
  description:
    `Create a draft event (an "episode") from the host's description — e.g. 'six-course Oaxacan dinner at my place Saturday, 10 seats, $85'. Options: theme (${THEME_KEYS.join(", ")}) which re-renders the whole night (palette, One Shot film stock, superlatives, icebreakers); template "run_club" for runs (adds waivers + bib numbers, defaults theme to finish_line); depositDollars for a refundable no-flake hold on free events; mysterySeat (one blind seat, 20% off); duoTickets (two seats 10% off, +1 must be new to plot); twistIntensity for a Cohost mid-event surprise (chill/spicy/chaos); showTitle to file it under a recurring show/series. Drafts are invisible until publish_event.`,
  inputSchema: z.object({
    title: z.string().min(3).describe("Short, appetizing event title"),
    vibe: z
      .string()
      .optional()
      .describe("One-line vibe, e.g. 'six courses, natural wine, strangers welcome'"),
    description: z.string().optional().describe("Longer description of the night"),
    priceDollars: z.number().min(0).describe("Ticket price in dollars, 0 for free"),
    capacity: z.number().int().min(1).max(500).describe("Number of seats"),
    startsAtIso: z.string().describe("Event start date-time as ISO 8601, e.g. 2026-07-18T19:00:00"),
    locationHint: z
      .string()
      .optional()
      .describe("Public location teaser shown before payment, e.g. 'Silver Lake — exact address after booking'"),
    locationAddress: z
      .string()
      .optional()
      .describe("The real address, revealed only to paid guests"),
    theme: z.enum(THEME_KEYS as [string, ...string[]]).optional(),
    template: z.enum(["dinner", "run_club"]).default("dinner"),
    depositDollars: z.number().min(0).optional().describe("Refundable hold for free events"),
    mysterySeat: z.boolean().optional(),
    duoTickets: z.boolean().optional(),
    twistIntensity: z.enum(["off", "chill", "spicy", "chaos"]).optional(),
    showTitle: z
      .string()
      .optional()
      .describe("Name of the recurring show/series this belongs to (created if new), e.g. 'Maya's Table'"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const startsAt = new Date(input.startsAtIso);
    if (isNaN(startsAt.getTime())) return err("Could not parse the start date.");

    // resolve the show (crews & series are first-class)
    let showId: string | null = null;
    let season: number | null = null;
    let episodeNumber: number | null = null;
    if (input.showTitle) {
      const [existingShow] = await db
        .select()
        .from(tables.shows)
        .where(and(eq(tables.shows.hostId, userId), eq(tables.shows.title, input.showTitle)));
      const show =
        existingShow ??
        (
          await db
            .insert(tables.shows)
            .values({ id: newId("shw"), hostId: userId, title: input.showTitle })
            .returning()
        )[0];
      showId = show.id;
      season = show.currentSeason;
      episodeNumber = await nextEpisodeNumber(show.id);
    }

    const theme = input.theme ?? (input.template === "run_club" ? "finish_line" : DEFAULT_THEME);

    const id = newId("evt");
    const [event] = await db
      .insert(tables.events)
      .values({
        id,
        hostId: userId,
        title: input.title,
        vibe: input.vibe ?? THEMES[theme].tagline,
        description: input.description,
        template: input.template,
        priceCents: Math.round(input.priceDollars * 100),
        capacity: input.capacity,
        startsAt,
        locationHint: input.locationHint,
        locationAddress: input.locationAddress,
        questions: [{ key: "dietary", label: "Any dietary restrictions or allergies?" }],
        theme,
        depositCents: Math.round((input.depositDollars ?? 0) * 100),
        mysterySeat: input.mysterySeat ?? false,
        duoTickets: input.duoTickets ?? false,
        twistIntensity: input.twistIntensity ?? "off",
        showId,
        season,
        episodeNumber,
      })
      .returning();

    await emitDomainEvent({
      type: "event.created",
      actorId: userId,
      subjectType: "event",
      subjectId: id,
      payload: { title: event.title },
    });

    return ok({
      event: eventView(event, { includeAddress: true, seatsLeft: event.capacity }),
      nextStep:
        "The event is a DRAFT. Review the details with the host, then call publish_event (the host must accept the hosting terms) to make it live and shareable.",
    });
  },
});

export const updateEvent = defineTool({
  name: "update_event",
  description:
    "Update fields of an event you host (title, vibe, description, price, capacity, date, location). Works on drafts and published events.",
  inputSchema: z.object({
    eventId: z.string(),
    title: z.string().min(3).optional(),
    vibe: z.string().optional(),
    description: z.string().optional(),
    priceDollars: z.number().min(0).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    startsAtIso: z.string().optional(),
    locationHint: z.string().optional(),
    locationAddress: z.string().optional(),
    theme: z.enum(THEME_KEYS as [string, ...string[]]).optional(),
    depositDollars: z.number().min(0).optional(),
    mysterySeat: z.boolean().optional(),
    duoTickets: z.boolean().optional(),
    twistIntensity: z.enum(["off", "chill", "spicy", "chaos"]).optional(),
    moderateOverheard: z.boolean().optional(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId) throw new ToolError("Only the host can update this event.");
    if (event.status === "completed" || event.status === "cancelled")
      return err("This event is already over.");

    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.vibe !== undefined) patch.vibe = input.vibe;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priceDollars !== undefined) patch.priceCents = Math.round(input.priceDollars * 100);
    if (input.capacity !== undefined) patch.capacity = input.capacity;
    if (input.locationHint !== undefined) patch.locationHint = input.locationHint;
    if (input.locationAddress !== undefined) patch.locationAddress = input.locationAddress;
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.depositDollars !== undefined) patch.depositCents = Math.round(input.depositDollars * 100);
    if (input.mysterySeat !== undefined) patch.mysterySeat = input.mysterySeat;
    if (input.duoTickets !== undefined) patch.duoTickets = input.duoTickets;
    if (input.twistIntensity !== undefined) patch.twistIntensity = input.twistIntensity;
    if (input.moderateOverheard !== undefined) patch.moderateOverheard = input.moderateOverheard;
    if (input.startsAtIso !== undefined) {
      const d = new Date(input.startsAtIso);
      if (isNaN(d.getTime())) return err("Could not parse the start date.");
      patch.startsAt = d;
    }
    if (Object.keys(patch).length === 0) return err("Nothing to update.");

    const [updated] = await db
      .update(tables.events)
      .set(patch)
      .where(eq(tables.events.id, event.id))
      .returning();

    await emitDomainEvent({
      type: "event.updated",
      actorId: userId,
      subjectType: "event",
      subjectId: event.id,
      payload: { fields: Object.keys(patch) },
    });

    return ok({ event: eventView(updated, { includeAddress: true }) });
  },
});

export const publishEvent = defineTool({
  name: "publish_event",
  description:
    "Publish a draft event so guests can book. The host MUST explicitly accept the hosting terms (they warrant they are legally allowed to run this event — plot surfaces compliance info but never gives legal verdicts). Ask the host to confirm acceptance before calling this with acceptTerms=true.",
  inputSchema: z.object({
    eventId: z.string(),
    acceptTerms: z
      .boolean()
      .describe("Must be true — the host confirms they accept the hosting terms and warrant legal compliance"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId) throw new ToolError("Only the host can publish this event.");
    if (!input.acceptTerms)
      return err("The host must accept the hosting terms before publishing.");
    if (event.status !== "draft") return err(`Event is already ${event.status}.`);

    // drop mechanics: sequels open to past guests first, everyone else 6h later
    const isSequel = !!event.parentEventId || (!!event.showId && (event.episodeNumber ?? 1) > 1);
    const publicAt = isSequel ? new Date(Date.now() + 6 * 60 * 60 * 1000) : null;

    const [updated] = await db
      .update(tables.events)
      .set({ status: "published", tosAcceptedAt: new Date(), publicAt })
      .where(eq(tables.events.id, event.id))
      .returning();

    await emitDomainEvent({
      type: "event.published",
      actorId: userId,
      subjectType: "event",
      subjectId: event.id,
      payload: { title: event.title },
    });

    return ok({
      event: eventView(updated, { includeAddress: true, seatsLeft: await seatsLeft(updated.id, updated.capacity) }),
      shareUrl: `/e/${event.id}`,
      message: publicAt
        ? `Live! Past guests get first access for 6 hours (until ${publicAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}), then the link goes wide.`
        : "Live! Share the event link — the address stays hidden until a guest pays.",
    });
  },
});

async function seatsLeft(eventId: string, capacity: number) {
  return capacity - (await seatsTaken(eventId));
}

export const listMyEvents = defineTool({
  name: "list_my_events",
  description:
    "List all events the current user hosts, with status and seat counts. Use to answer questions like 'how are my dinners doing?'",
  inputSchema: z.object({}),
  agentCallable: true,
  execute: async (ctx) => {
    const userId = requireUser(ctx);
    const rows = await db
      .select()
      .from(tables.events)
      .where(eq(tables.events.hostId, userId))
      .orderBy(desc(tables.events.startsAt));

    const result = [];
    for (const event of rows) {
      const taken = await seatsTaken(event.id);
      result.push({
        ...eventView(event, { includeAddress: true, seatsLeft: event.capacity - taken }),
        seatsTaken: taken,
        hostUrl: `/host/events/${event.id}`,
      });
    }
    return ok({ events: result });
  },
});

export const runItBack = defineTool({
  name: "run_it_back",
  description:
    "HOST ONLY: clone a completed event into a new draft one week later (same title, price, seats, address, cohost vibe). When the new date is published, past guests are automatically notified with first access. The one-tap rebooking loop.",
  inputSchema: z.object({
    eventId: z.string().describe("The completed event to run back"),
    startsAtIso: z
      .string()
      .optional()
      .describe("Optional new date-time ISO 8601; defaults to +7 days from the original"),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const original = await getEventOrThrow(input.eventId);
    if (original.hostId !== userId) throw new ToolError("Only the host can run it back.");
    if (original.status !== "completed")
      return err("Run it back works on completed events — wrap this one up first.");

    let startsAt: Date;
    if (input.startsAtIso) {
      startsAt = new Date(input.startsAtIso);
      if (isNaN(startsAt.getTime())) return err("Could not parse the new date.");
    } else {
      startsAt = new Date(original.startsAt);
      while (startsAt <= new Date()) startsAt.setDate(startsAt.getDate() + 7);
    }

    // running it back makes it a series: attach to the original's show, or start one
    let showId = original.showId;
    let season = original.season;
    if (!showId) {
      const [show] = await db
        .insert(tables.shows)
        .values({ id: newId("shw"), hostId: userId, title: original.title })
        .returning();
      showId = show.id;
      season = show.currentSeason;
      // retro-file the original as episode 1
      await db
        .update(tables.events)
        .set({ showId, season, episodeNumber: 1 })
        .where(eq(tables.events.id, original.id));
    }
    const episodeNumber = await nextEpisodeNumber(showId);

    const id = newId("evt");
    const [clone] = await db
      .insert(tables.events)
      .values({
        id,
        hostId: userId,
        title: original.title,
        vibe: original.vibe,
        description: original.description,
        template: original.template,
        templateConfig: original.templateConfig,
        priceCents: original.priceCents,
        capacity: original.capacity,
        startsAt,
        locationHint: original.locationHint,
        locationAddress: original.locationAddress,
        questions: original.questions,
        cohostVibe: original.cohostVibe,
        parentEventId: original.id,
        theme: original.theme,
        depositCents: original.depositCents,
        mysterySeat: original.mysterySeat,
        duoTickets: original.duoTickets,
        twistIntensity: original.twistIntensity,
        moderateOverheard: original.moderateOverheard,
        showId,
        season,
        episodeNumber,
      })
      .returning();

    await emitDomainEvent({
      type: "event.run_back",
      actorId: userId,
      subjectType: "event",
      subjectId: id,
      payload: { parentEventId: original.id, title: clone.title },
    });

    return ok({
      event: eventView(clone, { includeAddress: true, seatsLeft: clone.capacity }),
      nextStep:
        "Draft created as a sequel. Publish it (host must accept terms) and every guest from the original night gets first-access notification automatically.",
    });
  },
});

export const getEventDetails = defineTool({
  name: "get_event_details",
  description:
    "Get the public details of any event by id: title, vibe, price, seats left, date. The exact address is included ONLY if the caller is the host or holds a paid ticket.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const event = await getEventOrThrow(input.eventId);
    const taken = await seatsTaken(event.id);

    let includeAddress = false;
    if (ctx.userId) {
      if (ctx.userId === event.hostId) includeAddress = true;
      else {
        const [paid] = await db
          .select({ id: tables.tickets.id })
          .from(tables.tickets)
          .where(
            and(
              eq(tables.tickets.eventId, event.id),
              eq(tables.tickets.userId, ctx.userId),
              eq(tables.tickets.status, "paid"),
            ),
          );
        includeAddress = !!paid;
      }
    }

    return ok({
      event: eventView(event, { includeAddress, seatsLeft: event.capacity - taken }),
    });
  },
});
