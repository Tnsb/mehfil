/**
 * App shell: sticky header + mobile bottom tab bar.
 * Server component — reads the session and unread notification count itself.
 */
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/app/actions";

async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: tables.notifications.id })
    .from(tables.notifications)
    .where(
      and(
        eq(tables.notifications.userId, userId),
        eq(tables.notifications.status, "sent"),
        isNull(tables.notifications.readAt),
      ),
    );
  return rows.length;
}

export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;

  const tabs = [
    { href: "/", label: "Explore", icon: "✦" },
    { href: "/chat", label: "Crew", icon: "◈" },
    { href: "/host", label: "Hosting", icon: "♨" },
    { href: "/me", label: "You", icon: "🎬" },
    { href: "/inbox", label: "Inbox", icon: "▤", badge: unread },
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[color:var(--color-cream)]/85 border-b border-[color:var(--color-ink)]/8">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
            plot<span className="text-[color:var(--color-tangerine)]">.</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="relative px-3 py-1.5 rounded-full text-sm font-medium text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-blush)] transition-colors"
              >
                {t.label}
                {t.badge ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[color:var(--color-tangerine)] text-white text-[10px] font-bold flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <form action={signOutAction} className="flex items-center gap-2">
                <span className="hidden sm:block text-sm text-[color:var(--color-ink-soft)] max-w-32 truncate">
                  {user.name ?? user.email}
                </span>
                <button className="btn btn-ghost !py-1.5 !px-3 !text-xs" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="btn btn-ink !py-1.5 !px-4 !text-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-10">{children}</main>

      {/* mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[color:var(--color-card)]/95 backdrop-blur-md border-t border-[color:var(--color-ink)]/8 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="relative flex flex-col items-center gap-0.5 py-2.5 text-[color:var(--color-ink-soft)]"
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="text-[10px] font-semibold">{t.label}</span>
              {t.badge ? (
                <span className="absolute top-1 right-[22%] min-w-4 h-4 px-1 rounded-full bg-[color:var(--color-tangerine)] text-white text-[10px] font-bold flex items-center justify-center">
                  {t.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
