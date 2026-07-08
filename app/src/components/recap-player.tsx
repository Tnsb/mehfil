"use client";

/**
 * Story-format recap player: full-screen slides, auto-advance, tap to skip.
 * Used for both the episode recap and the season finale ("a trailer for the
 * life you're living").
 */
import Link from "next/link";
import { useEffect, useState } from "react";

export type RecapSlide = {
  id: string;
  kicker?: string;
  title: string;
  body?: string;
  imageDataUrl?: string;
  emoji?: string;
};

export function RecapPlayer({
  slides,
  palette,
  doneHref,
  doneLabel,
}: {
  slides: RecapSlide[];
  palette: { from: string; to: string; accent: string };
  doneHref: string;
  doneLabel: string;
}) {
  const [idx, setIdx] = useState(0);
  const done = idx >= slides.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setIdx((i) => i + 1), 3400);
    return () => clearTimeout(t);
  }, [idx, done]);

  const slide = slides[Math.min(idx, slides.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col text-white select-none"
      style={{
        background: `linear-gradient(150deg, ${palette.from}, ${palette.to} 65%, ${palette.accent})`,
      }}
      onClick={() => !done && setIdx((i) => i + 1)}
    >
      {/* progress bars */}
      <div className="flex gap-1 p-3">
        {slides.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: i < idx ? "100%" : i === idx && !done ? "50%" : done ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {!done ? (
        <div key={slide.id} className="flex-1 flex flex-col items-center justify-center px-8 text-center slide-in">
          {slide.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.imageDataUrl}
              alt=""
              className="max-h-[46vh] w-auto rounded-xl shadow-2xl mb-6 rotate-[-1.5deg]"
            />
          ) : slide.emoji ? (
            <p className="text-6xl mb-6">{slide.emoji}</p>
          ) : null}
          {slide.kicker ? (
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70 mb-2">{slide.kicker}</p>
          ) : null}
          <h2 className="font-display text-3xl md:text-4xl font-semibold [text-wrap:balance] leading-tight">
            {slide.title}
          </h2>
          {slide.body ? <p className="text-white/85 mt-3 max-w-md">{slide.body}</p> : null}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center slide-in gap-5">
          <p className="text-5xl">🎬</p>
          <h2 className="font-display text-3xl font-semibold">That&apos;s a wrap.</h2>
          <Link href={doneHref} className="btn bg-white text-black hover:opacity-90" onClick={(e) => e.stopPropagation()}>
            {doneLabel}
          </Link>
        </div>
      )}

      <div className="p-4 text-center">
        <Link
          href={doneHref}
          className="text-white/60 text-sm underline underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          skip
        </Link>
      </div>
    </div>
  );
}
