/**
 * Pilot CSV export builder — privacy, escaping, and formula-injection tests.
 * Pure functions; no network, no DOM download here (see dashboard test).
 */
import { describe, it, expect } from 'vitest';
import type { PilotMetricsResponse } from '@workspace/api-client-react';
import {
  PILOT_CSV_HEADER,
  buildPilotMetricsCsv,
  csvField,
  pilotMetricsCsvFilename,
} from './pilot-csv';

const col = (name: (typeof PILOT_CSV_HEADER)[number]) => PILOT_CSV_HEADER.indexOf(name);

function makeData(overrides?: Partial<PilotMetricsResponse>): PilotMetricsResponse {
  return {
    pilot: {
      startDate: '2026-08-27',
      endDate: '2026-10-01',
      isProjected: false,
      configWarning: null,
      providerTarget: 5,
      generatedAt: '2026-08-28T12:00:00.000Z',
    },
    summary: {
      approvedProviders: 2,
      activatedProviders: 1,
      activationRate: 0.5,
      providersWithPublishedBookingPage: 1,
      providersWithAttributedBookings: 1,
      totalBookings: 4,
      completedBookings: 2,
      cancelledBookings: 1,
      noShowBookings: 1,
      completionRate: 0.5,
      cancellationRate: 0.25,
      noShowRate: 0.25,
      supportEscalations: 1,
      retentionYes: 1,
      retentionNo: 0,
      retentionUnknown: 1,
    },
    providers: [
      {
        providerId: '4',
        providerName: 'Sarah Chen',
        approvalStatus: 'approved',
        activationStatus: 'active',
        onboardingMilestones: {
          accountCreated: true,
          profileCompleted: true,
          verificationSubmitted: true,
          approved: true,
          serviceAreaConfigured: true,
          serviceConfigured: true,
          availabilityConfigured: true,
          bookingPagePublished: true,
          firstBookingReceived: true,
        },
        bookingPagePublished: true,
        firstBookingAt: '2026-08-29T15:00:00.000Z',
        bookings: 4,
        completions: 2,
        cancellations: 1,
        noShows: 1,
        completionRate: 0.5,
        cancellationRate: 0.25,
        noShowRate: 0.25,
        repeatClientRate: 0.5,
        attributedBookings: 4,
        retentionIntent: 'yes',
        retentionUpdatedAt: '2026-08-30T00:00:00.000Z',
        riskFlags: ['high_cancellation_rate'],
      },
    ],
    sourceAttribution: [
      { source: 'instagram', bookings: 3, percentage: 0.75 },
      { source: 'unknown', bookings: 1, percentage: 0.25 },
    ],
    ...overrides,
  };
}

describe('pilot CSV export', () => {
  it('emits the allowlisted header and one row per record with recordType', () => {
    const csv = buildPilotMetricsCsv(makeData());
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(PILOT_CSV_HEADER.join(','));
    expect(lines).toHaveLength(1 + 1 + 1 + 2);
    expect(lines[1].startsWith('summary,')).toBe(true);
    expect(lines[2].startsWith('provider,')).toBe(true);
    expect(lines[3].startsWith('source_attribution,')).toBe(true);
    expect(lines[4].startsWith('source_attribution,')).toBe(true);
  });

  it('includes pilot window, projected indicator, and summary metrics', () => {
    const data = makeData();
    data.pilot.isProjected = true;
    const summaryRow = buildPilotMetricsCsv(data).trimEnd().split('\r\n')[1].split(',');
    expect(summaryRow[col('pilotStartDate')]).toBe('2026-08-27');
    expect(summaryRow[col('pilotEndDate')]).toBe('2026-10-01');
    expect(summaryRow[col('pilotWindowProjected')]).toBe('true');
    expect(summaryRow[col('generatedAt')]).toBe('2026-08-28T12:00:00.000Z');
    expect(summaryRow[col('approvedProviders')]).toBe('2');
    expect(summaryRow[col('activationRate')]).toBe('0.5');
    expect(summaryRow[col('providersWithFirstBooking')]).toBe('1');
    expect(summaryRow[col('supportEscalations')]).toBe('1');
  });

  it('emits provider metrics including retention intent and risk flags', () => {
    const providerRow = buildPilotMetricsCsv(makeData()).trimEnd().split('\r\n')[2].split(',');
    expect(providerRow[col('providerId')]).toBe('4');
    expect(providerRow[col('providerName')]).toBe('Sarah Chen');
    expect(providerRow[col('activationStatus')]).toBe('active');
    expect(providerRow[col('retentionIntent')]).toBe('yes');
    expect(providerRow[col('riskFlags')]).toBe('high_cancellation_rate');
    expect(providerRow[col('completionRate')]).toBe('0.5');
  });

  it('emits source attribution rows with counts and fraction percentages', () => {
    const lines = buildPilotMetricsCsv(makeData()).trimEnd().split('\r\n');
    const instagram = lines[3].split(',');
    expect(instagram[col('source')]).toBe('instagram');
    expect(instagram[col('sourceBookings')]).toBe('3');
    expect(instagram[col('sourcePercentage')]).toBe('0.75');
  });

  it('leaves undefined rates as empty cells — never a misleading 0', () => {
    const data = makeData();
    data.summary.activationRate = null;
    data.summary.completionRate = null;
    data.summary.cancellationRate = null;
    data.summary.noShowRate = null;
    const summaryRow = buildPilotMetricsCsv(data).trimEnd().split('\r\n')[1].split(',');
    expect(summaryRow[col('activationRate')]).toBe('');
    expect(summaryRow[col('completionRate')]).toBe('');
    expect(summaryRow[col('cancellationRate')]).toBe('');
    expect(summaryRow[col('noShowRate')]).toBe('');
  });

  it('escapes commas and quotes per RFC 4180', () => {
    const data = makeData();
    data.providers[0].providerName = 'Chen, "Sarah"';
    const csv = buildPilotMetricsCsv(data);
    expect(csv).toContain('"Chen, ""Sarah"""');
  });

  it('neutralizes spreadsheet formula injection in string fields', () => {
    const data = makeData();
    data.providers[0].providerName = '=HYPERLINK("http://evil.example")';
    const csv = buildPilotMetricsCsv(data);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).not.toContain(',=HYPERLINK');
  });

  it('guards strings but never mangles negative numbers', () => {
    expect(csvField('=1+2')).toBe("'=1+2");
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-cmd')).toBe("'-cmd");
    expect(csvField('@import')).toBe("'@import");
    expect(csvField(-5)).toBe('-5');
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('never contains private or internal fields', () => {
    const csv = buildPilotMetricsCsv(makeData());
    expect(csv).not.toMatch(/email|address|postal|note|token|updatedBy|document|reviewer/i);
    expect(PILOT_CSV_HEADER.join(',')).not.toMatch(/updatedBy|email|address|note/i);
  });

  it('names the download from the generation date', () => {
    expect(pilotMetricsCsvFilename('2026-08-28T12:00:00.000Z')).toBe(
      'pilot-operations-metrics-2026-08-28.csv',
    );
  });
});
