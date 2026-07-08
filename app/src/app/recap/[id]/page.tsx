/**
 * Episode recap — story-format auto-advancing slides:
 * title card → stills → awards → best Overheard → run-it-back CTA.
 */
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPartyAccess } from "@/agent/tools/helpers";
import { tallySuperlatives } from "@/agent/tools/night";
import { formatDate } from "@/lib/format";
import { getTheme } from "@/themes";
import { RecapPlayer, type RecapSlide } from "@/components/recap-player";

export const dynamic = "force-dynamic";

export default async function RecapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/recap/${id}`);

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event || event.status !== "completed") notFound();
  if (!(await hasPartyAccess(user.id, event))) redirect(`/e/${id}`);

  const theme = getTheme(event.theme);
  const roll = await db
    .select({ photo: tables.photos, author: tables.users })
    .from(tables.photos)
    .innerJoin(tables.users, eq(tables.photos.userId, tables.users.id))
    .where(eq(tables.photos.eventId, event.id));
  const quotes = await db
    .select()
    .from(tables.overheard)
    .where(and(eq(tables.overheard.eventId, event.id), eq(tables.overheard.status, "featured")));
  const awards = await tallySuperlatives(event.id);

  const slides: RecapSlide[] = [
    {
      id: "title",
      kicker: `${event.episodeNumber ? `S${event.season ?? 1}E${event.episodeNumber} · ` : ""}${formatDate(event.startsAt)}`,
      title: event.titleCard ? `“${event.titleCard}”` : event.title,
      body: event.titleCard ? event.title : event.vibe ?? undefined,
      emoji: theme.emoji,
    },
    ...roll.slice(0, 6).map(({ photo, author }) => ({
      id: photo.id,
      kicker: `${author.name ?? "Guest"}'s one shot`,
      title: photo.caption ?? "",
      imageDataUrl: photo.dataUrl,
    })),
    ...awards.slice(0, 3).map((a) => ({
      id: `award-${a.category}`,
      kicker: "the awards",
      title: a.winnerName,
      body: a.category,
      emoji: "🏆",
    })),
    ...(quotes[0]
      ? [
          {
            id: "quote",
            kicker: "overheard",
            title: `“${quotes[0].quote}”`,
            body: "— someone, allegedly",
            emoji: "🗣",
          },
        ]
      : []),
  ];

  return (
    <RecapPlayer
      slides={slides}
      palette={theme.palette}
      doneHref={`/drop/${event.id}`}
      doneLabel="Back to the Reveal"
    />
  );
}
