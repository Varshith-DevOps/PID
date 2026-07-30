'use client';

import React, { useState, useEffect } from 'react';

interface AssetRequest {
  id: string;
  assetType: string;
  reason: string;
  status: string;
  reviewerComments: string | null;
  createdAt: string;
  asset?: { name: string; assetTag: string; category: string } | null;
  employee?: { firstName: string; lastName: string; jobTitle: string };
}

interface AvailableAsset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  status: string;
}

export default function AssetRequestDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Request form
  const [assetType, setAssetType] = useState('LAPTOP');
  const [reason, setReason] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Approval modal state
  const [selectedReqId, setSelectedReqId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [reviewerComments, setReviewerComments] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const res = await fetch('/api/assets/requests/admin');
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests);
          setAvailableAssets(data.availableAssets);
        }
      } else {
        const res = await fetch('/api/assets/requests/employee');
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      }
    } catch (err) {
      console.error('Failed to load asset requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    try {
      const res = await fetch('/api/assets/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType, reason })
      });
      if (res.ok) {
        setSubmitSuccess(true);
        setAssetType('LAPTOP');
        setReason('');
        loadData();
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to submit request:', err);
    }
  };

  const handleApprove = async (reqId: string) => {
    try {
      const res = await fetch(`/api/assets/requests/${reqId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAssetId || undefined,
          reviewerComments: reviewerComments || 'Approved'
        })
      });
      if (res.ok) {
        setSelectedReqId('');
        setSelectedAssetId('');
        setReviewerComments('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      const res = await fetch(`/api/assets/requests/${reqId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerComments: reviewerComments || 'Rejected' })
      });
      if (res.ok) {
        setSelectedReqId('');
        setReviewerComments('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#34c759';
      case 'REJECTED': return '#ff453a';
      default: return '#ffcc00';
    }
  };

  return (
    <div style={styles.container}>
      {!isAdmin && (
        <div style={styles.formSection}>
          <h3 style={styles.sectionTitle}>Request Hardware Asset</h3>
          {submitSuccess && (
            <div style={styles.successBanner}>Request submitted successfully!</div>
          )}
          <form onSubmit={handleSubmitRequest} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Asset Type</label>
              <select value={assetType} onChange={(e) => setAssetType(e.target.value)} style={styles.select}>
                <option value="LAPTOP">Laptop</option>
                <option value="MONITOR">Monitor</option>
                <option value="KEYBOARD">Keyboard</option>
                <option value="MOUSE">Mouse</option>
                <option value="HEADSET">Headset</option>
                <option value="PHONE">Mobile Phone</option>
                <option value="PRINTER">Printer</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Business Justification</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you need this asset..."
                style={styles.textarea}
                rows={3}
                required
              />
            </div>
            <button type="submit" style={styles.submitBtn}>Submit Request</button>
          </form>
        </div>
      )}

      <div style={styles.listSection}>
        <h3 style={styles.sectionTitle}>
          {isAdmin ? 'All Asset Requests' : 'My Requests'}
        </h3>

        {loading ? (
          <p style={{ color: '#8e8e93' }}>Loading requests...</p>
        ) : requests.length === 0 ? (
          <div style={styles.empty}>No asset requests found.</div>
        ) : (
          <div style={styles.requestList}>
            {requests.map((req) => (
              <div key={req.id} style={styles.requestCard}>
                <div style={styles.requestHeader}>
                  <div>
                    <span style={styles.assetTypeBadge}>{req.assetType}</span>
                    {isAdmin && req.employee && (
                      <span style={styles.employeeName}>
                        {req.employee.firstName} {req.employee.lastName} · {req.employee.jobTitle}
                      </span>
                    )}
                  </div>
                  <span style={{ ...styles.statusBadge, color: getStatusColor(req.status), borderColor: getStatusColor(req.status) }}>
                    {req.status}
                  </span>
                </div>

                <p style={styles.reasonText}>{req.reason}</p>

                {req.reviewerComments && (
                  <div style={styles.reviewBlock}>
                    <span style={styles.reviewLabel}>Reviewer:</span> {req.reviewerComments}
                  </div>
                )}

                {req.asset && (
                  <div style={styles.assetInfo}>
                    Assigned: {req.asset.name} ({req.asset.assetTag})
                  </div>
                )}

                <div style={styles.dateLine}>
                  {new Date(req.createdAt).toLocaleDateString()}
                </div>

                {isAdmin && req.status === 'PENDING' && (
                  <div style={styles.actionBlock}>
                    {selectedReqId === req.id ? (
                      <div style={styles.actionForm}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Assign Physical Asset (Optional)</label>
                          <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} style={styles.select}>
                            <option value="">Auto-allocate</option>
                            {availableAssets
                              .filter(a => a.category.toUpperCase() === req.assetType || true)
                              .map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                              ))}
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Comments</label>
                          <input
                            type="text"
                            value={reviewerComments}
                            onChange={(e) => setReviewerComments(e.target.value)}
                            placeholder="Comments..."
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.actionBtns}>
                          <button onClick={() => handleApprove(req.id)} style={styles.approveBtn}>Approve</button>
                          <button onClick={() => handleReject(req.id)} style={styles.rejectBtn}>Reject</button>
                          <button onClick={() => setSelectedReqId('')} style={styles.cancelBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setSelectedReqId(req.id)} style={styles.reviewBtn}>
                        Review Request
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '24px' },
  formSection: {
    backgroundColor: '#151518', border: '1px solid #222225', borderRadius: '12px',
    padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
  },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 16px 0' },
  successBanner: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)', border: '1px solid #34c759', borderRadius: '8px',
    padding: '10px 14px', color: '#34c759', fontSize: '13px', fontWeight: '500', marginBottom: '12px'
  },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '10px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: {
    width: '100%', padding: '10px', backgroundColor: '#0e0e11', border: '1px solid #2d2d30',
    borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
  },
  textarea: {
    width: '100%', padding: '10px', backgroundColor: '#0e0e11', border: '1px solid #2d2d30',
    borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box'
  },
  input: {
    width: '100%', padding: '10px', backgroundColor: '#0e0e11', border: '1px solid #2d2d30',
    borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
  },
  submitBtn: {
    padding: '10px', backgroundColor: '#0a84ff', color: '#fff', border: 'none',
    borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginTop: '4px'
  },
  listSection: {},
  empty: {
    backgroundColor: '#151518', border: '1px dashed #2d2d30', borderRadius: '12px',
    padding: '40px', textAlign: 'center', color: '#8e8e93', fontSize: '14px'
  },
  requestList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  requestCard: {
    backgroundColor: '#151518', border: '1px solid #222225', borderRadius: '10px',
    padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  requestHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  assetTypeBadge: {
    fontSize: '11px', fontWeight: '700', color: '#0a84ff', backgroundColor: 'rgba(10,132,255,0.1)',
    padding: '3px 8px', borderRadius: '12px'
  },
  employeeName: { fontSize: '12px', color: '#8e8e93', marginLeft: '8px' },
  statusBadge: {
    fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px',
    border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  reasonText: { fontSize: '13px', color: '#f5f5f7', lineHeight: '1.4', margin: '4px 0 8px 0' },
  reviewBlock: {
    fontSize: '11px', color: '#8e8e93', backgroundColor: '#0e0e11', padding: '8px',
    borderRadius: '6px', marginBottom: '6px'
  },
  reviewLabel: { fontWeight: '600', color: '#fff' },
  assetInfo: { fontSize: '11px', color: '#34c759', fontWeight: '500', marginBottom: '4px' },
  dateLine: { fontSize: '10px', color: '#8e8e93' },
  actionBlock: { marginTop: '12px', borderTop: '1px solid #222225', paddingTop: '12px' },
  actionForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  actionBtns: { display: 'flex', gap: '8px' },
  reviewBtn: {
    padding: '8px 14px', backgroundColor: '#222225', border: '1px solid #2d2d30',
    borderRadius: '6px', color: '#f5f5f7', fontSize: '12px', fontWeight: '500', cursor: 'pointer'
  },
  approveBtn: {
    padding: '6px 14px', backgroundColor: '#34c759', border: 'none',
    borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },
  rejectBtn: {
    padding: '6px 14px', backgroundColor: '#ff453a', border: 'none',
    borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },
  cancelBtn: {
    padding: '6px 14px', backgroundColor: '#8e8e93', border: 'none',
    borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  }
};
