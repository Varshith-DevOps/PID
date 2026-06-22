'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';
import { updateCompanyKYC, getProfile } from '@/lib/api';
import { ValidatedInput } from '@/components/ValidatedField';
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
  const { user, login } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

  if (user?.role !== 'ADMIN') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontWeight: 600 }}>
        Access Denied. Company Tenant Administrators Only.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e17' }}>
        <Sidebar activePath="/kyc" />

        <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', color: '#f3f4f6' }}>
          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>Company Compliance & Branding</h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
              Submit mandatory KYC details, schedule your onboarding usage demo, and customize your tenant branding.
            </p>
          </div>

          {/* Status Display Banner */}
          <div style={{
            background: user.companyKycStatus === 'REJECTED' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${user.companyKycStatus === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: user.companyKycStatus === 'REJECTED' ? '#ef4444' : '#f59e0b', textTransform: 'capitalize' }}>
              KYC Status: {user.companyKycStatus || 'PENDING'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {user.companyKycStatus === 'REJECTED' 
                ? 'Your submission was rejected by the super admin. Please correct the fields below and submit again.'
                : 'Your KYC verification is currently pending review. Attendance & Leave modules are fully active during verification. Full features will activate upon approval.'
              }
            </p>
            {user.companyCin && (
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                Active CIN: <code style={{ color: '#73E0E7' }}>{user.companyCin}</code>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '1000px' }}>
            {/* Left Column: KYC Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Mandatory Compliance Identification</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Corporate Identification Number (CIN) *</label>
                    <ValidatedInput
                      type="text"
                      placeholder="e.g. U72200MH2021PTC354000"
                      value={form.cin}
                      onChange={v => setForm(prev => ({ ...prev, cin: v }))}
                      validator={vCin}
                      restrict="upperAlnum"
                      maxLength={21}
                      forceError={submitted}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>GSTIN Number</label>
                    <ValidatedInput
                      type="text"
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      value={form.gstin}
                      onChange={v => setForm(prev => ({ ...prev, gstin: v }))}
                      validator={optional(vGstin)}
                      restrict="upperAlnum"
                      maxLength={15}
                      forceError={submitted}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Director Information</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Director Name</label>
                    <ValidatedInput
                      type="text"
                      value={form.directorName}
                      onChange={v => setForm(prev => ({ ...prev, directorName: v }))}
                      validator={optional(personName('Director name'))}
                      restrict="alpha"
                      forceError={submitted}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Director PAN</label>
                      <ValidatedInput
                        type="text"
                        value={form.directorPan}
                        onChange={v => setForm(prev => ({ ...prev, directorPan: v }))}
                        validator={optional(vPan)}
                        restrict="upperAlnum"
                        maxLength={10}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Director DIN</label>
                      <ValidatedInput
                        type="text"
                        inputMode="numeric"
                        value={form.directorDin}
                        onChange={v => setForm(prev => ({ ...prev, directorDin: v }))}
                        validator={optional(vDin)}
                        restrict="digits"
                        maxLength={8}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Authorized Signatory</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Signatory Name</label>
                    <ValidatedInput
                      type="text"
                      value={form.signingAuthorityName}
                      onChange={v => setForm(prev => ({ ...prev, signingAuthorityName: v }))}
                      validator={optional(personName('Signatory name'))}
                      restrict="alpha"
                      forceError={submitted}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Signatory Email</label>
                      <ValidatedInput
                        type="email"
                        value={form.signingAuthorityEmail}
                        onChange={v => setForm(prev => ({ ...prev, signingAuthorityEmail: v }))}
                        validator={optional(vEmail)}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Signatory Phone</label>
                      <ValidatedInput
                        type="text"
                        inputMode="numeric"
                        value={form.signingAuthorityPhone}
                        onChange={v => setForm(prev => ({ ...prev, signingAuthorityPhone: v }))}
                        validator={optional(vMobile)}
                        restrict="digits"
                        maxLength={10}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Customization, Demo & Submit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Tenant Branding & Customization</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Company Logo URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://domain.com/logo.png"
                      value={form.logoUrl}
                      onChange={e => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Custom Company Info / Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Brief notes about your business operations..."
                      value={form.customInfo}
                      onChange={e => setForm(prev => ({ ...prev, customInfo: e.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', resize: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Contact Person</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact Person Name</label>
                    <ValidatedInput
                      type="text"
                      value={form.contactPersonName}
                      onChange={v => setForm(prev => ({ ...prev, contactPersonName: v }))}
                      validator={optional(personName('Contact person name'))}
                      restrict="alpha"
                      forceError={submitted}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact Email</label>
                      <ValidatedInput
                        type="email"
                        value={form.contactPersonEmail}
                        onChange={v => setForm(prev => ({ ...prev, contactPersonEmail: v }))}
                        validator={optional(vEmail)}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact Phone</label>
                      <ValidatedInput
                        type="text"
                        inputMode="numeric"
                        value={form.contactPersonPhone}
                        onChange={v => setForm(prev => ({ ...prev, contactPersonPhone: v }))}
                        validator={optional(vMobile)}
                        restrict="digits"
                        maxLength={10}
                        forceError={submitted}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Schedule Onboarding Demo Call *</h2>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px', lineHeight: 1.4 }}>
                    Choose a convenient date and time for our representatives to walk you through standard payroll setup.
                  </label>
                  <input
                    type="datetime-local"
                    value={form.demoCallDate}
                    onChange={e => setForm(prev => ({ ...prev, demoCallDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
                    required
                  />
                </div>
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                  KYC information submitted successfully! Redirecting to dashboard...
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  transition: 'background 0.2s',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#1d4ed8'; }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#2563eb'; }}
              >
                {submitting ? 'Submitting Details...' : 'Submit Verification Details'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
