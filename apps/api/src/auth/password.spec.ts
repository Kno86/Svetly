import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';
import { emailFingerprint } from './auth.service.js';

describe('password hashing', () => {
  it('uses argon2id with OWASP parameters and verifies correctly', async () => {
    const hash = await hashPassword('correct-horse-42');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword({ hash, password: 'correct-horse-42' })).toBe(true);
    expect(await verifyPassword({ hash, password: 'wrong' })).toBe(false);
  });

  it('treats malformed hashes as a failed verification', async () => {
    expect(await verifyPassword({ hash: 'not-a-hash', password: 'x' })).toBe(false);
  });

  it('fingerprints emails case-insensitively without revealing them', () => {
    expect(emailFingerprint(' A@B.test ')).toBe(emailFingerprint('a@b.test'));
    expect(emailFingerprint('a@b.test')).not.toContain('a@b');
    expect(emailFingerprint(undefined)).toBeUndefined();
  });
});
