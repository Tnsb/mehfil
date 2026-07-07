import Link from "next/link";
import { Cover } from "./cover";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { Event } from "@/db/schema";

export function EventCard({ event, seatsLeft }: { event: Event; seatsLeft: number }) {
  const soldOut = event.status === "sold_out" || seatsLeft <= 0;
  return (
    <Link href={`/e/${event.id}`} className="card block overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200">
      <Cover seed={event.id} className="h-32">
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="pill bg-white/90 text-[color:var(--color-ink)]">
            {formatPrice(event.priceCents)}
          </span>
          {soldOut ? (
            <span className="pill bg-[color:var(--color-ink)] text-white">Sold out</span>
          ) : seatsLeft <= 3 ? (
            <span className="pill bg-[color:var(--color-butter)] text-[color:var(--color-ink)]">
              {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
            </span>
          ) : null}
        </div>
      </Cover>
      <div className="p-4">
        <h3 className="font-display text-xl font-semibold leading-snug group-hover:text-[color:var(--color-tangerine-deep)] transition-colors">
          {event.title}
        </h3>
        {event.vibe ? (
          <p className="text-sm text-[color:var(--color-ink-soft)] mt-1 line-clamp-1">{event.vibe}</p>
        ) : null}
        <p className="text-sm font-medium mt-2 text-[color:var(--color-ink-soft)]">
          {formatDateTime(event.startsAt)}
          {event.locationHint ? ` · ${event.locationHint}` : ""}
        </p>
      </div>
    </Link>
  );
}
