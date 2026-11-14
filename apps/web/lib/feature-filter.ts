/** Server-safe: `lib/features.ts` is a client module, so server components import this file. */
export function visibleWith<T extends { feature?: string }>(
  items: T[],
  features: Record<string, boolean>,
): T[] {
  return items.filter((i) => !i.feature || features[i.feature] !== false);
}
