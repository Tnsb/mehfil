/**
 * /me — the profile as receipts. Not a feed: proof of nights out.
 * "23 episodes this year. 41 characters met. 6 shows."
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { runTool } from "@/agent/registry";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

type Profile = {
  name: string | null;
  settings: { igHandle: string | null; shareHandleOnMatch: boolean };
  receipts: {
    episodesThisYear: number;
    episodesAllTime: number;
    charactersMet: number;
    superlativeShelf: { category: string; eventTitle: string }[];
    mainCast: string[];
    shows: { id: string; title: string; season: number; url: string }[];
  };
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const res = await runTool(
    "get_my_profile",
    { userId: user.id, name: user.name ?? user.email, isSystem: false },
    {},
  );
  if (!res.ok) redirect("/");
  const profile = res.data as Profile;
  const r = profile.receipts;

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <header className="rise-in">
          <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-ink-soft)]">
            Your receipts
          </p>
          <h1 className="font-display text-3xl font-semibold mt-1">{profile.name ?? "You"}</h1>
        </header>

        {/* the stat card that IS the profile */}
        <section className="card p-6 !bg-[color:var(--color-ink)] text-[color:var(--color-cream)] relative overflow-hidden">
          <span aria-hidden className="absolute -right-6 -top-8 text-[7rem] opacity-15 rotate-12 select-none">🎬</span>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-4xl font-semibold">{r.episodesThisYear}</p>
              <p className="text-xs text-white/70 mt-1">episodes this year</p>
            </div>
            <div>
              <p className="font-display text-4xl font-semibold">{r.charactersMet}</p>
              <p className="text-xs text-white/70 mt-1">characters met</p>
            </div>
            <div>
              <p className="font-display text-4xl font-semibold">{r.shows.length}</p>
              <p className="text-xs text-white/70 mt-1">shows</p>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-5 text-center">
            {r.episodesAllTime} episodes all time · proof of a life, not a feed
          </p>
        </section>

        {/* superlative shelf */}
        {r.superlativeShelf.length > 0 ? (
          <section className="card p-5">
            <h2 className="font-display text-xl font-semibold mb-2">🏆 The shelf</h2>
            <ul className="space-y-1.5 text-sm">
              {r.superlativeShelf.map((w, i) => (
                <li key={i}>
                  <span className="font-semibold">{w.category}</span>
                  <span className="text-[color:var(--color-ink-faint)]"> — {w.eventTitle}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* main cast */}
        {r.mainCast.length > 0 ? (
          <section className="card p-5">
            <h2 className="font-display text-xl font-semibold mb-2">🎭 Your main cast</h2>
            <p className="text-xs text-[color:var(--color-ink-faint)] mb-2">
              The people who keep showing up in your episodes.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {r.mainCast.map((name) => (
                <span key={name} className="pill bg-[color:var(--color-butter-soft)]">{name}</span>
              ))}
            </div>
          </section>
        ) : null}

        {/* shows */}
        {r.shows.length > 0 ? (
          <section className="card p-5">
            <h2 className="font-display text-xl font-semibold mb-2">📺 Your shows</h2>
            <ul className="space-y-2">
              {r.shows.map((s) => (
                <li key={s.id}>
                  <Link href={s.url} className="flex items-center justify-between text-sm hover:underline underline-offset-4">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-[color:var(--color-ink-faint)]">season {s.season} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* connections shortcut */}
        <Link href="/inbox" className="btn btn-ghost w-full">
          💌 Notifications & matches live in your inbox
        </Link>

        {/* settings */}
        <section className="card p-5">
          <h2 className="font-display text-xl font-semibold mb-3">Settings</h2>
          <SettingsForm
            initialIgHandle={profile.settings.igHandle}
            initialShare={profile.settings.shareHandleOnMatch}
          />
        </section>
      </div>
    </Shell>
  );
}
