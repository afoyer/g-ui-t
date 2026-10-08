/** Groups items under "Today", "Yesterday" or a short date, keeping their order. */
export function groupByDay<T>(items: T[], at: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  for (const item of items) {
    const date = new Date(at(item));
    const d = date.toDateString();
    const label =
      d === today ? "Today" : d === yesterday ? "Yesterday" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups.entries()];
}
