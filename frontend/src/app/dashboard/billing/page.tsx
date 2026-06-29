'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getBillingSubscription, getBillingTransactions } from '@/lib/api';
import {
  PageHeader, Card, Button, Badge, StatusChip, Banner, ProgressBar,
  DataTable, EmptyState, ErrorState, SkeletonTable,
} from '@/components/ui';
import type { Column } from '@/components/ui';

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
  const [error, setError] = useState(false);

  const loadBillingDetails = async () => {
    setLoading(true);
    setError(false);
    try {
      const [subResult, txnResult] = await Promise.all([
        getBillingSubscription(),
        getBillingTransactions()
      ]);
      setSubData(subResult);
      setTxns(txnResult);
    } catch (err) {
      console.error('Failed to load billing details:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingDetails();
  }, []);

  const txnColumns: Column<Transaction>[] = [
    {
      key: 'plan',
      header: 'Plan',
      render: (t) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {t.subscription?.plan?.name || 'SaaS Renewal'}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (t) => (
        <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.providerPaymentId}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{t.amount.toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (t) => <StatusChip status={t.status} />,
    },
  ];

  const usagePct = subData
    ? Math.min((subData.usage.employeeCount / subData.usage.employeeLimit) * 100, 100)
    : 0;
  const usageTone = subData?.usage.isExceeded ? 'danger' : subData?.usage.isNearLimit ? 'warning' : 'success';

  return (
    <ProtectedRoute>
      <div className="app-layout">
        <Sidebar activePath="/dashboard/billing" />

        <main className="main-content">
          <PageHeader
            title="SaaS Subscription & Billing"
            subtitle="Monitor active plans, employee thresholds, and transaction history."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            }
            actions={<Button href="/pricing" variant="primary">Upgrade Plan</Button>}
          />

          {loading ? (
            <Card><SkeletonTable rows={5} cols={3} /></Card>
          ) : error ? (
            <ErrorState
              title="Failed to load billing details"
              message="We could not retrieve your subscription and payment data."
              onRetry={loadBillingDetails}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>

              {/* Left Column: Active Subscription & Limits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* Plan Card */}
                <Card>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: subData?.subscription ? 'var(--success-fg)' : 'var(--text-muted)', display: 'inline-block' }} />
                    Active Plan Status
                  </h2>

                  {subData?.subscription ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan Name</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                            {subData.subscription.plan.name}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Renewal Rate</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                            ₹{subData.subscription.plan.price.toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ mo</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</span>
                          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {new Date(subData.subscription.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Renewal/Expiry Date</span>
                          <div style={{ fontSize: '0.95rem', color: 'var(--danger-fg)', fontWeight: 600, marginTop: '2px' }}>
                            {new Date(subData.subscription.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="No active subscription"
                      message="Upgrade your plan to activate down-stream processes."
                      action={<Button href="/pricing" variant="primary" size="sm">Upgrade Plan</Button>}
                    />
                  )}
                </Card>

                {/* Usage Limits Card */}
                <Card title="Workspace Usage Quotas">
                  {subData ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Active Employees Scoped</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {subData.usage.employeeCount} / {subData.usage.employeeLimit}
                        </span>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <ProgressBar value={usagePct} tone={usageTone} />
                      </div>

                      {subData.usage.isExceeded && (
                        <Banner tone="danger" title="Quota Exceeded">
                          You have reached your plan limit. New employee onboardings are locked until you upgrade.
                        </Banner>
                      )}
                      {!subData.usage.isExceeded && subData.usage.isNearLimit && (
                        <Banner tone="warning" title="Approaching Threshold">
                          You are close to your employee limit. Consider upgrading soon to prevent disruption.
                        </Banner>
                      )}
                    </div>
                  ) : null}
                </Card>

              </div>

              {/* Right Column: Transactions History */}
              <Card title="Payment History">
                <DataTable<Transaction>
                  columns={txnColumns}
                  rows={txns}
                  rowKey={(t) => t.id}
                  empty={<EmptyState title="No payment records" message="Transactions will appear here once billed." />}
                />
              </Card>

            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
