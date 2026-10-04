export function LiveProgress({
  current,
  total,
  size = "md",
}: {
  current: number | null;
  total: number;
  size?: "sm" | "md";
}) {
  const pct =
    current == null || total === 0
      ? 0
      : Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={size === "sm" ? "font-semibold" : "font-heading text-lg"}>
          {current == null ? "Not started" : `Team ${current} of ${total}`}
        </span>
        <span className="text-xs tabular-nums text-muted">{pct}%</span>
      </div>
      <div
        className={`w-full overflow-hidden rounded-full bg-line ${
          size === "sm" ? "h-1.5" : "h-2.5"
        }`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current ?? 0}
      >
        <div
          className="brand-gradient h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
