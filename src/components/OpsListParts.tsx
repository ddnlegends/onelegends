import type { ReactNode } from "react";

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-line bg-blush text-muted",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${styles}`}
    >
      {children}
    </span>
  );
}

export type InfoItem = { label: string; value: ReactNode; wide?: boolean };

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

export function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={item.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            {item.label}
          </dt>
          <dd className="mt-0.5 whitespace-pre-line break-words">
            {isEmpty(item.value) ? <span className="text-muted">—</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-xl">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(href)) return <>{href}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
      {children}
    </a>
  );
}
