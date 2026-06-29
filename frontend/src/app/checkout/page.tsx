'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBillingPlans, billingCheckout, billingConfirmPayment } from '@/lib/api';
import { Button, Banner, Card, TextField } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  price: number;
}

function CheckoutContent() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  const [cardCvv, setCardCvv] = useState('123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadPlan() {
      try {
        const planId = searchParams.get('planId');
        const data = await getBillingPlans();
        const found = data.find((p: any) => p.id === planId) || data[0];
        setSelectedPlan(found);
      } catch (err) {
        console.error(err);
        setSelectedPlan({ id: '2', name: 'Professional', price: 5999 });
      }
    }
    loadPlan();
  }, [searchParams]);

  if (!selectedPlan) {
    return (
      <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
        <span>Loading secure gateway details...</span>
      </div>
    );
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!selectedPlan) {
      setError('Plan configuration missing');
      setLoading(false);
      return;
    }

    try {
      const checkoutData = await billingCheckout(selectedPlan.id);
      const transactionId = checkoutData.transaction.id;

      const confirmation = await billingConfirmPayment({
        transactionId,
        planId: selectedPlan.id,
        status: 'SUCCESS'
      });

      if (confirmation.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError('Payment verification failed');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Checkout failed. Please ensure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  const summaryRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between' };

  return (
    <div style={{ width: '100%', maxWidth: '850px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
      {/* Left Side: Mock Card Form */}
      <Card padded style={{ padding: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mock Checkout</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>Sandbox payment processor simulator. No real money is transferred.</p>

        {success && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Banner tone="success" title="Payment Success!">Redirecting to your HRMS dashboard...</Banner>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Banner tone="danger">{error}</Banner>
          </div>
        )}

        <form onSubmit={handlePayment}>
          <TextField
            label="Card Number"
            value={cardNumber}
            onChange={setCardNumber}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextField
              label="Expiry Date"
              placeholder="MM/YY"
              value={cardExpiry}
              onChange={setCardExpiry}
            />
            <TextField
              label="CVV"
              type="password"
              value={cardCvv}
              onChange={setCardCvv}
            />
          </div>

          <Button type="submit" variant="success" loading={loading} disabled={loading || success} fullWidth style={{ marginTop: '1rem' }}>
            {loading ? 'Processing transaction...' : `Pay ₹${selectedPlan.price.toLocaleString()}`}
          </Button>
        </form>
      </Card>

      {/* Right Side: Plan Breakdown */}
      <Card padded style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', background: 'var(--surface-sunken)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Order Summary</h3>

        <div style={{ ...summaryRow, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>PID hcms {selectedPlan.name} Plan</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monthly billing</div>
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{selectedPlan.price.toLocaleString()}</div>
        </div>

        <div style={{ ...summaryRow, color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          <span>Subtotal</span>
          <span>₹{selectedPlan.price.toLocaleString()}</span>
        </div>

        <div style={{ ...summaryRow, color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          <span>GST (18% inclusive)</span>
          <span>₹0.00</span>
        </div>

        <div style={{ ...summaryRow, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: 'auto' }}>
          <span>Total Due</span>
          <span>₹{selectedPlan.price.toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <Suspense fallback={<div style={{ color: 'var(--text-secondary)' }}>Loading secure payment processor...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
