/** Deterministic vibrant cover art per event — no image assets needed. */

const GRADIENTS = [
  "linear-gradient(125deg, #e5397f, #ff5c38 55%, #ffc94a)",
  "linear-gradient(125deg, #6c4ab6, #e5397f 60%, #ff5c38)",
  "linear-gradient(125deg, #ff5c38, #ffc94a 60%, #2fbf9b)",
  "linear-gradient(125deg, #2fbf9b, #6c4ab6 65%, #e5397f)",
  "linear-gradient(125deg, #ffc94a, #e5397f 55%, #6c4ab6)",
];

const EMOJI = ["🍷", "🕯️", "🍜", "🥂", "🌶️", "🍋", "🫒", "🍑"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function coverStyle(seed: string): React.CSSProperties {
  return { background: GRADIENTS[hash(seed) % GRADIENTS.length] };
}

export function coverEmoji(seed: string): string {
  return EMOJI[hash(seed) % EMOJI.length];
}

export function Cover({
  seed,
  className,
  children,
  theme,
}: {
  seed: string;
  className?: string;
  children?: React.ReactNode;
  /** theme palette override — themes re-render the night, not re-skin it */
  theme?: { from: string; to: string; accent: string; emoji?: string };
}) {
  const style = theme
    ? { background: `linear-gradient(125deg, ${theme.from}, ${theme.to} 62%, ${theme.accent})` }
    : coverStyle(seed);
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={style}>
      <span
        aria-hidden
        className="absolute -right-4 -bottom-6 text-[7rem] opacity-30 select-none rotate-12"
      >
        {theme?.emoji ?? coverEmoji(seed)}
      </span>
      {children}
    </div>
  );
}
