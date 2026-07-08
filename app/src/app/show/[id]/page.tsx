/**
 * The show archive — a crew's shared history. Episode bubbles with title
 * cards, grouped by season, plus host controls (close season).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getTheme } from "@/themes";
import { CloseSeasonButton } from "./show-actions";

export const dynamic = "force-dynamic";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [show] = await db.select().from(tables.shows).where(eq(tables.shows.id, id));
  if (!show) notFound();

  const user = await getCurrentUser();
  const isHost = user?.id === show.hostId;
  const [host] = await db.select().from(tables.users).where(eq(tables.users.id, show.hostId));

  const episodes = await db
    .select()
    .from(tables.events)
    .where(eq(tables.events.showId, show.id))
    .orderBy(asc(tables.events.startsAt));

  const seasons = [...new Set(episodes.map((e) => e.season ?? 1))].sort((a, b) => b - a);
  const latestTheme = getTheme(episodes[episodes.length - 1]?.theme);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <Cover
          seed={show.id}
          theme={{ ...latestTheme.palette, emoji: show.emoji }}
          className="h-36 rounded-[var(--radius-card)] shadow-[var(--shadow-warm-lg)]"
        >
          <div className="absolute inset-0 flex items-end p-5">
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest">A show on plot</p>
              <h1 className="font-display text-3xl font-semibold text-white drop-shadow">
                {show.emoji} {show.title}
              </h1>
              <p className="text-white/90 text-sm">
                hosted by {host?.name ?? "?"} · now filming season {show.currentSeason}
              </p>
            </div>
          </div>
        </Cover>

        {seasons.map((season) => {
          const eps = episodes.filter((e) => (e.season ?? 1) === season);
          const wrapped = season < show.currentSeason;
          return (
            <section key={season}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-xl font-semibold">Season {season}</h2>
                {wrapped ? (
                  <Link
                    href={`/show/${show.id}/finale/${season}`}
                    className="pill bg-[color:var(--color-grape-soft)] text-[color:var(--color-grape)]"
                  >
                    🎞 Season finale
                  </Link>
                ) : isHost && eps.some((e) => e.status === "completed") ? (
                  <CloseSeasonButton showId={show.id} season={season} />
                ) : null}
              </div>
              <ol className="space-y-2.5">
                {eps.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={e.status === "completed" ? `/drop/${e.id}` : `/e/${e.id}`}
                      className="card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-warm-lg)] transition"
                    >
                      <span className="size-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: `linear-gradient(135deg, ${getTheme(e.theme).palette.from}, ${getTheme(e.theme).palette.to})` }}
                      >
                        E{e.episodeNumber ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-sm truncate">
                          {e.titleCard ? `“${e.titleCard}”` : e.title}
                        </span>
                        <span className="block text-xs text-[color:var(--color-ink-faint)]">
                          {formatDate(e.startsAt)}
                          {e.titleCard ? ` · ${e.title}` : ""}
                          {e.status !== "completed" ? ` · ${e.status === "published" || e.status === "sold_out" ? "upcoming" : e.status}` : ""}
                        </span>
                      </span>
                      <span aria-hidden className="text-[color:var(--color-ink-faint)]">→</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        {episodes.length === 0 ? (
          <p className="text-center text-[color:var(--color-ink-soft)]">No episodes yet — the pilot is coming.</p>
        ) : null}
      </div>
    </Shell>
  );
}
