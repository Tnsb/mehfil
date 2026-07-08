/**
 * During-the-night mechanics: superlative voting (revealed at the Drop),
 * host-fired plot twists, and the theme's one-tap playlist.
 */
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { getTheme, TWISTS } from "@/themes";
import { postCohostMessage } from "@/cohost";
import { emitDomainEvent } from "@/events/bus";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess } from "./helpers";

export const voteSuperlative = defineTool({
  name: "vote_superlative",
  description:
    "Vote a guest for one of the night's superlative categories (categories come from the event's theme). Votes are secret until the morning Reveal, where winners are crowned. One vote per category; re-voting replaces it. Attendees only, once the night starts.",
  inputSchema: z.object({
    eventId: z.string(),
    category: z.string().describe("Exact category string from the theme"),
    votedForUserId: z.string(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("Voting is for people at the event.");
    if (event.startsAt > new Date()) return err("Voting opens when the night starts.");
    if (event.completedAt) return err("The Reveal already happened — results are out.");

    const theme = getTheme(event.theme);
    if (!theme.superlatives.includes(input.category))
      return err(`Unknown category. This night's categories: ${theme.superlatives.join(" · ")}`);
    if (input.votedForUserId === userId) return err("Campaigning for yourself? Bold. Not allowed.");
    if (!(await hasPartyAccess(input.votedForUserId, event)))
      return err("You can only vote for people at this event.");

    const [existing] = await db
      .select()
      .from(tables.superlativeVotes)
      .where(
        and(
          eq(tables.superlativeVotes.eventId, event.id),
          eq(tables.superlativeVotes.voterId, userId),
          eq(tables.superlativeVotes.category, input.category),
        ),
      );
    if (existing) {
      await db
        .update(tables.superlativeVotes)
        .set({ votedForUserId: input.votedForUserId })
        .where(eq(tables.superlativeVotes.id, existing.id));
    } else {
      await db.insert(tables.superlativeVotes).values({
        id: newId("svt"),
        eventId: event.id,
        voterId: userId,
        category: input.category,
        votedForUserId: input.votedForUserId,
      });
    }

    return ok({ message: `Ballot cast for "${input.category}". Sealed until the Reveal. 🗳️` });
  },
});

/** Tally votes → winner per category. Exported for the Reveal + Cohost. */
export async function tallySuperlatives(eventId: string) {
  const votes = await db
    .select({ vote: tables.superlativeVotes, user: tables.users })
    .from(tables.superlativeVotes)
    .innerJoin(tables.users, eq(tables.superlativeVotes.votedForUserId, tables.users.id))
    .where(eq(tables.superlativeVotes.eventId, eventId));

  const byCategory: Record<string, Record<string, { name: string; count: number }>> = {};
  for (const { vote, user } of votes) {
    const cat = (byCategory[vote.category] ??= {});
    const entry = (cat[vote.votedForUserId] ??= { name: user.name ?? "someone", count: 0 });
    entry.count += 1;
  }

  return Object.entries(byCategory).map(([category, tally]) => {
    const ranked = Object.entries(tally).sort((a, b) => b[1].count - a[1].count);
    const [winnerId, winner] = ranked[0];
    return { category, winnerId, winnerName: winner.name, votes: winner.count };
  });
}

export const getSuperlativeResults = defineTool({
  name: "get_superlative_results",
  description:
    "Get the superlative winners for a completed event (revealed at the morning Drop). Attendees only.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("Results are for people who were there.");
    if (!event.completedAt) return err("Sealed until the Reveal. Vote while you can.");
    return ok({ results: await tallySuperlatives(event.id) });
  },
});

/** Post one twist to the party chat. Shared by the tool + scheduler. */
export async function firePlotTwist(eventId: string): Promise<string | null> {
  const event = await getEventOrThrow(eventId);
  if (event.twistIntensity === "off") return null;

  const pool = TWISTS[event.twistIntensity];
  const twist = pool[Math.floor(Math.random() * pool.length)];
  await postCohostMessage(event.id, twist);
  await emitDomainEvent({
    type: "cohost.twist_fired",
    actorId: null,
    subjectType: "event",
    subjectId: event.id,
    payload: { intensity: event.twistIntensity },
  });
  return twist;
}

export const triggerPlotTwist = defineTool({
  name: "trigger_plot_twist",
  description:
    "HOST ONLY: make the Cohost fire a plot twist into the party chat right now (uses the event's twist intensity: chill / spicy / chaos). The scheduler also auto-fires one mid-event when intensity is on.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId && !ctx.isSystem)
      throw new ToolError("Only the host pulls this lever.");
    if (event.twistIntensity === "off")
      return err("Twists are off for this event — set an intensity first (chill/spicy/chaos).");

    const twist = await firePlotTwist(event.id);
    return ok({ twist, message: "Twist fired into the party chat. No takebacks. 🌀" });
  },
});

export const getHostPlaylist = defineTool({
  name: "get_host_playlist",
  description:
    "Get the one-tap playlist for an event's theme (host prep). Returns the tracklist and a name to search on Spotify/Apple Music.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    const theme = getTheme(event.theme);
    return ok({
      theme: theme.name,
      playlist: theme.playlist.title,
      tracks: theme.playlist.tracks,
      dressCode: theme.dressCode,
    });
  },
});
