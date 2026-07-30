'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { apiEvents } from './api';
import { normalizeManualMessage } from './userMessages';
import BrandLogo from '@/components/BrandLogo';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const LOADING_PHRASES = [
  'Preparing your workspace... Thank you for your patience.',
  'Retrieving secure records... Thank you for your patience.',
  'Processing statutory compliance... Thank you for your patience.',
  'Synchronizing employee portal... Thank you for your patience.',
  'Compiling live metrics... Thank you for your patience.',
  'Updating database ledger... Thank you for your patience.',
  'Applying security configurations... Thank you for your patience.'
];

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeRequests, setActiveRequests] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_PHRASES[0]);
  // The full-screen spinner only appears once a request has been pending for a
  // beat (SPINNER_DELAY_MS). Fast/cached calls just flash the top progress bar,
  // so the app feels instant; genuinely slow work shows the engaging loader.
  const [showSpinner, setShowSpinner] = useState(false);
  const busyRef = useRef(false);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SPINNER_DELAY_MS = 400;

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      const alreadyVisible = prev.some((toast) => toast.message === message && toast.type === type);
      if (alreadyVisible) return prev;
      return [...prev, { id, message, type }];
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const handleStart = () => {
      setActiveRequests((prev) => {
        if (prev === 0) {
          const randomIndex = Math.floor(Math.random() * LOADING_PHRASES.length);
          setLoadingMessage(LOADING_PHRASES[randomIndex]);
        }
        return prev + 1;
      });
    };

    const handleEnd = () => {
      setActiveRequests((prev) => Math.max(0, prev - 1));
    };

    const handleSuccess = (msg: string) => {
      showToast(msg, 'success');
    };

    const handleError = (msg: string) => {
      showToast(msg, 'error');
    };

    const unsubscribeStart = apiEvents.on('request-start', handleStart);
    const unsubscribeEnd = apiEvents.on('request-end', handleEnd);
    const unsubscribeSuccess = apiEvents.on('toast-success', handleSuccess);
    const unsubscribeError = apiEvents.on('toast-error', handleError);

    return () => {
      unsubscribeStart();
      unsubscribeEnd();
      unsubscribeSuccess();
      unsubscribeError();
    };
  }, []);

  // Gate the blocking spinner behind a short delay so only slow work shows it.
  useEffect(() => {
    const busy = activeRequests > 0;
    if (busy && !busyRef.current) {
      busyRef.current = true;
      spinnerTimer.current = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    } else if (!busy && busyRef.current) {
      busyRef.current = false;
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
      setShowSpinner(false);
    }
  }, [activeRequests]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nativeAlert = window.alert;

    window.alert = (message?: any) => {
      const normalized = normalizeManualMessage(message);
      showToast(normalized.message, normalized.type);
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(window.navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      showToast('Back online! Reconnecting to HRMS server...', 'success');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Some features may not be available.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {!isOnline && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100001,
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.25)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
            animation: 'fadeInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            pointerEvents: 'none'
          }}
        >
          <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block' }} />
          Connection lost. Working offline...
        </div>
      )}

      {/* Floating Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '380px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'rgba(17, 24, 39, 0.85)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              boxShadow: toast.type === 'success' 
                ? '0 8px 32px rgba(16, 185, 129, 0.15), inset 0 0 12px rgba(16, 185, 129, 0.05)'
                : '0 8px 32px rgba(239, 68, 68, 0.15), inset 0 0 12px rgba(239, 68, 68, 0.05)',
              backdropFilter: 'blur(16px)',
              color: 'rgba(255, 255, 255, 0.95)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              fontWeight: 500,
              animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Success / Error Glow indicator bar */}
            <div 
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                background: toast.type === 'success' ? '#10b981' : '#ef4444'
              }}
            />

            {/* Icon */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {toast.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>

            {/* Message */}
            <div style={{ flexGrow: 1, paddingRight: '8px', lineHeight: 1.4 }}>
              {toast.message}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyItems: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'none'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Slim top progress bar — instant, non-blocking feedback on every request. */}
      {activeRequests > 0 && (
        <div
          aria-hidden
          data-pid-loader="bar"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
            zIndex: 100000, overflow: 'hidden', pointerEvents: 'none',
            background: 'rgba(0, 167, 181, 0.12)',
          }}
        >
          <div
            style={{
              height: '100%', width: '40%', borderRadius: '0 3px 3px 0',
              background: 'linear-gradient(90deg, transparent, #00A7B5 40%, #73E0E7 70%, #182B6D)',
              boxShadow: '0 0 12px rgba(0, 167, 181, 0.6)',
              animation: 'pidTopBar 1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>
      )}

      {/* Styled Loading Backdrop Overlay — only for genuinely slow work. */}
      {showSpinner && (
        <div
          data-pid-loader="spinner"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 14, 26, 0.75)',
            backdropFilter: 'blur(12px)',
            zIndex: 99998,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s ease forwards'
          }}
        >
          {/* Glassmorphic Loader Container */}
          <div
            style={{
              padding: '40px 60px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: '480px',
              width: '90%',
              textAlign: 'center'
            }}
          >
            {/* Spinning Loader */}
            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  border: '4px solid rgba(255, 255, 255, 0.05)',
                  borderTop: '4px solid #00A7B5',
                  borderRight: '4px solid #182B6D',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.8s linear infinite'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '10px',
                  border: '2px dashed rgba(0, 167, 181, 0.2)',
                  borderRadius: '50%',
                  animation: 'spin-slow 2s linear infinite reverse'
                }}
              />
            </div>

            {/* Glowing Accent Title */}
              <div style={{ marginBottom: '12px' }}>
                <BrandLogo variant="dark" height={38} />
              </div>

            {/* Loading Message */}
            <div
              style={{
                fontSize: '0.95rem',
                color: 'rgba(255, 255, 255, 0.85)',
                fontWeight: 500,
                lineHeight: 1.5
              }}
            >
              {loadingMessage}
            </div>
          </div>
        </div>
      )}

      {/* Inject animation keyframe styles */}
      <style jsx global>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%) translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }
        @keyframes pidTopBar {
          0%   { transform: translateX(-100%) scaleX(0.6); }
          50%  { transform: translateX(60%) scaleX(1); }
          100% { transform: translateX(260%) scaleX(0.6); }
        }
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        @keyframes pulse-dot {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.6;
          }
        }
        .pulse-dot {
          animation: pulse-dot 1.5s infinite ease-in-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
