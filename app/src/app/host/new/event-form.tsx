"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";
import { toLocalDateTimeInput } from "@/lib/format";
import { THEMES } from "@/themes";

export function NewEventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const defaultDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
    d.setHours(19, 0, 0, 0);
    return toLocalDateTimeInput(d);
  })();

  function submit(form: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await toolAction(
        "create_event",
        {
          title: form.get("title"),
          vibe: form.get("vibe") || undefined,
          description: form.get("description") || undefined,
          priceDollars: Number(form.get("price")),
          capacity: Number(form.get("capacity")),
          startsAtIso: new Date(String(form.get("startsAt"))).toISOString(),
          locationHint: form.get("locationHint") || undefined,
          locationAddress: form.get("locationAddress") || undefined,
          theme: form.get("theme") || undefined,
          template: form.get("template") || "dinner",
          showTitle: form.get("showTitle") || undefined,
        },
        ["/host"],
      );
      if (!res.ok) return setError(res.error);
      const { event } = res.data as { event: { id: string } };
      router.push(`/host/events/${event.id}`);
    });
  }

  return (
    <form action={submit} className="card p-6 space-y-4 rise-in">
      <div>
        <label className="block text-sm font-semibold mb-1.5">Title</label>
        <input className="field" name="title" placeholder="Six-Course Oaxacan Night" required minLength={3} />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">Vibe (one line)</label>
        <input className="field" name="vibe" placeholder="natural wine, strangers welcome" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">Description</label>
        <textarea className="field min-h-24" name="description" placeholder="What's cooking, what to expect…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Price ($)</label>
          <input className="field" name="price" type="number" min={0} step="1" defaultValue={85} required />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">Seats</label>
          <input className="field" name="capacity" type="number" min={1} max={500} defaultValue={10} required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">Date & time</label>
        <input className="field" name="startsAt" type="datetime-local" defaultValue={defaultDate} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Theme</label>
          <select className="field" name="theme" defaultValue="classic">
            {Object.values(THEMES).map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji} {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">Format</label>
          <select className="field" name="template" defaultValue="dinner">
            <option value="dinner">🍽 Dinner / party</option>
            <option value="run_club">🏃 Run club (waiver + bibs)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">
          Show <span className="font-normal text-[color:var(--color-ink-faint)]">(optional — makes this an episode of a series)</span>
        </label>
        <input className="field" name="showTitle" placeholder="Sunday Gravy" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">Public location teaser</label>
        <input className="field" name="locationHint" placeholder="Silver Lake — exact address after booking" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1.5">Exact address (revealed only after payment)</label>
        <input className="field" name="locationAddress" placeholder="1234 Sunset Blvd, Los Angeles" />
      </div>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending} type="submit">
        {pending ? "Setting the table…" : "Create draft"}
      </button>
    </form>
  );
}
