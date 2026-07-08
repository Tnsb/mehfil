/**
 * Shows, seasons, and the profile-as-receipts. Every event is an episode;
 * recurring events are shows; your profile is proof of nights out, not a feed.
 */
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { defineTool, ok, err, requireUser, ToolError } from "../types";

export const getShow = defineTool({
  name: "get_show",
  description:
    "Get a show's archive: every episode (with Cohost title cards), grouped by season. This is the crew's shared history — 'Episode 12 of Sunday Gravy'.",
  inputSchema: z.object({ showId: z.string() }),
  agentCallable: true,
  execute: async (_ctx, input) => {
    const [show] = await db.select().from(tables.shows).where(eq(tables.shows.id, input.showId));
    if (!show) return err("Show not found.");

    const episodes = await db
      .select()
      .from(tables.events)
      .where(eq(tables.events.showId, show.id))
      .orderBy(asc(tables.events.startsAt));

    return ok({
      show: { id: show.id, title: show.title, emoji: show.emoji, currentSeason: show.currentSeason },
      url: `/show/${show.id}`,
      episodes: episodes.map((e) => ({
        eventId: e.id,
        episode: `S${e.season ?? 1}E${e.episodeNumber ?? 1}`,
        title: e.title,
        titleCard: e.titleCard,
        date: e.startsAt.toISOString(),
        status: e.status,
        url: `/e/${e.id}`,
      })),
    });
  },
});

