export type CaptainContact = { name: string; phone: string };

/** Read old or malformed JSON safely; only complete pairs are displayed. */
export function captainContactsFromJson(value: unknown): CaptainContact[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((entry) =>
    entry && typeof entry === "object" && typeof entry.name === "string" && typeof entry.phone === "string" && entry.name.trim() && entry.phone.trim()
      ? [{ name: entry.name.trim(), phone: entry.phone.trim() }]
      : [],
  );
}
