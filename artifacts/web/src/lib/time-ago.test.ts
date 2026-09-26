import { describe, it, expect } from 'vitest';
import { timeAgo, daysSince } from './time-ago';

const NOW = new Date('2026-09-26T12:00:00Z');

describe('timeAgo', () => {
  it('returns null for missing or invalid input', () => {
    expect(timeAgo(null, NOW)).toBeNull();
    expect(timeAgo(undefined, NOW)).toBeNull();
    expect(timeAgo('not-a-date', NOW)).toBeNull();
  });

  it('labels sub-minute, minutes, hours, days and months', () => {
    expect(timeAgo('2026-09-26T11:59:40Z', NOW)).toBe('just now');
    expect(timeAgo('2026-09-26T11:15:00Z', NOW)).toBe('45 min ago');
    expect(timeAgo('2026-09-26T11:00:00Z', NOW)).toBe('1 hour ago');
    expect(timeAgo('2026-09-26T03:00:00Z', NOW)).toBe('9 hours ago');
    expect(timeAgo('2026-09-25T12:00:00Z', NOW)).toBe('1 day ago');
    expect(timeAgo('2026-09-23T12:00:00Z', NOW)).toBe('3 days ago');
    expect(timeAgo('2026-08-14T19:49:35Z', NOW)).toBe('1 month ago');
  });

  it('never reports negative durations for future timestamps', () => {
    expect(timeAgo('2026-09-27T12:00:00Z', NOW)).toBe('just now');
  });
});

describe('daysSince', () => {
  it('counts whole days waited and treats missing as 0', () => {
    expect(daysSince(null, NOW)).toBe(0);
    expect(daysSince('2026-09-26T01:00:00Z', NOW)).toBe(0);
    expect(daysSince('2026-09-23T12:00:00Z', NOW)).toBe(3);
    expect(daysSince('2026-08-27T18:34:40Z', NOW)).toBe(29);
  });
});
