'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  getExpenseClaims,
  managerApproveClaim,
  financeApproveClaim,
  rejectClaim,
  getTravelAdvances,
  approveTravelAdvance,
  settleTravelAdvance as settleAdvance,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  StatusChip,
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
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    department: { name: string };
  };
}

interface TravelAdvance {
  id: string;
  purpose: string;
  amountRequested: number;
  amountApproved?: number;
  status: string;
  claimDate: string;
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    department: { name: string };
  };
}

const EXPENSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

export default function ApprovalsCenter() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<TravelAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Review Workspace State
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<TravelAdvance | null>(null);
  const [remarks, setRemarks] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [settledAmountInput, setSettledAmountInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
        getExpenseClaims({ all: true }),
        getTravelAdvances({ all: true }),
      ]);
      setClaims(claimsData.filter((c: any) => c.status !== 'PAID' && c.status !== 'REJECTED'));
      setAdvances(advancesData.filter((a: any) => a.status !== 'SETTLED' && a.status !== 'REJECTED'));
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManagerApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await managerApproveClaim(id, remarks || 'Approved by Manager');
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinanceApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await financeApproveClaim(id, remarks || 'Approved & Released by Finance', true);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClaim = async (id: string, level: 'manager' | 'finance') => {
    if (!remarks) {
      alert('Remarks are required when rejecting claims');
      return;
    }
    setActionLoading(true);
    try {
      await rejectClaim(id, remarks, level);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAdvance = async (id: string) => {
    setActionLoading(true);
    try {
      await approveTravelAdvance(id, {
        amountApproved: parseFloat(approveAmount || '0') || undefined as any,
        remarks: remarks || 'Cash advance approved',
        status: 'APPROVED',
      });
      setSelectedAdvance(null);
      setRemarks('');
      setApproveAmount('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettleAdvance = async (id: string) => {
    if (!settledAmountInput) {
      alert('Please specify actual out-of-pocket settled amount');
      return;
    }
    setActionLoading(true);
    try {
      await settleAdvance(id, {
        settledAmount: parseFloat(settledAmountInput),
        remarks: remarks || 'Travel expenses settled',
      });
      setSelectedAdvance(null);
      setRemarks('');
      setSettledAmountInput('');
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  const isFinance = user.role === 'FINANCE' || user.role === 'ADMIN';

  const claimColumns: Column<ExpenseClaim>[] = [
    {
      key: 'employee',
      header: 'Colleague',
      render: (claim) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{claim.employee.firstName} {claim.employee.lastName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{claim.employee.jobTitle}</div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Claim Details',
      render: (claim) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{claim.title}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Category: {claim.category}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (claim) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{claim.currency} {claim.amount.toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Stage',
      render: (claim) => <StatusChip status={claim.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: (claim) => (
        <Button variant="success" size="sm" onClick={() => { setSelectedClaim(claim); setSelectedAdvance(null); setRemarks(''); }}>
          Audit
        </Button>
      ),
    },
  ];

  const advanceColumns: Column<TravelAdvance>[] = [
    {
      key: 'employee',
      header: 'Colleague',
      render: (adv) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{adv.employee.firstName} {adv.employee.lastName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{adv.employee.jobTitle}</div>
        </div>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (adv) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{adv.purpose}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {new Date(adv.claimDate).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      key: 'amountRequested',
      header: 'Requested',
      align: 'right',
      render: (adv) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>INR {adv.amountRequested.toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'State',
      render: (adv) => <StatusChip status={adv.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: (adv) => (
        <Button variant="primary" size="sm" onClick={() => { setSelectedAdvance(adv); setSelectedClaim(null); setRemarks(''); }}>
          Audit
        </Button>
      ),
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar activePath="/expenses" />
      <main className="main-content">

        <PageHeader
          title="Claims Approvals Center"
          subtitle="Perform organizational manager audits and finance cash settlements"
          icon={<div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>{EXPENSE_ICON}</div>}
          actions={
            <Button variant="ghost" onClick={() => router.push('/expenses')}>
              Back to Dashboard
            </Button>
          }
        />

        {error ? (
          <ErrorState
            title="Couldn’t load approvals"
            message="We couldn’t load pending claims and advances. Please try again."
            onRetry={loadData}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Main Inbox */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Out of Pocket Claims Block */}
              <Card title={`Pending Expense Claims (${claims.length})`}>
                <DataTable
                  columns={claimColumns}
                  rows={claims}
                  loading={loading}
                  rowKey={(claim) => claim.id}
                  emptyTitle="No pending expense claims"
                  emptyMessage="There are no expense claims awaiting review."
                />
              </Card>

              {/* Travel Cash Advances Block */}
              <Card title={`Travel Advance Requests (${advances.length})`}>
                <DataTable
                  columns={advanceColumns}
                  rows={advances}
                  loading={loading}
                  rowKey={(adv) => adv.id}
                  emptyTitle="No pending travel advances"
                  emptyMessage="There are no travel advances awaiting review."
                />
              </Card>

            </div>

            {/* Audit Workspace */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Review Workspace</h2>

              {/* Claim Audit Form */}
              {selectedClaim && (
                <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Audit: {selectedClaim.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                      Filed by {selectedClaim.employee.firstName} {selectedClaim.employee.lastName} ({selectedClaim.employee.jobTitle})
                    </p>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>Category: <Badge tone="neutral">{selectedClaim.category}</Badge></div>
                    <div>Claim Amount: <strong style={{ color: 'var(--text-primary)' }}>{selectedClaim.currency} {selectedClaim.amount.toLocaleString()}</strong></div>
                    {selectedClaim.description && <div>Description: &ldquo;{selectedClaim.description}&rdquo;</div>}
                  </div>

                  <Field label="Audit Remarks / Feedback">
                    <textarea
                      className="textarea-field"
                      placeholder="Provide remarks for your approval or rejection..."
                      required
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      style={{ minHeight: '80px' }}
                    />
                  </Field>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedClaim.status === 'PENDING' && (
                      <Button variant="primary" size="sm" loading={actionLoading} style={{ flex: 1 }} onClick={() => handleManagerApprove(selectedClaim.id)}>
                        Manager Approve
                      </Button>
                    )}
                    {isFinance && selectedClaim.status === 'APPROVED_BY_MANAGER' && (
                      <Button variant="success" size="sm" loading={actionLoading} style={{ flex: 1 }} onClick={() => handleFinanceApprove(selectedClaim.id)}>
                        Finance Settle & Paid
                      </Button>
                    )}
                    <Button variant="danger" size="sm" loading={actionLoading} style={{ flex: 1 }} onClick={() => handleRejectClaim(selectedClaim.id, selectedClaim.status === 'PENDING' ? 'manager' : 'finance')}>
                      Reject Claim
                    </Button>
                  </div>
                </Card>
              )}

              {/* Advance Audit Form */}
              {selectedAdvance && (
                <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Audit: Travel Cash Advance</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                      Colleague: {selectedAdvance.employee.firstName} {selectedAdvance.employee.lastName} ({selectedAdvance.employee.jobTitle})
                    </p>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>Purpose: <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{selectedAdvance.purpose}&rdquo;</strong></div>
                    <div>Requested Amount: <strong style={{ color: 'var(--text-primary)' }}>INR {selectedAdvance.amountRequested.toLocaleString()}</strong></div>
                    {selectedAdvance.amountApproved && <div>Approved Limit: <strong style={{ color: 'var(--accent)' }}>INR {selectedAdvance.amountApproved.toLocaleString()}</strong></div>}
                  </div>

                  {selectedAdvance.status === 'PENDING' ? (
                    <form onSubmit={e => { e.preventDefault(); handleApproveAdvance(selectedAdvance.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <Field label="Approve Cash Limit (INR)">
                        <input type="number" className="input-field" placeholder="Leave empty to approve full request" value={approveAmount} onChange={e => setApproveAmount(e.target.value)} />
                      </Field>

                      <Field label="Remarks">
                        <input type="text" className="input-field" placeholder="e.g. Settle flight directly in portal" value={remarks} onChange={e => setRemarks(e.target.value)} />
                      </Field>

                      <Button type="submit" variant="primary" size="sm" loading={actionLoading}>
                        Release Cash Advance
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); handleSettleAdvance(selectedAdvance.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <Field label="Actual Spent Amount Settled (INR)">
                        <input type="number" className="input-field" required placeholder="e.g. 14200" value={settledAmountInput} onChange={e => setSettledAmountInput(e.target.value)} />
                      </Field>

                      <Field label="Settle Remarks / Balance Refund">
                        <input type="text" className="input-field" placeholder="e.g. Returned INR 800 balance to cash box" value={remarks} onChange={e => setRemarks(e.target.value)} />
                      </Field>

                      <Button type="submit" variant="success" size="sm" loading={actionLoading}>
                        Conclude & Settle Travel Advance
                      </Button>
                    </form>
                  )}
                </Card>
              )}

              {!selectedClaim && !selectedAdvance && (
                <Card>
                  <EmptyState
                    title="No item selected"
                    message="Select a pending expense claim or travel cash advance from the left to load audit forms."
                  />
                </Card>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
