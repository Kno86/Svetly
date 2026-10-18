import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'prisma', 'migrations');

export async function listExpectedMigrations(dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function findPendingMigrations(expected: string[], applied: string[]): string[] {
  const appliedSet = new Set(applied);
  return expected.filter((name) => !appliedSet.has(name));
}
