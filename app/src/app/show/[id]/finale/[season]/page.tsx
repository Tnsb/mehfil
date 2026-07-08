/**
 * The Season Finale — an auto-generated trailer for the season the crew just
 * lived: every episode's title card, the best stills, season stats.
 */
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getTheme } from "@/themes";
import { RecapPlayer, type RecapSlide } from "@/components/recap-player";

export const dynamic = "force-dynamic";

export default async function FinalePage({
  params,
}: {
  params: Promise<{ id: string; season: string }>;
}) {
  const { id, season: seasonParam } = await params;
  const season = parseInt(seasonParam, 10);
  if (isNaN(season)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/show/${id}/finale/${season}`);

  const [show] = await db.select().from(tables.shows).where(eq(tables.shows.id, id));
  if (!show) notFound();

  const episodes = await db
    .select()
    .from(tables.events)
    .where(and(eq(tables.events.showId, show.id), eq(tables.events.season, season)))
    .orderBy(asc(tables.events.startsAt));
  if (episodes.length === 0) notFound();

  const epIds = episodes.map((e) => e.id);
  const photos = await db
    .select()
    .from(tables.photos)
    .where(inArray(tables.photos.eventId, epIds));
  const guests = await db
    .select({ userId: tables.tickets.userId })
    .from(tables.tickets)
    .where(and(inArray(tables.tickets.eventId, epIds), eq(tables.tickets.status, "paid")));
  const uniqueGuests = new Set(guests.map((g) => g.userId)).size;
  const quotes = await db
    .select()
    .from(tables.overheard)
    .where(and(inArray(tables.overheard.eventId, epIds), eq(tables.overheard.status, "featured")));

  const theme = getTheme(episodes[episodes.length - 1].theme);

  const slides: RecapSlide[] = [
    {
      id: "open",
      kicker: "season finale",
      title: `${show.title} — Season ${season}`,
      body: `${episodes.length} episode${episodes.length === 1 ? "" : "s"} · ${uniqueGuests} people · one crew`,
      emoji: show.emoji,
    },
    ...episodes.map((e) => {
      const still = photos.find((p) => p.eventId === e.id);
      return {
        id: e.id,
        kicker: `episode ${e.episodeNumber ?? "?"} · ${formatDate(e.startsAt)}`,
        title: e.titleCard ? `“${e.titleCard}”` : e.title,
        body: e.titleCard ? e.title : e.vibe ?? undefined,
        imageDataUrl: still?.dataUrl,
        emoji: still ? undefined : getTheme(e.theme).emoji,
      };
    }),
    ...(quotes[0]
      ? [
          {
            id: "quote",
            kicker: "the season, overheard",
            title: `“${quotes[0].quote}”`,
            emoji: "🗣",
          },
        ]
      : []),
    {
      id: "stats",
      kicker: "the receipts",
      title: `${photos.length} one shots · ${uniqueGuests} characters`,
      body: `Season ${season + 1} is already filming.`,
      emoji: "🎞",
    },
  ];

  return (
    <RecapPlayer
      slides={slides}
      palette={theme.palette}
      doneHref={`/show/${show.id}`}
      doneLabel="Back to the show"
    />
  );
}
