import { describe, it, expect } from 'vitest';
import {
  formatBookingDate,
  formatBookingTime,
  formatBookingDateTime,
} from './marketplace-time';

// All instants are fixed; the test process runs with TZ=UTC (see the `test`
// script) so the device-timezone fallback is deterministic.
const TZ = 'America/Toronto';

describe('marketplace timezone display', () => {
  it('renders a summer instant in the marketplace timezone with its DST abbreviation', () => {
    const s = formatBookingTime('2026-08-25T18:26:00.000Z', TZ);
    expect(s).toMatch(/2:26/);
    expect(s).toContain('EDT');
  });

  it('renders a winter instant with the standard-time abbreviation', () => {
    const s = formatBookingTime('2026-01-15T18:26:00.000Z', TZ);
    expect(s).toMatch(/1:26/);
    expect(s).toContain('EST');
  });

  it('combined date+time carries the zone abbreviation', () => {
    const s = formatBookingDateTime('2026-08-25T18:26:00.000Z', TZ, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    expect(s).toContain('Aug');
    expect(s).toContain('25');
    expect(s).toContain('EDT');
  });
});

describe('DST spring-forward boundary (2026-03-08, America/Toronto)', () => {
  it('one minute before the transition is EST 1:59 a.m.', () => {
    const s = formatBookingTime('2026-03-08T06:59:00.000Z', TZ);
    expect(s).toMatch(/1:59/);
    expect(s).toContain('EST');
  });

  it('the transition instant jumps to EDT 3:00 a.m. (2 a.m. never exists)', () => {
    const s = formatBookingTime('2026-03-08T07:00:00.000Z', TZ);
    expect(s).toMatch(/3:00/);
    expect(s).toContain('EDT');
  });
});

describe('DST fall-back boundary (2026-11-01, America/Toronto)', () => {
  it('the first 1:30 a.m. is EDT', () => {
    const s = formatBookingTime('2026-11-01T05:30:00.000Z', TZ);
    expect(s).toMatch(/1:30/);
    expect(s).toContain('EDT');
  });

  it('the repeated 1:30 a.m. is EST — distinguished only by the abbreviation', () => {
    const s = formatBookingTime('2026-11-01T06:30:00.000Z', TZ);
    expect(s).toMatch(/1:30/);
    expect(s).toContain('EST');
  });
});

describe('date-boundary behavior', () => {
  const opts = { weekday: 'short', month: 'short', day: 'numeric' } as const;

  it('a UTC instant after midnight renders as the previous day in Toronto', () => {
    const s = formatBookingDate('2026-08-26T03:00:00.000Z', TZ, opts);
    expect(s).toContain('Aug');
    expect(s).toContain('25');
    expect(s).toMatch(/Tue/);
  });

  it('the same instant without a marketplace timezone stays on the device (UTC) day', () => {
    const s = formatBookingDate('2026-08-26T03:00:00.000Z', undefined, opts);
    expect(s).toContain('26');
    expect(s).toMatch(/Wed/);
  });
});

describe('device-timezone fallback', () => {
  it('omits any zone abbreviation so callers must label the fallback explicitly', () => {
    const s = formatBookingTime('2026-08-25T18:26:00.000Z', undefined);
    expect(s).not.toMatch(/EDT|EST|UTC|GMT/);
    expect(s).toMatch(/6:26/); // device (TZ=UTC) wall clock
  });
});
