import React, { useEffect, useRef, useState } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Modal({ title, onClose, children, actions }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '60px 16px 16px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 22, fontWeight: 800,
          marginBottom: 20, color: '#1A1714'
        }}>
          {title}
        </div>
        {children}
        {actions && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface InputModalProps {
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
}

export function InputModal({ title, label, placeholder, defaultValue = '', onConfirm, onClose }: InputModalProps) {
  const [val, setVal] = useState(defaultValue);

  function submit() {
    const trimmed = val.trim();
    if (!trimmed) return;
    onConfirm(trimmed); // parent gère la fermeture
  }

  return (
    <Modal title={title} onClose={onClose} actions={
      <>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '16px', borderRadius: 12,
            border: 'none', background: '#F0EEEA',
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', color: '#1A1714',
            minHeight: 56,
          }}
        >
          Annuler
        </button>
        <button
          onClick={submit}
          style={{
            flex: 2, padding: '16px', borderRadius: 12,
            border: 'none',
            background: val.trim() ? '#D4500A' : '#E2DDD5',
            color: val.trim() ? 'white' : '#7A7470',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            minHeight: 56,
          }}
        >
          ✓ Confirmer
        </button>
      </>
    }>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#7A7470',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8
        }}>
          {label}
        </div>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          style={{
            width: '100%', padding: '14px 16px',
            fontSize: 17, borderRadius: 12,
            border: '2px solid #D4500A',
            background: 'white', outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
            boxSizing: 'border-box', color: '#1A1714',
          }}
        />
      </div>
    </Modal>
  );
}

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirmer', danger, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose} actions={
      <>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '16px', borderRadius: 12,
            border: 'none', background: '#F0EEEA',
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', color: '#1A1714',
            minHeight: 56,
          }}
        >
          Annuler
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          style={{
            flex: 2, padding: '16px', borderRadius: 12,
            border: 'none',
            background: danger ? '#C0392B' : '#D4500A',
            color: 'white',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            minHeight: 56,
          }}
        >
          {confirmLabel}
        </button>
      </>
    }>
      <p style={{ margin: 0, color: '#7A7470', fontSize: 15, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
