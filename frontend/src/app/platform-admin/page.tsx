'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/authContext';
import {
  getPlatformCompanies,
  updatePlatformCompanyStatus,
  getPlatformSubscriptions,
  updatePlatformSubscription,
  getPlatformMetrics,
  getContactRequests,
  createCustomPlan,
  verifyCompanyKYC
} from '@/lib/api';

interface Company {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  cin?: string | null;
  gstin?: string | null;
  directorName?: string | null;
  directorPan?: string | null;
  directorDin?: string | null;
  signingAuthorityName?: string | null;
  signingAuthorityEmail?: string | null;
  signingAuthorityPhone?: string | null;
  contactPersonName?: string | null;
  contactPersonEmail?: string | null;
  contactPersonPhone?: string | null;
  kycStatus?: string | null;
  kycRemarks?: string | null;
  demoCallScheduledAt?: string | null;
  subscriptions: {
    plan: {
      name: string;
    };
    endDate: string;
  }[];
}

interface Subscription {
  id: string;
  companyId: string;
  status: string;
  startDate: string;
  endDate: string;
  company: {
    name: string;
  };
  plan: {
    id: string;
    name: string;
  };
}

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  message: string;
  createdAt: string;
}

export default function PlatformAdminPanel() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [behaviorMetrics, setBehaviorMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'kyc' | 'subscriptions' | 'leads' | 'custom-plan'>('overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [kycRemarks, setKycRemarks] = useState<Record<string, string>>({});
  const [customPlanForm, setCustomPlanForm] = useState({
    name: '',
    description: '',
    price: '9999',
    employeeLimit: '100',
    durationDays: '30',
    features: {
      coreHR: true,
      attendance: true,
      leave: true,
      payroll: true,
      performance: true,
      learning: true,
      helpdesk: true,
      aiAgents: true,
      customWorkflows: true,
      apiAccess: true
    }
  });

  useEffect(() => {
    async function loadPlatformAdminDetails() {
      try {
        const [cRes, sRes, leadRes, metricRes] = await Promise.all([
          getPlatformCompanies(),
          getPlatformSubscriptions(),
          getContactRequests(),
          getPlatformMetrics()
        ]);
        setCompanies(cRes);
        setSubscriptions(sRes);
        setContacts(leadRes);
        setMetrics(metricRes.metrics);
        setBehaviorMetrics(metricRes.tenantBehavior || []);
      } catch (err) {
        console.error('Failed to load platform admin details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPlatformAdminDetails();
  }, []);

  const handleCreateCustomPlan = async () => {
    if (!selectedCompanyId) {
      alert('Please select a target company');
      return;
    }
    if (!customPlanForm.name.trim()) {
      alert('Plan name is required');
      return;
    }
    try {
      const payload = {
        name: customPlanForm.name,
        description: customPlanForm.description,
        price: parseFloat(customPlanForm.price),
        employeeLimit: parseInt(customPlanForm.employeeLimit),
        durationDays: parseInt(customPlanForm.durationDays),
        featureLimits: customPlanForm.features
      };

      await createCustomPlan(selectedCompanyId, payload);
      alert('Custom subscription assigned successfully!');
      
      const [cRes, sRes, metricRes] = await Promise.all([
        getPlatformCompanies(),
        getPlatformSubscriptions(),
        getPlatformMetrics()
      ]);
      setCompanies(cRes);
      setSubscriptions(sRes);
      setMetrics(metricRes.metrics);
      setBehaviorMetrics(metricRes.tenantBehavior || []);
      
      setSelectedCompanyId('');
      setCustomPlanForm({
        name: '',
        description: '',
        price: '9999',
        employeeLimit: '100',
        durationDays: '30',
        features: {
          coreHR: true,
          attendance: true,
          leave: true,
          payroll: true,
          performance: true,
          learning: true,
          helpdesk: true,
          aiAgents: true,
          customWorkflows: true,
          apiAccess: true
        }
      });
      setActiveTab('tenants');
    } catch (err) {
      console.error(err);
      alert('Failed to assign custom plan');
    }
  };

  const handleStatusChange = async (companyId: string, newStatus: string) => {
    try {
      await updatePlatformCompanyStatus(companyId, newStatus);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (err) {
      alert('Failed to update tenant status');
    }
  };

  const handleVerifyKYC = async (companyId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const remarks = kycRemarks[companyId] || '';
      await verifyCompanyKYC(companyId, { status, remarks });
      alert(`Company KYC status updated to ${status} successfully.`);
      
      const [cRes, sRes, metricRes] = await Promise.all([
        getPlatformCompanies(),
        getPlatformSubscriptions(),
        getPlatformMetrics()
      ]);
      setCompanies(cRes);
      setSubscriptions(sRes);
      setMetrics(metricRes.metrics);
      setBehaviorMetrics(metricRes.tenantBehavior || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update KYC status');
    }
  };

  const handleExtendSubscription = async (subId: string, days: number) => {
    try {
      const sub = subscriptions.find(s => s.id === subId);
      if (!sub) return;

      const currentEnd = new Date(sub.endDate);
      const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

      await updatePlatformSubscription(subId, { endDate: newEnd.toISOString() });
      setSubscriptions(prev => prev.map(s => s.id === subId ? { ...s, endDate: newEnd.toISOString() } : s));
      alert('Subscription extended successfully');
    } catch (err) {
      alert('Failed to extend subscription');
    }
  };

  if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'SALES') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e17', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontWeight: 600 }}>
        Access Denied. Global Platform Administrators or Sales Representatives Only.
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e17' }}>
        <Sidebar activePath="/platform-admin" />

        <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', color: '#f3f4f6' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>Platform Control Center</h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>Global administrative overview of SaaS operations, billing renewals, and client onboarding.</p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            {['overview', 'tenants', 'kyc', 'subscriptions', 'leads', 'custom-plan'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  background: activeTab === tab ? 'rgba(59,130,246,0.1)' : 'none',
                  border: 'none',
                  color: activeTab === tab ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'custom-plan' ? 'Custom Plan Builder' : tab === 'kyc' ? `KYC Approvals (${metrics?.pendingKycCount || 0})` : tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div>
              {/* Tab 1: Overview */}
              {activeTab === 'overview' && metrics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem' }}>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Total Companies</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{metrics.totalTenants}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Active Subscriptions</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{metrics.activeSubscriptions}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Pending KYC</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{metrics.pendingKycCount || 0}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Leads</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>{metrics.pendingContactRequests}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Total Revenue</span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>₹{metrics.totalRevenue.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {/* Tenant Behavior metrics section */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.75rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '1.25rem' }}>Tenant Behavior & Module Utilization Metrics</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '12px' }}>Tenant Company</th>
                          <th style={{ padding: '12px' }}>Employees</th>
                          <th style={{ padding: '12px' }}>Active Users</th>
                          <th style={{ padding: '12px' }}>Attendance logs</th>
                          <th style={{ padding: '12px' }}>Leave logs</th>
                          <th style={{ padding: '12px' }}>Payroll records</th>
                          <th style={{ padding: '12px' }}>Helpdesk tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {behaviorMetrics.map((row) => (
                          <tr key={row.companyId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.875rem' }}>
                            <td style={{ padding: '14px 12px', fontWeight: 600, color: '#fff' }}>
                              {row.name} <code style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>({row.code})</code>
                            </td>
                            <td style={{ padding: '14px 12px', color: '#60a5fa', fontWeight: 700 }}>{row.employeeCount}</td>
                            <td style={{ padding: '14px 12px' }}>{row.activeUserCount}</td>
                            <td style={{ padding: '14px 12px' }}>{row.attendanceCount}</td>
                            <td style={{ padding: '14px 12px' }}>{row.leaveCount}</td>
                            <td style={{ padding: '14px 12px', color: '#10b981', fontWeight: 600 }}>{row.payrollCount}</td>
                            <td style={{ padding: '14px 12px' }}>{row.ticketsCount}</td>
                          </tr>
                        ))}
                        {behaviorMetrics.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No tenant utilization statistics loaded.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Tenants */}
              {activeTab === 'tenants' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '12px' }}>Company Name</th>
                        <th style={{ padding: '12px' }}>Tenant Code</th>
                        <th style={{ padding: '12px' }}>Created Date</th>
                        <th style={{ padding: '12px' }}>Current Plan</th>
                        <th style={{ padding: '12px' }}>Account Status</th>
                        <th style={{ padding: '12px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => {
                        const sub = c.subscriptions[0];
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                            <td style={{ padding: '16px 12px', fontWeight: 600, color: '#fff' }}>{c.name}</td>
                            <td style={{ padding: '16px 12px' }}><code>{c.code}</code></td>
                            <td style={{ padding: '16px 12px' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '16px 12px', color: '#60a5fa' }}>{sub?.plan?.name || 'No Active Plan'}</td>
                            <td style={{ padding: '16px 12px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: c.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: c.status === 'ACTIVE' ? '#34d399' : '#f87171'
                              }}>
                                {c.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px 12px' }}>
                              <select
                                value={c.status}
                                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                style={{ background: '#0a0e17', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}
                              >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="SUSPENDED">SUSPENDED</option>
                                <option value="INACTIVE">INACTIVE</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: KYC Approvals */}
              {activeTab === 'kyc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {companies.map((c) => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>{c.name}</h3>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'block' }}>Tenant Code: <code>{c.code}</code> | Registered: {new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: c.kycStatus === 'APPROVED' ? 'rgba(16,185,129,0.1)' : c.kycStatus === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: c.kycStatus === 'APPROVED' ? '#34d399' : c.kycStatus === 'REJECTED' ? '#f87171' : '#fbbf24'
                        }}>
                          {c.kycStatus || 'NOT SUBMITTED'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Identification</span>
                          <div style={{ fontSize: '0.9rem', color: '#fff' }}>CIN: <code style={{ color: '#60a5fa' }}>{c.cin || 'N/A'}</code></div>
                          <div style={{ fontSize: '0.9rem', color: '#fff', marginTop: '2px' }}>GST: <code>{c.gstin || 'N/A'}</code></div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Director Details</span>
                          <div style={{ fontSize: '0.9rem', color: '#fff' }}>Name: {c.directorName || 'N/A'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>PAN: {c.directorPan || 'N/A'} | DIN: {c.directorDin || 'N/A'}</div>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Contact & Signatory</span>
                          <div style={{ fontSize: '0.9rem', color: '#fff' }}>Signatory: {c.signingAuthorityName || 'N/A'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Contact: {c.contactPersonName || 'N/A'} ({c.contactPersonPhone || 'N/A'})</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>Scheduled Onboarding Demo Call</span>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b' }}>
                            {c.demoCallScheduledAt ? new Date(c.demoCallScheduledAt).toLocaleString() : 'Not Scheduled'}
                          </div>
                        </div>

                        {c.kycStatus !== 'APPROVED' && (
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <input
                              type="text"
                              placeholder="Review remarks/reasons..."
                              value={kycRemarks[c.id] || ''}
                              onChange={(e) => setKycRemarks(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', width: '220px', outline: 'none' }}
                            />
                            <button
                              onClick={() => handleVerifyKYC(c.id, 'APPROVED')}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerifyKYC(c.id, 'REJECTED')}
                              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {companies.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)' }}>No company compliance records registered on this server.</div>
                  )}
                </div>
              )}

              {/* Tab 4: Subscriptions */}
              {activeTab === 'subscriptions' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '12px' }}>Tenant</th>
                        <th style={{ padding: '12px' }}>Plan</th>
                        <th style={{ padding: '12px' }}>Billing status</th>
                        <th style={{ padding: '12px' }}>Expiry date</th>
                        <th style={{ padding: '12px' }}>Overrides</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '16px 12px', fontWeight: 600, color: '#fff' }}>{s.company.name}</td>
                          <td style={{ padding: '16px 12px', color: '#60a5fa' }}>{s.plan.name}</td>
                          <td style={{ padding: '16px 12px' }}>{s.status}</td>
                          <td style={{ padding: '16px 12px' }}>{new Date(s.endDate).toLocaleDateString()}</td>
                          <td style={{ padding: '16px 12px' }}>
                            <button
                              onClick={() => handleExtendSubscription(s.id, 30)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Extend 30 Days
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 5: Leads */}
              {activeTab === 'leads' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '12px' }}>Name</th>
                        <th style={{ padding: '12px' }}>Email / Phone</th>
                        <th style={{ padding: '12px' }}>Company</th>
                        <th style={{ padding: '12px' }}>Message</th>
                        <th style={{ padding: '12px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem', verticalAlign: 'top' }}>
                          <td style={{ padding: '16px 12px', fontWeight: 600, color: '#fff' }}>{c.name}</td>
                          <td style={{ padding: '16px 12px' }}>
                            <div>{c.email}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{c.phone || 'N/A'}</div>
                          </td>
                          <td style={{ padding: '16px 12px' }}>{c.companyName || 'N/A'}</td>
                          <td style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.7)', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.message}</td>
                          <td style={{ padding: '16px 12px' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 6: Custom Plan Builder */}
              {activeTab === 'custom-plan' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '2rem', maxWidth: '650px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Assign Custom Pricing & Feature Set</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Select Company */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Target Tenant Company</label>
                      <select 
                        value={selectedCompanyId} 
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                      >
                        <option value="">-- Select Company --</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Plan Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Plan Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Enterprise Custom Growth" 
                        value={customPlanForm.name} 
                        onChange={(e) => setCustomPlanForm({...customPlanForm, name: e.target.value})}
                        style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Description</label>
                      <textarea 
                        placeholder="Details of custom arrangement..." 
                        value={customPlanForm.description} 
                        onChange={(e) => setCustomPlanForm({...customPlanForm, description: e.target.value})}
                        style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none', minHeight: '60px', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      {/* Price */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Price (INR / month)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 5000" 
                          value={customPlanForm.price} 
                          onChange={(e) => setCustomPlanForm({...customPlanForm, price: e.target.value})}
                          style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                        />
                      </div>

                      {/* Employee Limit */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Employee Limit</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 100" 
                          value={customPlanForm.employeeLimit} 
                          onChange={(e) => setCustomPlanForm({...customPlanForm, employeeLimit: e.target.value})}
                          style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                        />
                      </div>

                      {/* Duration (Days) */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Duration (Days)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 30" 
                          value={customPlanForm.durationDays} 
                          onChange={(e) => setCustomPlanForm({...customPlanForm, durationDays: e.target.value})}
                          style={{ width: '100%', background: '#0a0e17', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Features Select Checkboxes */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>Granted Feature Modules</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#070a10', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {Object.keys(customPlanForm.features).map((featureKey) => (
                          <label key={featureKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input 
                              type="checkbox" 
                              checked={(customPlanForm.features as any)[featureKey]} 
                              onChange={(e) => {
                                const newFeatures = { ...customPlanForm.features, [featureKey]: e.target.checked };
                                setCustomPlanForm({ ...customPlanForm, features: newFeatures });
                              }}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            <span style={{ textTransform: 'capitalize' }}>
                              {featureKey.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                      onClick={handleCreateCustomPlan}
                      style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
                        border: 'none', 
                        borderRadius: '6px', 
                        color: '#fff', 
                        fontWeight: 600, 
                        cursor: 'pointer', 
                        transition: 'opacity 0.3s' 
                        }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Create & Assign Custom Subscription
                    </button>

                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