export const closeSeason = defineTool({
  name: "close_season",
  description:
    "HOST ONLY: close the current season of a show. Generates the Season Finale recap (a trailer for the life you're living) and starts the next season for future episodes.",
  inputSchema: z.object({ showId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const [show] = await db.select().from(tables.shows).where(eq(tables.shows.id, input.showId));
    if (!show) return err("Show not found.");
    if (show.hostId !== userId) throw new ToolError("Only the show's host can close a season.");

    const closed = show.currentSeason;
    const eps = await db
      .select({ id: tables.events.id })
      .from(tables.events)
      .where(and(eq(tables.events.showId, show.id), eq(tables.events.season, closed)));
    if (eps.length === 0) return err(`Season ${closed} has no episodes yet — nothing to wrap.`);

    await db
      .update(tables.shows)
      .set({ currentSeason: closed + 1 })
      .where(eq(tables.shows.id, show.id));

    return ok({
      closedSeason: closed,
      nowFilming: closed + 1,
      finaleUrl: `/show/${show.id}/finale/${closed}`,
      message: `That's a wrap on Season ${closed} of ${show.title} (${eps.length} episodes). The finale is live — Season ${closed + 1} starts filming now.`,
    });
  },
});

export const getMyProfile = defineTool({
  name: "get_my_profile",
  description:
    "The user's profile-as-receipts: episodes this year, shows they're part of, characters met (mutual Taps), main cast (people they keep showing up with), superlatives won, and their settings (IG handle + share opt-in).",
  inputSchema: z.object({}),
  agentCallable: true,
  execute: async (ctx) => {
    const userId = requireUser(ctx);
    const [me] = await db.select().from(tables.users).where(eq(tables.users.id, userId));
    if (!me) return err("User not found.");

    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const myTickets = await db
      .select({ ticket: tables.tickets, event: tables.events })
      .from(tables.tickets)
      .innerJoin(tables.events, eq(tables.tickets.eventId, tables.events.id))
      .where(and(eq(tables.tickets.userId, userId), eq(tables.tickets.status, "paid")))
      .orderBy(desc(tables.events.startsAt));
    const hosted = await db
      .select()
      .from(tables.events)
      .where(eq(tables.events.hostId, userId));

    const attended = myTickets.filter((t) => t.event.startsAt < new Date());
    const attendedThisYear = attended.filter((t) => t.event.startsAt >= yearStart);
    const hostedThisYear = hosted.filter(
      (e) => e.startsAt >= yearStart && e.startsAt < new Date(),
    );
    const attendedEventIds = [
      ...attended.map((t) => t.event.id),
      ...hosted.filter((e) => e.startsAt < new Date()).map((e) => e.id),
    ];

    // main cast: people who keep showing up in your episodes
    const castCount: Record<string, number> = {};
    if (attendedEventIds.length > 0) {
      const co = await db
        .select({ userId: tables.tickets.userId })
        .from(tables.tickets)
        .where(
          and(
            inArray(tables.tickets.eventId, attendedEventIds),
            eq(tables.tickets.status, "paid"),
          ),
        );
      for (const r of co) if (r.userId !== userId) castCount[r.userId] = (castCount[r.userId] ?? 0) + 1;
    }
    const mainCastIds = Object.entries(castCount)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const mainCastUsers = mainCastIds.length
      ? await db.select().from(tables.users).where(inArray(tables.users.id, mainCastIds))
      : [];

    // characters met: mutual same-intent taps
    const taps = await db.select().from(tables.connections);
    const mutuals = taps.filter(
      (c) =>
        c.fromUserId === userId &&
        taps.some(
          (r) =>
            r.eventId === c.eventId &&
            r.fromUserId === c.toUserId &&
            r.toUserId === userId &&
            r.intent === c.intent,
        ),
    );

    // superlative shelf: wins across completed events (by vote plurality)
    const wins: { category: string; eventTitle: string }[] = [];
    for (const eid of attendedEventIds) {
      const votes = await db
        .select()
        .from(tables.superlativeVotes)
        .where(eq(tables.superlativeVotes.eventId, eid));
      const byCat: Record<string, Record<string, number>> = {};
      for (const v of votes) {
        (byCat[v.category] ??= {})[v.votedForUserId] =
          ((byCat[v.category] ?? {})[v.votedForUserId] ?? 0) + 1;
      }
      for (const [category, tally] of Object.entries(byCat)) {
        const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
        if (top && top[0] === userId) {
          const ev = [...attended.map((t) => t.event), ...hosted].find((e) => e.id === eid);
          wins.push({ category, eventTitle: ev?.title ?? "" });
        }
      }
    }

    const showIds = [
      ...new Set(
        [...attended.map((t) => t.event.showId), ...hosted.map((e) => e.showId)].filter(
          (s): s is string => !!s,
        ),
      ),
    ];
    const myShows = showIds.length
      ? await db.select().from(tables.shows).where(inArray(tables.shows.id, showIds))
      : [];

    return ok({
      name: me.name,
      settings: { igHandle: me.igHandle, shareHandleOnMatch: me.shareHandleOnMatch },
      receipts: {
        episodesThisYear: attendedThisYear.length + hostedThisYear.length,
        episodesAllTime: attendedEventIds.length,
        charactersMet: mutuals.length,
        superlativeShelf: wins,
        mainCast: mainCastUsers.map((u) => u.name ?? u.email),
        shows: myShows.map((s) => ({ id: s.id, title: s.title, season: s.currentSeason, url: `/show/${s.id}` })),
      },
      url: "/me",
    });
  },
});

export const setProfile = defineTool({
  name: "set_profile",
  description:
    "Update the user's profile settings: display name, Instagram handle, and whether to auto-share the handle when a Tap matches (the wingman exchanges @s only if BOTH people opted in).",
  inputSchema: z.object({
    name: z.string().min(1).optional(),
    igHandle: z.string().optional().describe("Instagram handle, with or without @"),
    shareHandleOnMatch: z.boolean().optional(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.igHandle !== undefined) patch.igHandle = input.igHandle.replace(/^@/, "") || null;
    if (input.shareHandleOnMatch !== undefined) patch.shareHandleOnMatch = input.shareHandleOnMatch;
    if (Object.keys(patch).length === 0) return err("Nothing to update.");

    await db.update(tables.users).set(patch).where(eq(tables.users.id, userId));
    return ok({ message: "Profile updated." });
  },
});
