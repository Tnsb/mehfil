/**
 * One Shot — each guest gets exactly ONE photo for the whole night.
 * The unique(ticketId) constraint on `photos` enforces it structurally.
 * The roll stays sealed until the AfterParty fires (event completed),
 * then "develops" on the Drop page.
 */
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { emitDomainEvent } from "@/events/bus";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess } from "./helpers";

export const takeOneShot = defineTool({
  name: "take_one_shot",
  description:
    "INTERNAL (UI only — carries image data): save the current user's single One Shot photo for an event. Fails if they already used their shot. Only works once the event has started.",
  inputSchema: z.object({
    eventId: z.string(),
    dataUrl: z.string().startsWith("data:image/").max(2_000_000),
    caption: z.string().max(140).optional(),
  }),
  agentCallable: false,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.startsAt > new Date())
      return err("The night hasn't started yet — your One Shot unlocks at kickoff.");
    if (event.status === "completed")
      return err("The roll already developed. The moment has passed.");

    const [ticket] = await db
      .select()
      .from(tables.tickets)
      .where(
        and(
          eq(tables.tickets.eventId, event.id),
          eq(tables.tickets.userId, userId),
          eq(tables.tickets.status, "paid"),
        ),
      );
    // hosts get a shot too — pegged to a synthetic host "ticket" id
    const ticketId = ticket?.id ?? (event.hostId === userId ? `host_${event.id}` : null);
    if (!ticketId) throw new ToolError("Only confirmed guests get a One Shot.");
    // deposit events: showing up (check-in) is what unlocks the shot
    if (event.depositCents > 0 && ticket && !ticket.checkedInAt)
      return err("Check in at the door first — that unlocks your One Shot and releases your deposit.");

    const [existing] = await db
      .select({ id: tables.photos.id })
      .from(tables.photos)
      .where(eq(tables.photos.ticketId, ticketId));
    if (existing) return err("You already used your one shot. That was the deal.");

    await db.insert(tables.photos).values({
      id: newId("pht"),
      eventId: event.id,
      ticketId,
      userId,
      dataUrl: input.dataUrl,
      caption: input.caption,
    });

    await emitDomainEvent({
      type: "oneshot.taken",
      actorId: userId,
      subjectType: "event",
      subjectId: event.id,
    });

    return ok({
      message:
        "Shot captured. It's sealed in the roll — everything develops the morning after. 📸",
    });
  },
});

export const getPhotoRoll = defineTool({
  name: "get_photo_roll",
  description:
    "Get an event's One Shot roll status (host + paid guests only). Before the AfterParty fires the roll is sealed (only counts are visible); after, it returns the developed photos. Set includeData=true only when rendering images.",
  inputSchema: z.object({
    eventId: z.string(),
    includeData: z.boolean().default(false),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("The roll is for confirmed guests only.");

    const rows = await db
      .select({ photo: tables.photos, author: tables.users })
      .from(tables.photos)
      .innerJoin(tables.users, eq(tables.photos.userId, tables.users.id))
      .where(eq(tables.photos.eventId, event.id));

    const [mine] = rows.filter((r) => r.photo.userId === userId);
    const sealed = event.status !== "completed";

    if (sealed) {
      return ok({
        sealed: true,
        shotsTaken: rows.length,
        youShotYours: !!mine,
        message: `${rows.length} shot${rows.length === 1 ? "" : "s"} in the roll. It develops the morning after.`,
      });
    }

    return ok({
      sealed: false,
      shotsTaken: rows.length,
      photos: rows.map(({ photo, author }) => ({
        id: photo.id,
        by: author.name ?? "Guest",
        caption: photo.caption,
        ...(input.includeData ? { dataUrl: photo.dataUrl } : {}),
      })),
    });
  },
});
