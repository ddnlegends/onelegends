/** Event dates are calendar dates, not instants in a viewer's timezone. */
export function parseEventDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function formatEventDateRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  return start.getTime() === end.getTime() ? formatter.format(start) : formatter.formatRange(start, end);
}

export function parseApplicationFee(value: string): number | null | "invalid" {
  if (!value) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value)) return "invalid";
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

export function formatApplicationFee(cents: number | null): string {
  if (cents === null) return "Not provided";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
