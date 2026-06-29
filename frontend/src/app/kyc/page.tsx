'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';
import { updateCompanyKYC, getProfile } from '@/lib/api';
import { ValidatedInput } from '@/components/ValidatedField';
import {
  PageHeader, Card, Banner, Button, Field, ConfirmDialog,
  PermissionDenied, LoadingBlock,
} from '@/components/ui';
import {
  validateForm,
  required,
  optional,
  email as vEmail,
  mobile as vMobile,
  personName,
  cin as vCin,
  gstin as vGstin,
  pan as vPan,
  din as vDin
} from '@/lib/validators';

export default function KycOnboardingPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Form states
  const [form, setForm] = useState({
    cin: '',
    gstin: '',
    directorName: '',
    directorPan: '',
    directorDin: '',
    signingAuthorityName: '',
    signingAuthorityEmail: '',
    signingAuthorityPhone: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactPersonPhone: '',
    logoUrl: '',
    customInfo: '',
    demoCallDate: ''
  });

  useEffect(() => {
    if (user) {
      setForm({
        cin: user.companyCin || '',
        gstin: '',
        directorName: '',
        directorPan: '',
        directorDin: '',
        signingAuthorityName: '',
        signingAuthorityEmail: '',
        signingAuthorityPhone: '',
        contactPersonName: '',
        contactPersonEmail: '',
        contactPersonPhone: '',
        logoUrl: user.companyLogo || '',
        customInfo: '',
        demoCallDate: ''
      });
    }
  }, [user]);

  // Run the validators and gate submission, then open the confirmation dialog.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const { isValid, firstError } = validateForm(
      {
        cin: form.cin,
        gstin: form.gstin,
        directorName: form.directorName,
        directorPan: form.directorPan,
        directorDin: form.directorDin,
        signingAuthorityName: form.signingAuthorityName,
        signingAuthorityEmail: form.signingAuthorityEmail,
        signingAuthorityPhone: form.signingAuthorityPhone,
        contactPersonName: form.contactPersonName,
        contactPersonEmail: form.contactPersonEmail,
        contactPersonPhone: form.contactPersonPhone
      },
      {
        cin: vCin,
        gstin: optional(vGstin),
        directorName: optional(personName('Director name')),
        directorPan: optional(vPan),
        directorDin: optional(vDin),
        signingAuthorityName: optional(personName('Signatory name')),
        signingAuthorityEmail: optional(vEmail),
        signingAuthorityPhone: optional(vMobile),
        contactPersonName: optional(personName('Contact person name')),
        contactPersonEmail: optional(vEmail),
        contactPersonPhone: optional(vMobile)
      }
    );
    if (!isValid) {
      setError(firstError || 'Please correct the highlighted fields.');
      setSuccess(false);
      return;
    }
    setError('');
    setSuccess(false);

    if (!form.demoCallDate) {
      setError('Please schedule a quick demo call to continue onboarding.');
      return;
    }

    setConfirmOpen(true);
  };

  const submitKyc = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await updateCompanyKYC(form);
      setSuccess(true);

      // Refresh user profile in auth context
      const freshProfile = await getProfile();
      login(undefined, freshProfile, freshProfile.permissions);

      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit KYC details.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const renderBody = () => {
    if (loading || !user) {
      return <LoadingBlock label="Loading onboarding…" />;
    }

    if (user.role !== 'ADMIN') {
      return <PermissionDenied message="Access Denied. Company Tenant Administrators Only." />;
    }

    const isRejected = user.companyKycStatus === 'REJECTED';
    const isNeedsInfo = user.companyKycStatus === 'NEEDS_INFO';
    const needsAction = isRejected || isNeedsInfo;

    return (
      <>
        <PageHeader
          title="Company Compliance & Branding"
          subtitle="Submit mandatory KYC details, schedule your onboarding usage demo, and customize your tenant branding."
        />

        {/* Status Display Banner */}
        <div style={{ marginBottom: '2rem' }}>
          <Banner tone={isRejected ? 'danger' : isNeedsInfo ? 'warning' : 'warning'} title={`KYC Status: ${(user.companyKycStatus || 'PENDING').replace(/_/g, ' ')}`}>
            <p style={{ margin: 0 }}>
              {isRejected
                ? 'Your submission was rejected by the reviewer. Please correct the fields below and submit again.'
                : isNeedsInfo
                ? 'The reviewer needs more information before approving. Please review their note, update the details below, and resubmit.'
                : 'Your KYC verification is currently pending review. Attendance & Leave modules are fully active during verification. Full features will activate upon approval.'}
            </p>
            {needsAction && user.companyKycRemarks && (
              <div style={{ marginTop: 8, padding: '0.6rem 0.8rem', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: '0.85rem' }}>
                <strong>Reviewer note:</strong> {user.companyKycRemarks}
              </div>
            )}
            {user.companyCin && (
              <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                Active CIN: <code style={{ color: 'var(--accent)' }}>{user.companyCin}</code>
              </div>
            )}
          </Banner>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '1000px' }}>
          {/* Left Column: KYC Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card title="Mandatory Compliance Identification">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Corporate Identification Number (CIN)" required>
                  <ValidatedInput
                    type="text"
                    placeholder="e.g. U72200MH2021PTC354000"
                    value={form.cin}
                    onChange={v => setForm(prev => ({ ...prev, cin: v }))}
                    validator={vCin}
                    restrict="upperAlnum"
                    maxLength={21}
                    forceError={submitted}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="GSTIN Number">
                  <ValidatedInput
                    type="text"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={form.gstin}
                    onChange={v => setForm(prev => ({ ...prev, gstin: v }))}
                    validator={optional(vGstin)}
                    restrict="upperAlnum"
                    maxLength={15}
                    forceError={submitted}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Director Information">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Director Name">
                  <ValidatedInput
                    type="text"
                    value={form.directorName}
                    onChange={v => setForm(prev => ({ ...prev, directorName: v }))}
                    validator={optional(personName('Director name'))}
                    restrict="alpha"
                    forceError={submitted}
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Director PAN">
                    <ValidatedInput
                      type="text"
                      value={form.directorPan}
                      onChange={v => setForm(prev => ({ ...prev, directorPan: v }))}
                      validator={optional(vPan)}
                      restrict="upperAlnum"
                      maxLength={10}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Director DIN">
                    <ValidatedInput
                      type="text"
                      inputMode="numeric"
                      value={form.directorDin}
                      onChange={v => setForm(prev => ({ ...prev, directorDin: v }))}
                      validator={optional(vDin)}
                      restrict="digits"
                      maxLength={8}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Authorized Signatory">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Signatory Name">
                  <ValidatedInput
                    type="text"
                    value={form.signingAuthorityName}
                    onChange={v => setForm(prev => ({ ...prev, signingAuthorityName: v }))}
                    validator={optional(personName('Signatory name'))}
                    restrict="alpha"
                    forceError={submitted}
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Signatory Email">
                    <ValidatedInput
                      type="email"
                      value={form.signingAuthorityEmail}
                      onChange={v => setForm(prev => ({ ...prev, signingAuthorityEmail: v }))}
                      validator={optional(vEmail)}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Signatory Phone">
                    <ValidatedInput
                      type="text"
                      inputMode="numeric"
                      value={form.signingAuthorityPhone}
                      onChange={v => setForm(prev => ({ ...prev, signingAuthorityPhone: v }))}
                      validator={optional(vMobile)}
                      restrict="digits"
                      maxLength={10}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Customization, Demo & Submit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card title="Tenant Branding & Customization">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Company Logo URL">
                  <input
                    type="url"
                    placeholder="e.g. https://domain.com/logo.png"
                    value={form.logoUrl}
                    onChange={e => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Custom Company Info / Notes">
                  <textarea
                    rows={3}
                    placeholder="Brief notes about your business operations..."
                    value={form.customInfo}
                    onChange={e => setForm(prev => ({ ...prev, customInfo: e.target.value }))}
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Contact Person">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Contact Person Name">
                  <ValidatedInput
                    type="text"
                    value={form.contactPersonName}
                    onChange={v => setForm(prev => ({ ...prev, contactPersonName: v }))}
                    validator={optional(personName('Contact person name'))}
                    restrict="alpha"
                    forceError={submitted}
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Field label="Contact Email">
                    <ValidatedInput
                      type="email"
                      value={form.contactPersonEmail}
                      onChange={v => setForm(prev => ({ ...prev, contactPersonEmail: v }))}
                      validator={optional(vEmail)}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Contact Phone">
                    <ValidatedInput
                      type="text"
                      inputMode="numeric"
                      value={form.contactPersonPhone}
                      onChange={v => setForm(prev => ({ ...prev, contactPersonPhone: v }))}
                      validator={optional(vMobile)}
                      restrict="digits"
                      maxLength={10}
                      forceError={submitted}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Schedule Onboarding Demo Call *">
              <Field
                label="Choose a convenient date and time for our representatives to walk you through standard payroll setup."
                required
              >
                <input
                  type="datetime-local"
                  value={form.demoCallDate}
                  onChange={e => setForm(prev => ({ ...prev, demoCallDate: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </Field>
            </Card>

            {error && (
              <Banner tone="danger">{error}</Banner>
            )}

            {success && (
              <Banner tone="success">
                KYC information submitted successfully! Redirecting to dashboard...
              </Banner>
            )}

            <Button type="submit" loading={submitting} disabled={submitting} fullWidth>
              {submitting ? 'Submitting Details...' : 'Submit Verification Details'}
            </Button>
          </div>
        </form>

        <ConfirmDialog
          open={confirmOpen}
          title="Submit KYC details?"
          message="Your compliance and branding details will be sent to the super admin for verification. You can resubmit if any field needs correction."
          confirmLabel="Submit Verification"
          loading={submitting}
          onConfirm={submitKyc}
          onCancel={() => setConfirmOpen(false)}
        />
      </>
    );
  };

  return (
    <ProtectedRoute>
      <div className="app-layout">
        <Sidebar activePath="/kyc" />
        <main className="main-content">
          {renderBody()}
        </main>
      </div>
    </ProtectedRoute>
  );
}
