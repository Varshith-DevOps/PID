'use client';

import { use, useEffect, useState } from 'react';
import {
  acceptPublicOffer,
  downloadPublicOfferPDF,
  getPublicOffer,
  rejectPublicOffer,
} from '@/lib/api';
import { Banner, Button, LoadingBlock, TextField, Textarea } from '@/components/ui';

interface PublicOffer {
  id: string;
  status: string;
  candidateName: string;
  jobTitle: string;
  department?: string | null;
  joiningDate: string;
  offerExpiryDate?: string | null;
  offeredCtc: number | string;
  companyName: string;
  pdfAvailable: boolean;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
}

export default function CandidateOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | null>(null);

  useEffect(() => {
    const loadOffer = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getPublicOffer(token);
        setOffer(data);
        setCandidateName(data.candidateName || '');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'This offer link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    loadOffer();
  }, [token]);

  const handleAccept = async () => {
    if (!acceptedTerms) {
      setError('Please confirm that you have read and accept the offer terms.');
      return;
    }
    setSubmitting('accept');
    setError('');
    try {
      const result = await acceptPublicOffer(token, { acceptedTerms, candidateName });
      setOffer(prev => prev ? { ...prev, status: result.status, acceptedAt: result.acceptedAt } : prev);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not accept the offer.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Reject this offer? This action cannot be undone.')) return;
    setSubmitting('reject');
    setError('');
    try {
      const result = await rejectPublicOffer(token, { reason: rejectReason });
      setOffer(prev => prev ? { ...prev, status: result.status, rejectedAt: result.rejectedAt } : prev);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not reject the offer.');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return <main style={{ minHeight: '100vh', padding: '2rem' }}><LoadingBlock label="Loading offer..." /></main>;
  }

  if (error && !offer) {
    return <main style={{ minHeight: '100vh', padding: '2rem', maxWidth: 720, margin: '0 auto' }}><Banner tone="danger">{error}</Banner></main>;
  }

  if (!offer) return null;
  const isActionable = ['SENT', 'VIEWED'].includes(offer.status);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface-sunken)', padding: '2rem 1rem' }}>
      <section style={{ maxWidth: 820, margin: '0 auto', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', boxShadow: 'var(--shadow-2)' }}>
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{offer.companyName}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Offer of Employment</div>
        </div>

        {error && <div style={{ marginBottom: '1rem' }}><Banner tone="danger">{error}</Banner></div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <div><strong>Candidate:</strong> {offer.candidateName}</div>
          <div><strong>Position:</strong> {offer.jobTitle}</div>
          <div><strong>Department:</strong> {offer.department || 'Not specified'}</div>
          <div><strong>Joining Date:</strong> {new Date(offer.joiningDate).toLocaleDateString()}</div>
          {offer.offerExpiryDate && <div><strong>Offer Expiry:</strong> {new Date(offer.offerExpiryDate).toLocaleDateString()}</div>}
          <div><strong>Status:</strong> {offer.status}</div>
        </div>

        <Button disabled={!offer.pdfAvailable} onClick={() => downloadPublicOfferPDF(token, `Offer-Letter-${offer.candidateName.replace(/\s+/g, '-')}.pdf`)}>
          Download Offer PDF
        </Button>

        {offer.status === 'ACCEPTED' && <div style={{ marginTop: '1rem' }}><Banner tone="success">Offer accepted successfully.</Banner></div>}
        {offer.status === 'REJECTED' && <div style={{ marginTop: '1rem' }}><Banner tone="danger">Offer rejected.</Banner></div>}

        {isActionable && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
              <span>I have read and accept the terms of this offer.</span>
            </label>
            <TextField label="Candidate Full Name" value={candidateName} onChange={setCandidateName} />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button variant="success" loading={submitting === 'accept'} disabled={!!submitting} onClick={handleAccept}>Accept Offer</Button>
            </div>
            <Textarea label="Rejection Reason (optional)" value={rejectReason} onChange={setRejectReason} />
            <Button variant="ghost" loading={submitting === 'reject'} disabled={!!submitting} onClick={handleReject}>Reject Offer</Button>
          </div>
        )}
      </section>
    </main>
  );
}
