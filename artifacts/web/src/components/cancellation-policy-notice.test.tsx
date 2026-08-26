import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CancellationPolicyNotice from './cancellation-policy-notice';
import { axeViolations } from '../test/axe';

describe('CancellationPolicyNotice', () => {
  it('renders server-provided policy copy verbatim', () => {
    render(
      <CancellationPolicyNotice
        noticeHours={24}
        summary="Free cancellation until 24 hours before the visit."
      />,
    );
    expect(screen.getByTestId('cancellation-policy-text')).toHaveTextContent(
      'Free cancellation until 24 hours before the visit.',
    );
    expect(screen.getByRole('note', { name: /cancellation policy/i })).toBeInTheDocument();
  });

  it('falls back to client copy with the notice window', () => {
    render(<CancellationPolicyNotice noticeHours={48} />);
    expect(screen.getByTestId('cancellation-policy-text')).toHaveTextContent(
      /Free cancellation until 48 hours before/,
    );
    expect(screen.getByTestId('cancellation-policy-text')).toHaveTextContent(/no fee is charged/i);
  });

  it('provider variant explains the reason + no-show rules', () => {
    render(<CancellationPolicyNotice noticeHours={24} variant="provider" />);
    expect(screen.getByTestId('cancellation-policy-text')).toHaveTextContent(/requires a reason/i);
    expect(screen.getByTestId('cancellation-policy-text')).toHaveTextContent(
      /No-shows can be marked only after the scheduled time/i,
    );
  });

  it('never exposes internal state identifiers', () => {
    render(<CancellationPolicyNotice noticeHours={24} />);
    const text = screen.getByTestId('cancellation-policy-notice').textContent ?? '';
    expect(text).not.toMatch(/client_cancelled|provider_cancelled|cancelled_by_support|no_show/);
  });

  it('accessibility: has no axe violations', async () => {
    const { container } = render(<CancellationPolicyNotice noticeHours={24} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
