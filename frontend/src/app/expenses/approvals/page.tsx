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

export default function ApprovalsCenter() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<TravelAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<TravelAdvance | null>(null);
  const [remarks, setRemarks] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [settledAmountInput, setSettledAmountInput] = useState('');

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
    try {
      const [claimsData, advancesData] = await Promise.all([
        getExpenseClaims({ all: true }),
        getTravelAdvances({ all: true }),
      ]);
      setClaims(claimsData.filter((c: any) => c.status !== 'PAID' && c.status !== 'REJECTED'));
      setAdvances(advancesData.filter((a: any) => a.status !== 'SETTLED' && a.status !== 'REJECTED'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManagerApprove = async (id: string) => {
    try {
      await managerApproveClaim(id, remarks || 'Approved by Manager');
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinanceApprove = async (id: string) => {
    try {
      await financeApproveClaim(id, remarks || 'Approved & Released by Finance', true);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectClaim = async (id: string, level: 'manager' | 'finance') => {
    if (!remarks) {
      alert('Remarks are required when rejecting claims');
      return;
    }
    try {
      await rejectClaim(id, remarks, level);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveAdvance = async (id: string) => {
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
    }
  };

  const handleSettleAdvance = async (id: string) => {
    if (!settledAmountInput) {
      alert('Please specify actual out-of-pocket settled amount');
      return;
    }
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
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const isFinance = user.role === 'FINANCE' || user.role === 'ADMIN';

  return (
    <div className="app-layout">
      <Sidebar activePath="/expenses" />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Claims Approvals Center</h1>
              <p className="page-subtitle">Perform organizational manager audits and finance cash settlements</p>
            </div>
          </div>

          <button onClick={() => router.push('/expenses')} className="btn btn-secondary">
            Back to Dashboard
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Main Inbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Out of Pocket Claims Block */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Pending Expense Claims ({claims.length})</h2>

              {loading ? (
                <div className="loading-container"><div className="loading-spinner" />Loading pending items...</div>
              ) : claims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No pending expense claims to review.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Colleague</th>
                        <th>Claim Details</th>
                        <th>Amount</th>
                        <th>Stage</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map(claim => (
                        <tr key={claim.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'white' }}>{claim.employee.firstName} {claim.employee.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{claim.employee.jobTitle}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.82rem' }}>{claim.title}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Category: {claim.category}</div>
                          </td>
                          <td style={{ fontWeight: 600, color: 'white' }}>{claim.currency} {claim.amount.toLocaleString()}</td>
                          <td>
                            <span className="badge" style={{
                              background: claim.status === 'APPROVED_BY_MANAGER' ? '#00A7B5' : '#eab308',
                              color: 'white', fontSize: '0.65rem'
                            }}>
                              {claim.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => { setSelectedClaim(claim); setSelectedAdvance(null); }} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: '#10b981', border: 'none' }}>
                              Audit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Travel Cash Advances Block */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Travel Advance Requests ({advances.length})</h2>

              {loading ? (
                <div className="loading-container"><div className="loading-spinner" />Loading advances...</div>
              ) : advances.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No pending travel advances to review.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Colleague</th>
                        <th>Purpose</th>
                        <th>Requested</th>
                        <th>State</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advances.map(adv => (
                        <tr key={adv.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'white' }}>{adv.employee.firstName} {adv.employee.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{adv.employee.jobTitle}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.82rem' }}>{adv.purpose}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date: {new Date(adv.claimDate).toLocaleDateString()}</div>
                          </td>
                          <td style={{ fontWeight: 600, color: 'white' }}>INR {adv.amountRequested.toLocaleString()}</td>
                          <td>
                            <span className="badge" style={{
                              background: adv.status === 'APPROVED' ? '#00A7B5' : '#eab308',
                              color: 'white', fontSize: '0.65rem'
                            }}>
                              {adv.status}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => { setSelectedAdvance(adv); setSelectedClaim(null); }} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: '#00A7B5', border: 'none' }}>
                              Audit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Audit Workspace */}
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Review Workspace</h2>

            {/* Claim Audit Form */}
            {selectedClaim && (
              <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>Audit: {selectedClaim.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Filed by {selectedClaim.employee.firstName} {selectedClaim.employee.lastName} ({selectedClaim.employee.jobTitle})
                  </p>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div>Category: <strong style={{ color: 'white' }}>{selectedClaim.category}</strong></div>
                  <div>Claim Amount: <strong style={{ color: 'white' }}>{selectedClaim.currency} {selectedClaim.amount.toLocaleString()}</strong></div>
                  {selectedClaim.description && <div>Description: "{selectedClaim.description}"</div>}
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Audit Remarks / Feedback</label>
                  <textarea placeholder="Provide remarks for your approval or rejection..." required value={remarks} onChange={e => setRemarks(e.target.value)} className="input-field" style={{ minHeight: '80px', fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedClaim.status === 'PENDING' && (
                    <button onClick={() => handleManagerApprove(selectedClaim.id)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #00A7B5, #0B7890)', border: 'none', flex: 1, fontSize: '0.72rem' }}>
                      Manager Approve
                    </button>
                  )}
                  {isFinance && selectedClaim.status === 'APPROVED_BY_MANAGER' && (
                    <button onClick={() => handleFinanceApprove(selectedClaim.id)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', flex: 1, fontSize: '0.72rem' }}>
                      Finance Settle & Paid
                    </button>
                  )}
                  <button onClick={() => handleRejectClaim(selectedClaim.id, selectedClaim.status === 'PENDING' ? 'manager' : 'finance')} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', flex: 1, fontSize: '0.72rem' }}>
                    Reject Claim
                  </button>
                </div>
              </div>
            )}

            {/* Advance Audit Form */}
            {selectedAdvance && (
              <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>Audit: Travel Cash Advance</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Colleague: {selectedAdvance.employee.firstName} {selectedAdvance.employee.lastName} ({selectedAdvance.employee.jobTitle})
                  </p>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div>Purpose: <strong style={{ color: 'white' }}>"{selectedAdvance.purpose}"</strong></div>
                  <div>Requested Amount: <strong style={{ color: 'white' }}>INR {selectedAdvance.amountRequested.toLocaleString()}</strong></div>
                  {selectedAdvance.amountApproved && <div>Approved Limit: <strong style={{ color: '#00A7B5' }}>INR {selectedAdvance.amountApproved.toLocaleString()}</strong></div>}
                </div>

                {selectedAdvance.status === 'PENDING' ? (
                  <form onSubmit={e => { e.preventDefault(); handleApproveAdvance(selectedAdvance.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Approve Cash Limit (INR)</label>
                      <input type="number" placeholder="Leave empty to approve full request" value={approveAmount} onChange={e => setApproveAmount(e.target.value)} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Remarks</label>
                      <input type="text" placeholder="e.g. Settle flight directly in portal" value={remarks} onChange={e => setRemarks(e.target.value)} className="input-field" />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #00A7B5, #0B7890)', border: 'none', fontSize: '0.75rem' }}>
                      Release Cash Advance
                    </button>
                  </form>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); handleSettleAdvance(selectedAdvance.id); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Actual Spent Amount Settled (INR)</label>
                      <input type="number" required placeholder="e.g. 14200" value={settledAmountInput} onChange={e => setSettledAmountInput(e.target.value)} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Settle Remarks / Balance Refund</label>
                      <input type="text" placeholder="e.g. Returned INR 800 balance to cash box" value={remarks} onChange={e => setRemarks(e.target.value)} className="input-field" />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontSize: '0.75rem' }}>
                      Conclude & Settle Travel Advance
                    </button>
                  </form>
                )}
              </div>
            )}

            {!selectedClaim && !selectedAdvance && (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Select a pending expense claim or travel cash advance from the left to load audit forms.
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
