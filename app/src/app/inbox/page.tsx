import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { markNotificationsReadAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ICONS: Record<string, string> = {
  "ticket.confirmed": "🎟️",
  "host.seat_sold": "💸",
  "host.sold_out": "🔥",
  "waitlist.promoted": "🪑",
  "afterparty.feedback_request": "✨",
  "host.feedback": "⭐",
  "event.reminder": "🗓",
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/inbox");

  const items = await db
    .select()
    .from(tables.notifications)
    .where(eq(tables.notifications.userId, user.id))
    .orderBy(desc(tables.notifications.createdAt))
    .limit(50);

  const visible = items.filter((n) => n.status === "sent");
  const hasUnread = visible.some((n) => !n.readAt);

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl font-semibold">Inbox</h1>
          {hasUnread ? (
            <form action={markNotificationsReadAction}>
              <button className="btn btn-ghost !py-1.5 !px-3 !text-xs" type="submit">
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">📮</p>
            <p className="font-display text-2xl font-semibold">Nothing yet</p>
            <p className="text-[color:var(--color-ink-soft)] mt-1">
              Confirmations, reminders and AfterParty asks land here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((n) => {
              const inner = (
                <div
                  className={`card p-4 flex gap-3 items-start ${!n.readAt ? "!border-[color:var(--color-tangerine)]/40" : "opacity-80"} ${n.href ? "hover:-translate-y-0.5 transition-transform" : ""}`}
                >
                  <span className="text-xl">{ICONS[n.templateKey] ?? "▤"}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug">
                      {n.title}
                      {!n.readAt ? (
                        <span className="inline-block size-2 rounded-full bg-[color:var(--color-tangerine)] ml-2 align-middle" />
                      ) : null}
                    </p>
                    <p className="text-sm text-[color:var(--color-ink-soft)] mt-0.5">{n.body}</p>
                    <p className="text-xs text-[color:var(--color-ink-faint)] mt-1">
                      {n.sentAt?.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.href ? <Link href={n.href}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}
