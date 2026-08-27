/**
 * Client-side CSV export for the platform-admin pilot dashboard.
 *
 * Built ONLY from the already-authorized `GET /api/admin/pilot/metrics`
 * payload — no extra endpoint, no export library. The Part 1 API is already
 * privacy-redacted; this builder additionally allowlists every column, so no
 * client PII, addresses, notes, document references, audit identifiers, or
 * tracking parameters can ever appear.
 *
 * Safety: RFC 4180 escaping (quote doubling, CRLF rows) plus spreadsheet
 * formula-injection protection for string fields starting with = + - @.
 */
import type { PilotMetricsResponse } from '@workspace/api-client-react';

export const PILOT_CSV_HEADER = [
  'recordType',
  'pilotStartDate',
  'pilotEndDate',
  'pilotWindowProjected',
  'generatedAt',
  'providerTarget',
  'providerId',
  'providerName',
  'activationStatus',
  'bookingPagePublished',
  'firstBookingAt',
  'bookings',
  'completions',
  'cancellations',
  'noShows',
  'completionRate',
  'cancellationRate',
  'noShowRate',
  'repeatClientRate',
  'retentionIntent',
  'riskFlags',
  'approvedProviders',
  'activatedProviders',
  'activationRate',
  'providersWithPublishedBookingPage',
  'providersWithFirstBooking',
  'totalBookings',
  'completedBookings',
  'cancelledBookings',
  'noShowBookings',
  'supportEscalations',
  'retentionYes',
  'retentionNo',
  'retentionUnknown',
  'source',
  'sourceBookings',
  'sourcePercentage',
] as const;

type CsvValue = string | number | boolean | null | undefined;

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(values: Partial<Record<(typeof PILOT_CSV_HEADER)[number], CsvValue>>): string {
  return PILOT_CSV_HEADER.map((column) => csvField(values[column])).join(',');
}

export function buildPilotMetricsCsv(data: PilotMetricsResponse): string {
  const { pilot, summary, providers, sourceAttribution } = data;
  const shared = {
    pilotStartDate: pilot.startDate,
    pilotEndDate: pilot.endDate,
    pilotWindowProjected: pilot.isProjected,
    generatedAt: pilot.generatedAt,
    providerTarget: pilot.providerTarget,
  };

  const lines: string[] = [PILOT_CSV_HEADER.join(',')];

  lines.push(
    row({
      recordType: 'summary',
      ...shared,
      approvedProviders: summary.approvedProviders,
      activatedProviders: summary.activatedProviders,
      activationRate: summary.activationRate,
      providersWithPublishedBookingPage: summary.providersWithPublishedBookingPage,
      providersWithFirstBooking: providers.filter((p) => p.firstBookingAt !== null).length,
      totalBookings: summary.totalBookings,
      completedBookings: summary.completedBookings,
      cancelledBookings: summary.cancelledBookings,
      noShowBookings: summary.noShowBookings,
      completionRate: summary.completionRate,
      cancellationRate: summary.cancellationRate,
      noShowRate: summary.noShowRate,
      supportEscalations: summary.supportEscalations,
      retentionYes: summary.retentionYes,
      retentionNo: summary.retentionNo,
      retentionUnknown: summary.retentionUnknown,
    }),
  );

  for (const p of providers) {
    lines.push(
      row({
        recordType: 'provider',
        ...shared,
        providerId: p.providerId,
        providerName: p.providerName,
        activationStatus: p.activationStatus,
        bookingPagePublished: p.bookingPagePublished,
        firstBookingAt: p.firstBookingAt,
        bookings: p.bookings,
        completions: p.completions,
        cancellations: p.cancellations,
        noShows: p.noShows,
        completionRate: p.completionRate,
        cancellationRate: p.cancellationRate,
        noShowRate: p.noShowRate,
        repeatClientRate: p.repeatClientRate,
        retentionIntent: p.retentionIntent,
        riskFlags: p.riskFlags.join('; '),
      }),
    );
  }

  for (const s of sourceAttribution) {
    lines.push(
      row({
        recordType: 'source_attribution',
        ...shared,
        source: s.source,
        sourceBookings: s.bookings,
        sourcePercentage: s.percentage,
      }),
    );
  }

  return `${lines.join('\r\n')}\r\n`;
}

export function pilotMetricsCsvFilename(generatedAt: string): string {
  return `pilot-operations-metrics-${generatedAt.slice(0, 10)}.csv`;
}

export function downloadPilotMetricsCsv(data: PilotMetricsResponse): void {
  const blob = new Blob([buildPilotMetricsCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = pilotMetricsCsvFilename(data.pilot.generatedAt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
