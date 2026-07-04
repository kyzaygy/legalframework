'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'tg_modal_dismissed_at';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const TG_URL = 'https://t.me/LegalFrameworkOfficial';

const text = {
  title: 'Подпишитесь на наш Telegram',
  subtitle: 'Новости и обновления законов',
  later: 'Позже',
  go: 'Перейти',
  close: 'Закрыть',
};

export function TelegramModal() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!Number.isNaN(ts) && Date.now() - ts < COOLDOWN_MS) return;
      }
    } catch {
      // localStorage unavailable
    }
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstFocusRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const box = boxRef.current;
      if (!box) return;
      const focusable = Array.from(
        box.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  const handleGo = useCallback(() => {
    window.open(TG_URL, '_blank', 'noopener,noreferrer');
    dismiss();
  }, [dismiss]);

  if (!open) return null;

  return (
    <div className="tgm-backdrop" onClick={dismiss}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tgm-title"
        className="tgm-box"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={firstFocusRef}
          className="tgm-close"
          onClick={dismiss}
          aria-label={text.close}
        >
          <CloseIcon />
        </button>
        <h2 id="tgm-title" className="tgm-title">{text.title}</h2>
        <p className="tgm-sub">{text.subtitle}</p>
        <div className="tgm-actions">
          <button className="tgm-btn tgm-btn-secondary" onClick={dismiss}>
            {text.later}
          </button>
          <button className="tgm-btn tgm-btn-primary" onClick={handleGo}>
            {text.go}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M14 4L4 14M4 4l10 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
