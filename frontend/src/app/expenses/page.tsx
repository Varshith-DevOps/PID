'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getExpenseClaims,
  createExpenseClaim,
  getTravelAdvances,
  createTravelAdvance,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { validateForm, required, amount as vAmount } from '@/lib/validators';
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  FileDrop,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusChip,
  TextField,
  Textarea,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface ExpenseClaim {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  status: string;
  receiptUrl?: string;
  description?: string;
  claimDate: string;
  managerRemarks?: string;
  financeRemarks?: string;
}

interface TravelAdvance {
  id: string;
  purpose: string;
  amountRequested: number;
  amountApproved?: number;
  status: string;
  advanceRemarks?: string;
  settledAmount?: number;
  settledDate?: string;
  claimDate: string;
}

const EXPENSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

const CATEGORY_OPTIONS = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'MEALS', label: 'Meals & Diners' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'EQUIPMENT', label: 'Equipment & Assets' },
  { value: 'OTHER', label: 'Other category' },
];

export default function ExpensesDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<TravelAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Modals & Panels
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Claim Form State
  const [claimForm, setClaimForm] = useState({
    title: '',
    category: 'TRAVEL',
    amount: '',
    description: '',
    currency: 'INR',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Travel Advance Form State
  const [advanceForm, setAdvanceForm] = useState({
    purpose: '',
    amountRequested: '',
  });
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);

  // Validation submit flags
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [advanceSubmitted, setAdvanceSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [claimsData, advancesData] = await Promise.all([
        getExpenseClaims(),
        getTravelAdvances(),
      ]);
      setClaims(claimsData);
      setAdvances(advancesData);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimSubmitted(true);
    const { isValid, firstError } = validateForm(
      { title: claimForm.title, category: claimForm.category, amount: claimForm.amount, currency: claimForm.currency },
      { title: required('Title'), category: required('Category'), amount: vAmount, currency: required('Currency') }
    );
    if (!isValid) {
      alert(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setClaimSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', claimForm.title);
      formData.append('category', claimForm.category);
      formData.append('amount', claimForm.amount);
      formData.append('description', claimForm.description);
      formData.append('currency', claimForm.currency);
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      await createExpenseClaim(formData);
      setShowClaimModal(false);
      setClaimForm({ title: '', category: 'TRAVEL', amount: '', description: '', currency: 'INR' });
      setReceiptFile(null);
      setClaimSubmitted(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit expense claim');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvanceSubmitted(true);
    const { isValid, firstError } = validateForm(
      { purpose: advanceForm.purpose, amountRequested: advanceForm.amountRequested },
      { purpose: required('Purpose'), amountRequested: vAmount }
    );
    if (!isValid) {
      alert(firstError || 'Please correct the highlighted fields.');
      return;
    }
    setAdvanceSubmitting(true);
    try {
      await createTravelAdvance({
        purpose: advanceForm.purpose,
        amountRequested: parseFloat(advanceForm.amountRequested),
      });
      setShowAdvanceModal(false);
      setAdvanceForm({ purpose: '', amountRequested: '' });
      setAdvanceSubmitted(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to request travel cash advance');
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  const isAdminOrHROrFinance = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'FINANCE';

  // Statistics
  const totalApprovedClaimsSum = claims
    .filter(c => c.status === 'PAID' || c.status === 'APPROVED_BY_FINANCE')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPendingClaimsSum = claims
    .filter(c => c.status === 'PENDING' || c.status === 'APPROVED_BY_MANAGER')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const advancesOutstanding = advances
    .filter(a => a.status === 'APPROVED' || a.status === 'PAID')
    .reduce((acc, curr) => acc + curr.amountRequested, 0);

  const advancesPendingCount = advances.filter(a => a.status === 'PENDING').length;

  const claimColumns: Column<ExpenseClaim>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (claim) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{claim.title}</div>
          {claim.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{claim.description}</div>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (claim) => <Badge tone="neutral">{claim.category}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (claim) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{claim.currency} {claim.amount.toLocaleString()}</span>,
    },
    {
      key: 'claimDate',
      header: 'Date',
      render: (claim) => <span style={{ fontSize: '0.75rem' }}>{new Date(claim.claimDate).toLocaleDateString()}</span>,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (claim) =>
        claim.receiptUrl ? (
          <Button variant="ghost" size="sm" onClick={() => setSelectedReceiptUrl(claim.receiptUrl || null)}>
            View File
          </Button>
        ) : (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>None</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (claim) => <StatusChip status={claim.status} />,
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        <PageHeader
          title="Expense & Travel Claims"
          subtitle="File out-of-pocket expenses, attach receipts, and request travel advance cash"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>{EXPENSE_ICON}</div>}
          actions={
            <>
              {isAdminOrHROrFinance && (
                <Button variant="ghost" onClick={() => router.push('/expenses/approvals')}>
                  Approvals Center
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowAdvanceModal(true)}>
                Request Advance Cash
              </Button>
              <Button variant="success" onClick={() => setShowClaimModal(true)}>
                + File Out-Of-Pocket
              </Button>
            </>
          }
        />

        {error ? (
          <ErrorState
            title="Couldn’t load expenses"
            message="We couldn’t load your claims and advances. Please try again."
            onRetry={loadData}
          />
        ) : (
          <>
            {/* Aggregate Stats */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <StatCard
                label="Total Reimbursed"
                value={`INR ${totalApprovedClaimsSum.toLocaleString()}`}
                trend={{ value: 'Paid & settled in full', direction: 'up' }}
              />
              <StatCard
                label="Pending Settlements"
                value={`INR ${totalPendingClaimsSum.toLocaleString()}`}
                trend={{ value: 'Awaiting manager or finance signs', direction: 'flat' }}
              />
              <StatCard
                label="Advances Outstanding"
                value={`INR ${advancesOutstanding.toLocaleString()}`}
                trend={{ value: `${advancesPendingCount} advance request pending`, direction: 'flat' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start', marginTop: '1.5rem' }}>

              {/* Expense Claims Table Block */}
              <Card title="Your Out-of-Pocket Claims">
                <DataTable
                  columns={claimColumns}
                  rows={claims}
                  loading={loading}
                  rowKey={(claim) => claim.id}
                  emptyTitle="No expense claims filed yet"
                  emptyMessage="File an out-of-pocket expense to see it here."
                />
              </Card>

              {/* Travel Cash Advances Block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Travel Cash Advances</h2>

                {loading ? (
                  <LoadingBlock label="Loading advances…" />
                ) : advances.length === 0 ? (
                  <Card>
                    <div className="empty-state" style={{ minHeight: '200px' }}>No cash advances requested.</div>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {advances.map(adv => (
                      <Card key={adv.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div>
                            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{adv.purpose}</h3>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Timeline: Requested {new Date(adv.claimDate).toLocaleDateString()}</span>
                          </div>
                          <StatusChip status={adv.status} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <div>Requested: <strong>INR {adv.amountRequested.toLocaleString()}</strong></div>
                          {adv.amountApproved && <div>Approved: <strong style={{ color: 'var(--accent)' }}>INR {adv.amountApproved.toLocaleString()}</strong></div>}
                        </div>

                        {adv.advanceRemarks && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-sunken)', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                            &ldquo;{adv.advanceRemarks}&rdquo;
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}

        {/* Receipt View Modal */}
        <Modal
          open={!!selectedReceiptUrl}
          onClose={() => setSelectedReceiptUrl(null)}
          title="Receipt Attachment Preview"
          width={600}
        >
          {selectedReceiptUrl && (
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              {selectedReceiptUrl.endsWith('.pdf') ? (
                <embed src={`http://localhost:5000${selectedReceiptUrl}`} type="application/pdf" width="100%" height="450px" />
              ) : (
                <img src={`http://localhost:5000${selectedReceiptUrl}`} alt="Receipt attachment" style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain' }} />
              )}
            </div>
          )}
        </Modal>

        {/* File Out of Pocket Modal */}
        <Modal
          open={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          title="File Out-of-Pocket Expense"
          width={440}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>Claim a reimburse for personal business expenses</p>

          <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextField
              label="Claim Title"
              placeholder="e.g. Bangalore Client dinner"
              required
              value={claimForm.title}
              onChange={v => setClaimForm({ ...claimForm, title: v })}
              validator={required('Title')}
              forceError={claimSubmitted}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
              <Select
                label="Category"
                value={claimForm.category}
                onChange={v => setClaimForm({ ...claimForm, category: v })}
                options={CATEGORY_OPTIONS}
              />
              <TextField
                label="Amount"
                placeholder="5000"
                required
                value={claimForm.amount}
                onChange={v => setClaimForm({ ...claimForm, amount: v })}
                validator={vAmount}
                restrict="decimal"
                forceError={claimSubmitted}
              />
            </div>

            <Textarea
              label="Description & Scope"
              placeholder="Outline items purchased and purpose of business claim..."
              value={claimForm.description}
              onChange={v => setClaimForm({ ...claimForm, description: v })}
            />

            <FileDrop
              label="Receipt Attachment File (PDF or Image)"
              accept="image/*,application/pdf"
              hint={receiptFile ? receiptFile.name : 'PDF or image up to your org limit'}
              onFile={(f) => setReceiptFile(f)}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowClaimModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" loading={claimSubmitting}>
                File Reimburse
              </Button>
            </div>
          </form>
        </Modal>

        {/* Cash Advance Modal */}
        <Modal
          open={showAdvanceModal}
          onClose={() => setShowAdvanceModal(false)}
          title="Request Travel Cash Advance"
          width={400}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>Receive an advance cash for scheduled business travels</p>

          <form onSubmit={handleAdvanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextField
              label="Purpose & Travel Detail"
              placeholder="e.g. Flight + hotel for Bangalore client meet"
              required
              value={advanceForm.purpose}
              onChange={v => setAdvanceForm({ ...advanceForm, purpose: v })}
              validator={required('Purpose')}
              forceError={advanceSubmitted}
            />

            <TextField
              label="Cash Amount Requested (INR)"
              placeholder="e.g. 15000"
              required
              value={advanceForm.amountRequested}
              onChange={v => setAdvanceForm({ ...advanceForm, amountRequested: v })}
              validator={vAmount}
              restrict="decimal"
              forceError={advanceSubmitted}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="button" variant="ghost" onClick={() => setShowAdvanceModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" loading={advanceSubmitting}>
                Submit Cash Request
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
