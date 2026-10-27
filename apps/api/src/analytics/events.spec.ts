import { describe, expect, it } from 'vitest';
import {
  actorHash,
  cleanPath,
  eventFromAudit,
  moduleOf,
  referrerHost,
  sanitizeQuery,
} from './events.js';

describe('analytics event helpers', () => {
  it('maps audited actions to analytics events', () => {
    expect(eventFromAudit('auth.sign_up')).toEqual({ name: 'registration' });
    expect(eventFromAudit('job.created')).toMatchObject({
      name: 'publication_submitted',
      entityType: 'job',
    });
    expect(eventFromAudit('moderation.lost_found_rejected')).toEqual({
      name: 'publication_moderated',
      entityType: 'lost_found',
      meta: { decision: 'rejected' },
    });
    expect(eventFromAudit('auth.sign_in')).toBeNull();
    expect(eventFromAudit('message.deleted')).toBeNull();
  });

  it('drops queries that may contain contact data', () => {
    expect(sanitizeQuery('  Ремонт   КРЫШИ ')).toBe('ремонт крыши');
    expect(sanitizeQuery('+7 913 123-45-67')).toBeNull();
    expect(sanitizeQuery('ivan@mail.ru')).toBeNull();
    expect(sanitizeQuery('https://x.ru')).toBeNull();
    expect(sanitizeQuery('дом 12')).toBe('дом 12');
  });

  it('never keeps query strings in paths', () => {
    expect(cleanPath('/reset-password?token=secret')).toBe('/reset-password');
    expect(cleanPath('https://evil')).toBeNull();
    expect(moduleOf('/jobs/povar?x=1')).toBe('jobs');
    expect(moduleOf('/')).toBe('home');
  });

  it('keeps only foreign referrer hosts and hashes actors', () => {
    expect(referrerHost('https://vk.com/wall?id=1', 'svetly.ru')).toBe('vk.com');
    expect(referrerHost('https://svetly.ru/news', 'svetly.ru')).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
    expect(actorHash('u1')).toHaveLength(16);
    expect(actorHash('u1')).not.toContain('u1');
    expect(actorHash(null)).toBeNull();
  });
});
