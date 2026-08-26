import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupportContactLink from './support-contact-link';
import { useGetSupportContact } from '@workspace/api-client-react';
import { axeViolations } from '../test/axe';

vi.mock('@workspace/api-client-react', () => ({
  useGetSupportContact: vi.fn(),
}));

const mockContact = vi.mocked(useGetSupportContact);

type HookResult = ReturnType<typeof useGetSupportContact>;
const asResult = (data: unknown) => ({ data }) as unknown as HookResult;

describe('SupportContactLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing until the contact is loaded', () => {
    mockContact.mockReturnValue(asResult(undefined));
    const { container } = render(<SupportContactLink testId="support-link" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a mailto link with the configured email label', () => {
    mockContact.mockReturnValue(
      asResult({ contact: { url: 'mailto:help@example.com', label: 'help@example.com', isPlaceholder: false } }),
    );
    render(<SupportContactLink testId="support-link" />);
    const link = screen.getByTestId('support-link');
    expect(link).toHaveAttribute('href', 'mailto:help@example.com');
    expect(link).toHaveTextContent('Need help? help@example.com');
  });

  it('renders an https override with the generic label', () => {
    mockContact.mockReturnValue(
      asResult({ contact: { url: 'https://forms.example.com/support', label: 'Contact support', isPlaceholder: false } }),
    );
    render(<SupportContactLink testId="support-link" />);
    const link = screen.getByTestId('support-link');
    expect(link).toHaveAttribute('href', 'https://forms.example.com/support');
    expect(link).toHaveTextContent('Need help? Contact support');
  });

  it('renders the documented pilot placeholder fallback', () => {
    mockContact.mockReturnValue(
      asResult({ contact: { url: 'mailto:support@foot.app', label: 'support@foot.app', isPlaceholder: true } }),
    );
    render(<SupportContactLink testId="support-link" />);
    expect(screen.getByTestId('support-link')).toHaveAttribute('href', 'mailto:support@foot.app');
  });

  it('accessibility: no axe violations', async () => {
    mockContact.mockReturnValue(
      asResult({ contact: { url: 'mailto:support@foot.app', label: 'support@foot.app', isPlaceholder: true } }),
    );
    const { container } = render(
      <main>
        <SupportContactLink testId="support-link" />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
