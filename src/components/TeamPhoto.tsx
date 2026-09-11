export function TeamPhoto({
  src,
  name,
  size = "md",
}: {
  src: string;
  name: string;
  size?: "sm" | "md" | "lg" | "wide";
}) {
  const box =
    size === "wide"
      ? "h-48 w-full sm:h-56 sm:w-72"
      : size === "lg"
        ? "h-28 w-28 sm:h-32 sm:w-32"
        : size === "sm"
          ? "h-14 w-14"
          : "h-20 w-20 sm:h-24 sm:w-24";

  if (!src) {
    return <div className={`${box} shrink-0 rounded-xl bg-line`} aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`${box} shrink-0 rounded-xl object-cover`}
    />
  );
}
