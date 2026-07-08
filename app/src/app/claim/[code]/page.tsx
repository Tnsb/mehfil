import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { getTheme } from "@/themes";
import { ClaimButton } from "./claim-button";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [seat] = await db
    .select()
    .from(tables.tickets)
    .where(and(eq(tables.tickets.claimCode, code), eq(tables.tickets.kind, "duo_guest")));
  if (!seat) notFound();

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, seat.eventId));
  if (!event) notFound();
  const [lead] = await db.select().from(tables.users).where(eq(tables.users.id, seat.userId));
  const theme = getTheme(event.theme);
  const user = await getCurrentUser();

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-10">
        <Cover
          seed={event.id}
          theme={{ ...theme.palette, emoji: theme.emoji }}
          className="h-36 rounded-[var(--radius-card)] shadow-[var(--shadow-warm-lg)]"
        />
        <div className="card p-6 -mt-8 relative mx-3 text-center space-y-3">
          <p className="text-3xl">👯</p>
          <h1 className="font-display text-2xl font-semibold leading-tight">
            {lead?.name ?? "Someone"} saved you a seat
          </h1>
          <p className="text-[color:var(--color-ink-soft)]">
            <strong>{event.title}</strong> · {formatDateTime(event.startsAt)}
          </p>
          <p className="text-sm text-[color:var(--color-ink-faint)]">
            Duo seats bring new people into plot — claiming works if this is your first night with us.
          </p>
          {user ? (
            <ClaimButton claimCode={code} eventId={event.id} />
          ) : (
            <Link href={`/login?next=/claim/${code}`} className="btn btn-primary w-full">
              Sign in to claim — takes 20 seconds
            </Link>
          )}
        </div>
      </div>
    </Shell>
  );
}
