/**
 * Core components — owned by UI team (lead seeded). APIs are FROZEN (other teams use them);
 * the UI team may restyle/improve internals and add new components in new files.
 */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { StatusTag } from '@/types';
import { statusLabel, statusTone } from '@/engine';
import { useT } from '@/i18n/useT';
import { goBack } from '@/router';
import { Icon, type IconName } from './Icon';
import './ui.css';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', size = 'md', block, icon, children, className = '', ...rest }:
  { variant?: BtnVariant; size?: 'sm' | 'md'; block?: boolean; icon?: IconName; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`ui-btn ui-btn--${variant} ${size === 'sm' ? 'ui-btn--sm' : ''} ${block ? 'ui-btn--block' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </button>
  );
}

/** Icon-only button: `label` is required (aria-label + tooltip). */
export function IconButton({ icon, label, className = '', ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`ui-iconbtn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/** Screen header. `back` shows a back button (goBack by default). */
export function TopBar({ title, back, onBack, actions, titleTestId }: { title?: ReactNode; back?: boolean; onBack?: () => void; actions?: ReactNode; titleTestId?: string }) {
  const { t } = useT();
  return (
    <header className="ui-topbar">
      {back && <IconButton icon="back" label={t('common.back')} onClick={onBack ?? goBack} />}
      <h1 className="ui-topbar__title" data-testid={titleTestId}>{title}</h1>
      {actions && <div className="ui-topbar__actions">{actions}</div>}
    </header>
  );
}

/** Colored status pill driven by engine.statusTone. */
export function StatusChip({ status, label }: { status: StatusTag; label?: string }) {
  const { locale } = useT();
  const tone = statusTone(status);
  return (
    <span className="ui-chip" data-testid="status-chip" data-status={status}
      style={{ background: `var(--c-tone-${tone}-soft)`, color: `var(--c-tone-${tone}-ink)` }}>
      <span className="ui-chip__dot" style={{ background: `var(--c-tone-${tone})` }} />
      {label ?? statusLabel(status, locale)}
    </span>
  );
}

/** 0..1 progress. `color` defaults to primary. Pass `label` for screen readers. */
export function ProgressBar({ value, color = 'var(--c-primary)', label }: { value: number; color?: string; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="ui-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="ui-progress__bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Bottom sheet modal with focus trap, Escape/backdrop to close, focus restore. */
export function Sheet({ open, onClose, title, children, testId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () => [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
    (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ui-sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="ui-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-testid={testId}>
        <div className="ui-sheet__grabber" />
        <h2 id={titleId} className="ui-sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
