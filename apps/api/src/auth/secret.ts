import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppConfig } from '../config/env.js';

/**
 * Production must supply BETTER_AUTH_SECRET (enforced by loadConfig). Locally a random secret is
 * generated once and kept in a Docker volume, so sessions survive restarts without any `.env`.
 */
export function resolveAuthSecret(config: AppConfig): string {
  if (config.authSecret) return config.authSecret;
  if (config.environment === 'production') throw new Error('BETTER_AUTH_SECRET is required');
  try {
    const existing = readFileSync(config.authSecretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const secret = randomBytes(48).toString('base64url');
  mkdirSync(dirname(config.authSecretFile), { recursive: true, mode: 0o700 });
  writeFileSync(config.authSecretFile, secret, { mode: 0o600, flag: 'wx' });
  return secret;
}
