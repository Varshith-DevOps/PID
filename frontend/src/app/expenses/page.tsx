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

export default function ExpensesDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<TravelAdvance[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Travel Advance Form State
  const [advanceForm, setAdvanceForm] = useState({
    purpose: '',
    amountRequested: '',
  });

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
        getExpenseClaims(),
        getTravelAdvances(),
      ]);
      setClaims(claimsData);
      setAdvances(advancesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit expense claim');
    }
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTravelAdvance({
        purpose: advanceForm.purpose,
        amountRequested: parseFloat(advanceForm.amountRequested),
      });
      setShowAdvanceModal(false);
      setAdvanceForm({ purpose: '', amountRequested: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to request travel cash advance');
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const isAdminOrHROrFinance = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'FINANCE';

  // Statistics
  const totalApprovedClaimsSum = claims
    .filter(c => c.status === 'PAID' || c.status === 'APPROVED_BY_FINANCE')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPendingClaimsSum = claims
    .filter(c => c.status === 'PENDING' || c.status === 'APPROVED_BY_MANAGER')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <div>
              <h1 className="page-title">Expense & Travel Claims</h1>
              <p className="page-subtitle">File out-of-pocket expenses, attach receipts, and request travel advance cash</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {isAdminOrHROrFinance && (
              <button onClick={() => router.push('/expenses/approvals')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                📥 Approvals Center
              </button>
            )}
            <button onClick={() => setShowAdvanceModal(true)} className="btn btn-secondary" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              Request Advance Cash
            </button>
            <button onClick={() => setShowClaimModal(true)} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
              + File Out-Of-Pocket
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Reimbursed</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              INR {totalApprovedClaimsSum.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '0.5rem' }}>Paid & settled in full</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Pending Settlements</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              INR {totalPendingClaimsSum.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Awaiting manager or finance signs</div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Advances Outstanding</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              INR {advances.filter(a => a.status === 'APPROVED' || a.status === 'PAID').reduce((acc, curr) => acc + curr.amountRequested, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{advances.filter(a => a.status === 'PENDING').length} advance request pending</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Expense Claims Table Block */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Your Out-of-Pocket Claims</h2>

            {loading ? (
              <div className="loading-container"><div className="loading-spinner" />Loading expense claims...</div>
            ) : claims.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>No expense claims filed yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '550px' }}>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Receipt</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map(claim => (
                      <tr key={claim.id}>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.88rem' }}>{claim.title}</div>
                            {claim.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{claim.description}</div>}
                          </div>
                        </td>
                        <td><span style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{claim.category}</span></td>
                        <td style={{ fontWeight: 600, color: 'white' }}>{claim.currency} {claim.amount.toLocaleString()}</td>
                        <td style={{ fontSize: '0.75rem' }}>{new Date(claim.claimDate).toLocaleDateString()}</td>
                        <td>
                          {claim.receiptUrl ? (
                            <button onClick={() => setSelectedReceiptUrl(claim.receiptUrl || null)} className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              📎 View File
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: claim.status === 'PAID' ? '#10b981' : claim.status.startsWith('APPROVED') ? '#00A7B5' : claim.status === 'REJECTED' ? '#ef4444' : '#eab308',
                            color: 'white', fontSize: '0.65rem'
                          }}>
                            {claim.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Travel Cash Advances Block */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>Travel Cash Advances</h2>

            {loading ? (
              <div className="loading-container"><div className="loading-spinner" />Loading advances...</div>
            ) : advances.length === 0 ? (
              <div className="empty-state" style={{ minHeight: '200px' }}>No cash advances requested.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {advances.map(adv => (
                  <div key={adv.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: adv.status === 'SETTLED' ? '4px solid #10b981' : adv.status === 'APPROVED' ? '4px solid #00A7B5' : '4px solid #eab308', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'white' }}>{adv.purpose}</h3>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Timeline: Requested {new Date(adv.claimDate).toLocaleDateString()}</span>
                      </div>
                      <span className="badge" style={{
                        background: adv.status === 'SETTLED' ? '#10b981' : adv.status === 'APPROVED' ? '#00A7B5' : '#eab308',
                        color: 'white', fontSize: '0.65rem'
                      }}>
                        {adv.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div>Requested: <strong>INR {adv.amountRequested.toLocaleString()}</strong></div>
                      {adv.amountApproved && <div>Approved: <strong style={{ color: '#00A7B5' }}>INR {adv.amountApproved.toLocaleString()}</strong></div>}
                    </div>

                    {adv.advanceRemarks && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', padding: '0.35rem', borderRadius: '4px', fontStyle: 'italic', marginTop: '0.25rem' }}>
                        "{adv.advanceRemarks}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Receipt View Modal */}
        {selectedReceiptUrl && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setSelectedReceiptUrl(null)}>
            <div className="glass-card" style={{ maxWidth: '600px', width: '90%', padding: '1rem', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'white' }}>Receipt Attachment Preview</span>
                <button onClick={() => setSelectedReceiptUrl(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                {selectedReceiptUrl.endsWith('.pdf') ? (
                  <embed src={`http://localhost:5000${selectedReceiptUrl}`} type="application/pdf" width="100%" height="450px" />
                ) : (
                  <img src={`http://localhost:5000${selectedReceiptUrl}`} alt="Receipt attachment" style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain' }} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* File Out of Pocket Modal */}
        {showClaimModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>File Out-of-Pocket Expense</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Claim a reimburse for personal business expenses</p>
              </div>

              <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Claim Title</label>
                  <input type="text" placeholder="e.g. Bangalore Client dinner" required value={claimForm.title} onChange={e => setClaimForm({ ...claimForm, title: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Category</label>
                    <select value={claimForm.category} onChange={e => setClaimForm({ ...claimForm, category: e.target.value })} className="select-field">
                      <option value="TRAVEL">Travel</option>
                      <option value="MEALS">Meals & Diners</option>
                      <option value="ACCOMMODATION">Accommodation</option>
                      <option value="EQUIPMENT">Equipment & Assets</option>
                      <option value="OTHER">Other category</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Amount</label>
                    <input type="number" placeholder="5000" required value={claimForm.amount} onChange={e => setClaimForm({ ...claimForm, amount: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Description & Scope</label>
                  <textarea placeholder="Outline items purchased and purpose of business claim..." value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} className="input-field" style={{ minHeight: '60px', fontFamily: 'inherit' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Receipt Attachment File (PDF or Image)</label>
                  <input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files ? e.target.files[0] : null)} className="input-field" style={{ padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.03)' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowClaimModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    File Reimburse
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cash Advance Modal */}
        {showAdvanceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Request Travel Cash Advance</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receive an advance cash for scheduled business travels</p>
              </div>

              <form onSubmit={handleAdvanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Purpose & Travel Detail</label>
                  <input type="text" placeholder="e.g. Flight + hotel for Bangalore client meet" required value={advanceForm.purpose} onChange={e => setAdvanceForm({ ...advanceForm, purpose: e.target.value })} className="input-field" />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Cash Amount Requested (INR)</label>
                  <input type="number" placeholder="e.g. 15000" required value={advanceForm.amountRequested} onChange={e => setAdvanceForm({ ...advanceForm, amountRequested: e.target.value })} className="input-field" />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}>
                    Submit Cash Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
