import Link from "next/link";

export function BrandMark({
  href = "/",
  size = "nav",
}: {
  href?: string;
  size?: "nav" | "hero";
}) {
  if (size === "hero") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/legends-crown.png"
        alt=""
        className="mx-auto h-24 w-auto sm:h-28 md:h-32"
      />
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2"
      aria-label="OneLegends home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/legends-crown.png" alt="" className="h-9 w-auto" />
      <span className="font-heading text-sm tracking-[0.08em] text-ink sm:text-base">
        OneLegends
      </span>
    </Link>
  );
}
