"use client";

/** Live countdown chip — drop mechanics need a clock, not a calendar. */
import { useEffect, useState } from "react";

function fmt(ms: number): string {
  if (ms <= 0) return "happening now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function Countdown({ to, prefix }: { to: string | number; prefix?: string }) {
  const target = typeof to === "string" ? new Date(to).getTime() : to;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (left === null) return null;
  return (
    <span className="pill bg-[color:var(--color-ink)] text-[color:var(--color-cream)] tabular-nums">
      ⏳ {prefix ? `${prefix} ` : ""}{fmt(left)}
    </span>
  );
}
