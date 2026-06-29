'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

function useDismiss(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
}

export function Modal({ open, onClose, title, children, footer, width = 480 }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="modal-content"
        style={{ maxWidth: width, width: '90%', maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column' }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1.4rem 1.6rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <h3 className="modal-title" style={{ margin: 0 }}>{title}</h3>
            {onClose && (
              <button onClick={onClose} aria-label="Close" style={closeBtn}>
                <CloseIcon />
              </button>
            )}
          </div>
        )}
        <div style={{ padding: '1.5rem 1.6rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem 1.6rem', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 460, side = 'right' }: ModalProps & { side?: 'right' | 'left' }) {
  useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 1000, display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          width,
          maxWidth: '92vw',
          height: '100%',
          background: 'var(--surface-overlay)',
          borderLeft: side === 'right' ? '1px solid var(--border-subtle)' : 'none',
          borderRight: side === 'left' ? '1px solid var(--border-subtle)' : 'none',
          boxShadow: 'var(--shadow-3)',
          display: 'flex',
          flexDirection: 'column',
          animation: `${side === 'right' ? 'slideInRight' : 'slideInLeft'} var(--motion-slow) var(--ease-spring)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
          {onClose && <button onClick={onClose} aria-label="Close" style={closeBtn}><CloseIcon /></button>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>{children}</div>
        {footer && <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>{footer}</div>}
      </aside>
      <style jsx global>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  /** When set, shows a required reason textarea and passes it to onConfirm. */
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'primary', requireReason = false, reasonLabel = 'Reason', onConfirm, onCancel, loading,
}: ConfirmProps) {
  const [reason, setReason] = React.useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  const disabled = requireReason && !reason.trim();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={disabled} onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</p>}
      {requireReason && (
        <div style={{ marginTop: '1rem' }}>
          <label className="form-label">{reasonLabel}</label>
          <textarea className="textarea-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a brief note…" autoFocus />
        </div>
      )}
    </Modal>
  );
}

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6,
};

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default Modal;
