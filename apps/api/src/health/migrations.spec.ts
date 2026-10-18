import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPendingMigrations, listExpectedMigrations } from './migrations.js';

describe('migrations helpers', () => {
  it('lists migration directories in order and ignores files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'svetly-migrations-'));
    await mkdir(join(dir, '20260102000000_b'));
    await mkdir(join(dir, '20260101000000_a'));
    await writeFile(join(dir, 'migration_lock.toml'), '');
    expect(await listExpectedMigrations(dir)).toEqual(['20260101000000_a', '20260102000000_b']);
  });

  it('finds migrations that are not applied', () => {
    expect(findPendingMigrations(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
    expect(findPendingMigrations(['a'], ['a'])).toEqual([]);
  });
});
