'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getBillingSubscription, getBillingTransactions } from '@/lib/api';

interface SubscriptionData {
  company: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  subscription: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    plan: {
      name: string;
      price: number;
      employeeLimit: number;
    };
  } | null;
  usage: {
    employeeCount: number;
    employeeLimit: number;
    isNearLimit: boolean;
    isExceeded: boolean;
  };
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  providerPaymentId: string;
  subscription?: {
    plan: {
      name: string;
    };
  };
}

export default function TenantBillingPage() {
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBillingDetails() {
      try {
        const [subResult, txnResult] = await Promise.all([
          getBillingSubscription(),
          getBillingTransactions()
        ]);
        setSubData(subResult);
        setTxns(txnResult);
      } catch (err) {
        console.error('Failed to load billing details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBillingDetails();
  }, []);

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e17' }}>
        <Sidebar activePath="/dashboard/billing" />
        
        <main style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', color: '#f3f4f6' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>SaaS Subscription & Billing</h1>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>Monitor active plans, employee thresholds, and transaction history.</p>
            </div>
            <Link href="/pricing" style={{ textDecoration: 'none', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', fontSize: '0.85rem', fontWeight: 700, padding: '0.65rem 1.25rem', borderRadius: '8px', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}>
              Upgrade Plan
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
              
              {/* Left Column: Active Subscription & Limits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Plan Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Active Plan Status
                  </h2>

                  {subData?.subscription ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Plan Name</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa', marginTop: '2px' }}>
                            {subData.subscription.plan.name}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Renewal Rate</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                            ₹{subData.subscription.plan.price.toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/ mo</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Start Date</span>
                          <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                            {new Date(subData.subscription.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Renewal/Expiry Date</span>
                          <div style={{ fontSize: '0.95rem', color: '#f43f5e', fontWeight: 600, marginTop: '2px' }}>
                            {new Date(subData.subscription.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem' }}>
                      No active subscription found. Upgrade your plan to activate down-stream processes.
                    </div>
                  )}
                </div>

                {/* Usage Limits Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Workspace Usage Quotas</h2>

                  {subData ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Active Employees Scoped</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>
                          {subData.usage.employeeCount} / {subData.usage.employeeLimit}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                        <div
                          style={{
                            width: `${Math.min((subData.usage.employeeCount / subData.usage.employeeLimit) * 100, 100)}%`,
                            height: '100%',
                            background: subData.usage.isExceeded ? '#ef4444' : subData.usage.isNearLimit ? '#f59e0b' : '#10b981',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>

                      {subData.usage.isExceeded && (
                        <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <strong>Quota Exceeded:</strong> You have reached your plan limit. New employee onboardings are locked until you upgrade.
                        </div>
                      )}
                      {!subData.usage.isExceeded && subData.usage.isNearLimit && (
                        <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <strong>Approaching Threshold:</strong> You are close to your employee limit. Consider upgrading soon to prevent disruption.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

              </div>

              {/* Right Column: Transactions History */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Payment History</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                  {txns.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                      No transaction records log.
                    </div>
                  ) : (
                    txns.map((t) => (
                      <div key={t.id} style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                            {t.subscription?.plan?.name || 'SaaS Renewal'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                            {new Date(t.createdAt).toLocaleDateString()} • {t.providerPaymentId}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>₹{t.amount.toLocaleString()}</div>
                          <span style={{ fontSize: '0.75rem', color: t.status === 'SUCCESS' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
