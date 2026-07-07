import Link from "next/link";
import { and, gt, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { EventCard } from "@/components/event-card";
import { seatsTaken } from "@/agent/tools/helpers";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const upcoming = await db
    .select()
    .from(tables.events)
    .where(
      and(
        inArray(tables.events.status, ["published", "sold_out"]),
        gt(tables.events.startsAt, new Date()),
      ),
    )
    .orderBy(tables.events.startsAt)
    .limit(12);

  const withSeats = await Promise.all(
    upcoming.map(async (e) => ({ event: e, seatsLeft: e.capacity - (await seatsTaken(e.id)) })),
  );

  return (
    <Shell>
      {/* hero */}
      <section className="hero-gradient-animated text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="pill bg-white/20 backdrop-blur-sm text-white mb-5">
            ◈ AI agents that run your paid dinner, end to end
          </p>
          <h1 className="font-display font-semibold text-4xl md:text-6xl leading-[1.05] max-w-2xl [text-wrap:balance]">
            One sentence in. A sold-out dinner out.
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/90 max-w-xl">
            Tell the crew about your dinner. They build the page, sell the seats,
            reveal the address only after payment — and follow up the morning after.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={user ? "/chat" : "/login?next=/chat"} className="btn btn-ink !text-base">
              ◈ Talk to your crew
            </Link>
            <Link href="#upcoming" className="btn !bg-white/15 !text-white !border !border-white/40 hover:!bg-white/25">
              Explore dinners
            </Link>
          </div>
        </div>
      </section>

      {/* upcoming */}
      <section id="upcoming" className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-3xl font-semibold">This week&apos;s tables</h2>
        </div>
        {withSeats.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">🕯️</p>
            <p className="font-display text-2xl font-semibold">No tables set yet</p>
            <p className="text-[color:var(--color-ink-soft)] mt-2">
              Be the first host — describe your dinner to the crew and it goes live in a minute.
            </p>
            <Link href={user ? "/chat" : "/login?next=/chat"} className="btn btn-primary mt-5">
              Host a dinner
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {withSeats.map(({ event, seatsLeft }) => (
              <EventCard key={event.id} event={event} seatsLeft={seatsLeft} />
            ))}
          </div>
        )}
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="font-display text-3xl font-semibold mb-5">The crew</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: "✎",
              name: "Setup",
              copy: "\u201cSix-course Oaxacan dinner, Saturday, 10 seats, $85\u201d → a live, bookable page.",
              tint: "var(--color-blush)",
            },
            {
              icon: "🔑",
              name: "Door",
              copy: "Payments, dietary answers, waitlist backfill — and the address unlocks only after payment.",
              tint: "var(--color-butter-soft)",
            },
            {
              icon: "✨",
              name: "AfterParty",
              copy: "The morning after: feedback while it's fresh, private complaints, and your next table pre-filled.",
              tint: "var(--color-grape-soft)",
            },
          ].map((a) => (
            <div key={a.name} className="card p-5" style={{ background: a.tint }}>
              <p className="text-2xl">{a.icon}</p>
              <p className="font-display text-xl font-semibold mt-2">{a.name}</p>
              <p className="text-sm text-[color:var(--color-ink-soft)] mt-1.5 leading-relaxed">{a.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
