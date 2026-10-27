export type RecoType = 'news' | 'announcement' | 'event';

export interface Candidate {
  type: RecoType;
  id: string;
  slug: string;
  title: string;
  date: Date;
  category: { id: string; name: string } | null;
}

export interface Recommendation extends Omit<Candidate, 'date'> {
  date: string;
  score: number;
  reasons: string[];
}

const DAY = 86_400_000;

/**
 * Deterministic, explainable scoring: every point comes with a human-readable reason.
 * Interest +3; publication not older than 3 days +2, 14 days +1; event within 7 days +2, 30 days +1.
 */
export function score(c: Candidate, interests: Set<string>, now = new Date()): Recommendation {
  const reasons: string[] = [];
  let points = 0;
  if (c.category && interests.has(c.category.id)) {
    points += 3;
    reasons.push(`Категория «${c.category.name}» есть в ваших интересах`);
  }
  if (c.type === 'event') {
    const until = c.date.getTime() - now.getTime();
    if (until <= 7 * DAY) {
      points += 2;
      reasons.push('Событие в ближайшие 7 дней');
    } else if (until <= 30 * DAY) {
      points += 1;
      reasons.push('Событие в ближайший месяц');
    }
  } else {
    const age = now.getTime() - c.date.getTime();
    if (age <= 3 * DAY) {
      points += 2;
      reasons.push('Свежая публикация');
    } else if (age <= 14 * DAY) {
      points += 1;
      reasons.push('Опубликовано за последние две недели');
    }
  }
  return { ...c, date: c.date.toISOString(), score: points, reasons };
}

export function rank(
  candidates: Candidate[],
  interests: Set<string>,
  hidden: Set<string>,
  now = new Date(),
  limit = 20,
): Recommendation[] {
  return candidates
    .filter((c) => !hidden.has(`${c.type}:${c.id}`))
    .map((c) => score(c, interests, now))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit);
}
