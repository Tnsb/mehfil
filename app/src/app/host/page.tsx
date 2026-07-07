import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { seatsTaken } from "@/agent/tools/helpers";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[color:var(--color-cream-deep)] text-[color:var(--color-ink-soft)]",
  published: "bg-[color:var(--color-mint-soft)] text-[color:var(--color-mint)]",
  sold_out: "bg-[color:var(--color-butter-soft)] text-[color:var(--color-ink)]",
  completed: "bg-[color:var(--color-grape-soft)] text-[color:var(--color-grape)]",
  cancelled: "bg-[color:var(--color-blush)] text-[color:var(--color-tangerine-deep)]",
};

export default async function HostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");

  const myEvents = await db
    .select()
    .from(tables.events)
    .where(eq(tables.events.hostId, user.id))
    .orderBy(desc(tables.events.startsAt));

  const rows = await Promise.all(
    myEvents.map(async (e) => ({ event: e, taken: await seatsTaken(e.id) })),
  );

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-4xl font-semibold">Your tables</h1>
            <p className="text-[color:var(--color-ink-soft)] mt-1">
              The crew handles the rest.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mb-8">
          <Link href="/chat" className="card p-5 !bg-[color:var(--color-grape-soft)] hover:-translate-y-0.5 transition-transform">
            <p className="text-xl">◈</p>
            <p className="font-display text-lg font-semibold mt-1">Describe it to the crew</p>
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              &ldquo;Six-course Oaxacan dinner Saturday, 10 seats, $85&rdquo;
            </p>
          </Link>
          <Link href="/host/new" className="card p-5 hover:-translate-y-0.5 transition-transform">
            <p className="text-xl">✎</p>
            <p className="font-display text-lg font-semibold mt-1">Fill the form yourself</p>
            <p className="text-sm text-[color:var(--color-ink-soft)]">Old school, still fast.</p>
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">♨</p>
            <p className="font-display text-2xl font-semibold">No events yet</p>
            <p className="text-[color:var(--color-ink-soft)] mt-1">
              One sentence to the crew and your first table goes live.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(({ event, taken }) => (
              <Link
                key={event.id}
                href={`/host/events/${event.id}`}
                className="card flex items-stretch overflow-hidden hover:-translate-y-0.5 transition-transform"
              >
                <Cover seed={event.id} className="w-24 shrink-0" />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-semibold truncate">{event.title}</h3>
                    <span className={`pill ${STATUS_STYLE[event.status]}`}>{event.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">
                    {formatDateTime(event.startsAt)} · {taken}/{event.capacity} seats ·{" "}
                    {formatPrice(event.priceCents)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
