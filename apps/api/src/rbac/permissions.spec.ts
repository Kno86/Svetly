import { describe, expect, it } from 'vitest';
import { bestRank, canManageRole, permissionsForRoles, ROLES } from './permissions.js';

describe('RBAC policy', () => {
  it('ordinary users have no permissions', () => {
    expect(permissionsForRoles([]).size).toBe(0);
    expect(bestRank([])).toBe(Infinity);
  });

  it('unknown role codes grant nothing', () => {
    expect(permissionsForRoles(['root']).size).toBe(0);
  });

  it('merges permissions of several roles', () => {
    expect([...permissionsForRoles(['support', 'moderator'])]).toEqual([
      'users.read',
      'complaints.manage',
      'issues.manage',
      'moderation.announcements',
      'moderation.community',
    ]);
  });

  it('nobody can grant super_admin through the API', () => {
    expect(canManageRole(['super_admin'], 'super_admin')).toBe(false);
  });

  it('only roles strictly below the grantor can be managed', () => {
    expect(canManageRole(['super_admin'], 'admin')).toBe(true);
    expect(canManageRole(['admin'], 'admin')).toBe(false);
    expect(canManageRole(['admin'], 'moderator')).toBe(true);
    expect(canManageRole(['moderator'], 'support')).toBe(false);
    expect(canManageRole([], 'support')).toBe(false);
  });

  it('every role permission is a declared permission', () => {
    expect(
      Object.values(ROLES).every((r) => r.permissions.every((p) => typeof p === 'string')),
    ).toBe(true);
  });
});
