'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBillingPlans, billingCheckout, billingConfirmPayment } from '@/lib/api';

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
      <div style={{ color: '#fff', textAlign: 'center' }}>
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

  return (
    <div style={{ width: '100%', maxWidth: '850px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
      {/* Left Side: Mock Card Form */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Mock Checkout</h2>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2rem' }}>Sandbox payment processor simulator. No real money is transferred.</p>

        {success && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            <strong>Payment Success!</strong> Redirecting to your HRMS dashboard...
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Card Number</label>
            <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>Expiry Date</label>
              <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>CVV</label>
              <input type="password" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none' }} />
            </div>
          </div>

          <button type="submit" disabled={loading || success} style={{ width: '100%', padding: '0.9rem', marginTop: '1rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '10px', cursor: (loading || success) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
            {loading ? 'Processing transaction...' : `Pay ₹${selectedPlan.price.toLocaleString()}`}
          </button>
        </form>
      </div>

      {/* Right Side: Plan Breakdown */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '1.5rem' }}>Order Summary</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>PID hcms {selectedPlan.name} Plan</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Monthly billing</div>
          </div>
          <div style={{ fontWeight: 600, color: '#fff' }}>₹{selectedPlan.price.toLocaleString()}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          <span>Subtotal</span>
          <span>₹{selectedPlan.price.toLocaleString()}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          <span>GST (18% inclusive)</span>
          <span>₹0.00</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginTop: 'auto' }}>
          <span>Total Due</span>
          <span>₹{selectedPlan.price.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <Suspense fallback={<div style={{ color: '#fff' }}>Loading secure payment processor...</div>}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
