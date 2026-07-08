"use client";

/**
 * The Tab card on the Reveal: log shared costs, see the even split,
 * and (host) fire the payment requests.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

type TabData = {
  items: { id: string; label: string; amount: string; paidBy: string }[];
  total: string;
  perHead: string;
  balances: { userId: string; name: string; netCents: number; net: string }[];
};

export function TabCard({
  eventId,
  initialTab,
  isHost,
  myUserId,
}: {
  eventId: string;
  initialTab: TabData;
  isHost: boolean;
  myUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabData>(initialTab);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const res = await toolAction("get_tab", { eventId });
    if (res.ok) setTab(res.data as TabData);
  }

  const mine = tab.balances.find((b) => b.userId === myUserId);

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">💸 The Tab</h2>
        {tab.items.length > 0 ? (
          <span className="pill bg-[color:var(--color-butter-soft)] shrink-0">
            {tab.total} · {tab.perHead}/head
          </span>
        ) : null}
      </div>

      {tab.items.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Nothing logged yet. Pizza run? Second wine trip? Put it on the tab and it splits itself.
        </p>
      ) : (
        <>
          <ul className="text-sm space-y-1">
            {tab.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>
                  {i.label} <span className="text-[color:var(--color-ink-faint)]">· {i.paidBy}</span>
                </span>
                <span className="font-semibold tabular-nums">{i.amount}</span>
              </li>
            ))}
          </ul>
          {mine ? (
            <p
              className={`text-sm font-semibold ${mine.netCents < -50 ? "text-[color:var(--color-tangerine-deep)]" : "text-[color:var(--color-ink)]"}`}
            >
              {mine.netCents < -50
                ? `You owe ${mine.net}`
                : mine.netCents > 50
                  ? `You're owed ${mine.net}`
                  : "You're square ✓"}
            </p>
          ) : null}
        </>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const amt = parseFloat(amount);
          if (!label.trim() || !amt || amt <= 0) return;
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("add_tab_item", {
              eventId,
              label: label.trim(),
              amountDollars: amt,
            });
            if (!res.ok) return setError(res.error);
            setLabel("");
            setAmount("");
            await refresh();
            router.refresh();
          });
        }}
      >
        <input
          className="field !py-2 flex-1"
          placeholder="pizza"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="field !py-2 !w-24"
          placeholder="$"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn btn-ink !px-4 !py-2" disabled={pending} type="submit">
          +
        </button>
      </form>

      {isHost && tab.items.length > 0 ? (
        <button
          className="btn btn-primary w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const res = await toolAction("request_tab_payments", { eventId });
              if (!res.ok) return setError(res.error);
              setStatus((res.data as { message: string }).message);
            })
          }
        >
          Settle up — send payment requests
        </button>
      ) : null}
      {status ? <p className="text-xs text-[color:var(--color-ink-soft)] font-medium">{status}</p> : null}
      {error ? <p className="text-xs text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
    </section>
  );
}
