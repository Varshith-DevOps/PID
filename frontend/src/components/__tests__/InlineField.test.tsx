import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineField, { maskValue } from '@/components/InlineField';

describe('maskValue (PII masking)', () => {
  it('masks each identifier type, keeping only safe fragments', () => {
    expect(maskValue('9876543210', 'phone')).toBe('9876xxxx3210');
    expect(maskValue('rajesh@company.com', 'email')).toBe('raj***@company.com');
    expect(maskValue('ABCDE1234F', 'pan')).toBe('ABCDE****F');
    expect(maskValue('123456789012', 'aadhar')).toBe('xxxx xxxx 9012');
    expect(maskValue('12345678', 'account')).toBe('xxxx5678');
    expect(maskValue('', 'pan')).toBe('N/A');
  });
});

describe('InlineField', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders the label and shows N/A for an empty value', () => {
    render(<InlineField label="PAN" value="" fieldKey="pan" canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText('PAN')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('masks a sensitive value until revealed', async () => {
    const user = userEvent.setup();
    render(
      <InlineField label="PAN" value="ABCDE1234F" fieldKey="pan" canEdit={false}
        onSave={vi.fn()} masked maskType="pan" />,
    );
    // Masked by default.
    expect(screen.getByText('ABCDE****F')).toBeInTheDocument();
    expect(screen.queryByText('ABCDE1234F')).not.toBeInTheDocument();
    // Reveal toggle exposes the full value.
    await user.click(screen.getByTitle('Reveal'));
    expect(screen.getByText('ABCDE1234F')).toBeInTheDocument();
  });

  it('blocks save and shows an inline error when the validator fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const panValidator = (v: string) => (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) ? null : 'Enter a valid PAN.');
    const { container } = render(
      <InlineField label="PAN" value="ABCDE1234F" fieldKey="pan" canEdit
        onSave={onSave} validator={panValidator} />,
    );

    await user.click(container.querySelector('.edit-icon-btn')!); // enter edit mode
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'NOTAPAN');
    await user.click(screen.getByText('✓'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid PAN.')).toBeInTheDocument();
  });

  it('saves a valid edit with a change reason', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { container } = render(
      <InlineField label="Job Title" value="Dev" fieldKey="jobTitle" canEdit onSave={onSave} />,
    );

    await user.click(container.querySelector('.edit-icon-btn')!);
    const input = screen.getByDisplayValue('Dev') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'Senior Developer');
    await user.click(screen.getByText('✓'));

    // A reason dialog opens; a reason is required before the change is saved.
    const reasonBox = screen.getByPlaceholderText('Add a brief note…');
    await user.type(reasonBox, 'Correcting a typo');
    await user.click(screen.getByText('Save change'));

    expect(onSave).toHaveBeenCalledWith('jobTitle', 'Senior Developer', 'Correcting a typo');
  });

  it('restricts input to digits when restrict="digits"', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <InlineField label="Mobile" value="" fieldKey="mobile" canEdit onSave={vi.fn()} restrict="digits" maxLength={10} />,
    );
    await user.click(container.querySelector('.edit-icon-btn')!);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '98a76b54321099'); // letters dropped, capped at 10
    expect(input.value).toBe('9876543210');
  });
});
