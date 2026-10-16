/**
 * Extra design-system components (UI team). Additive — the frozen core lives in ui.tsx.
 * Card · Row/RowGroup · Switch · Segmented · TextField · EmptyState · PalAvatar · Badge · Skeleton ·
 * SectionHeader · ConfirmSheet · SpeechBubble · Spinner
 */
import {
  useId, useRef, type ElementType, type Ref, type HTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode,
} from 'react';
import type { CharacterKind, Mood } from '@/types';
import { Character } from '@/characters';
import { Button, Sheet } from './ui';
import { Icon, type IconName } from './Icon';
import './kit.css';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ───────────── Card ───────────── */
export function Card({ as: As = 'div', className, children, pad = true, ...rest }:
  { as?: ElementType; className?: string; children: ReactNode; pad?: boolean } & HTMLAttributes<HTMLElement> & { href?: string }) {
  return <As className={cx('ui-card', pad && 'ui-card--pad', className)} {...rest}>{children}</As>;
}

/* ───────────── Rows (iOS-settings-like grouped list) ───────────── */
export function RowGroup({ title, footer, children, id }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; id?: string }) {
  const hid = useId();
  return (
    <section className="ui-rowgroup" aria-labelledby={title ? hid : undefined} id={id}>
      {title && <h2 id={hid} className="ui-rowgroup__title">{title}</h2>}
      <div className="ui-rowgroup__body">{children}</div>
      {footer && <p className="ui-rowgroup__footer">{footer}</p>}
    </section>
  );
}

export interface RowProps {
  icon?: IconName;
  /** CSS color for the icon tile (token var) */
  iconColor?: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Right side: value text, switch, chevron … */
  trailing?: ReactNode;
  /** Content shown under the label row at full width (segmented controls, pickers) */
  below?: ReactNode;
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
  danger?: boolean;
  testId?: string;
  labelId?: string;
}
export function Row({ icon, iconColor, label, hint, trailing, below, onClick, href, chevron, danger, testId, labelId }: RowProps) {
  const inner = (
    <>
      <span className="ui-row__main">
        {icon && (
          <span className="ui-row__icon" style={iconColor ? { background: `color-mix(in srgb, ${iconColor} 18%, var(--c-surface))`, color: iconColor } : undefined}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <span className="ui-row__text">
          <span className="ui-row__label" id={labelId}>{label}</span>
          {hint && <span className="ui-row__hint">{hint}</span>}
        </span>
        {trailing && <span className="ui-row__trailing">{trailing}</span>}
        {chevron && <Icon name="chevronRight" size={20} className="ui-row__chev" />}
      </span>
      {below && <span className="ui-row__below">{below}</span>}
    </>
  );
  const cls = cx('ui-row', (onClick || href) && 'ui-row--action', danger && 'ui-row--danger');
  if (href) return <a className={cls} href={href} data-testid={testId}>{inner}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick} data-testid={testId}>{inner}</button>;
  return <div className={cls} data-testid={testId}>{inner}</div>;
}

/* ───────────── Switch ───────────── */
export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled, testId }:
  { checked: boolean; onChange: (v: boolean) => void; label?: string; labelledBy?: string; describedBy?: string; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy}
      disabled={disabled} data-testid={testId} className={cx('ui-switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__knob" />
    </button>
  );
}

/* ───────────── Segmented (radiogroup) ───────────── */
export interface SegOption<V extends string> { value: V; label: ReactNode; icon?: IconName; testId?: string; ariaLabel?: string }
export function Segmented<V extends string>({ value, options, onChange, label, labelledBy, testId, size = 'md' }:
  { value: V; options: SegOption<V>[]; onChange: (v: V) => void; label?: string; labelledBy?: string; testId?: string; size?: 'sm' | 'md' }) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (idx + d + options.length) % options.length;
    onChange(options[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus();
  };
  return (
    <div ref={ref} className={cx('ui-seg', size === 'sm' && 'ui-seg--sm')} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}
      data-testid={testId} onKeyDown={onKey} style={{ ['--seg-n' as string]: options.length, ['--seg-i' as string]: idx }}>
      <span className="ui-seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} aria-label={o.ariaLabel}
          tabIndex={o.value === value ? 0 : -1} data-testid={o.testId} className="ui-seg__opt" onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={18} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────── TextField ───────────── */
export function TextField({ label, hint, error, errorTestId, trailing, big, className, id, inputRef, ...input }:
  { label: ReactNode; hint?: ReactNode; error?: ReactNode; errorTestId?: string; trailing?: ReactNode; big?: boolean; inputRef?: Ref<HTMLInputElement> }
  & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fid = id ?? autoId;
  const hintId = `${fid}-hint`, errId = `${fid}-err`;
  const describedBy = [hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ui-field', big && 'ui-field--big', !!error && 'has-error', className)}>
      <label className="ui-field__label" htmlFor={fid}>{label}</label>
      <div className="ui-field__box">
        <input ref={inputRef} id={fid} className="ui-field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        {trailing && <div className="ui-field__trailing">{trailing}</div>}
      </div>
      {hint && <p id={hintId} className="ui-field__hint">{hint}</p>}
      {error && <p id={errId} className="ui-field__error" role="alert" data-testid={errorTestId}><Icon name="alert" size={16} />{error}</p>}
    </div>
  );
}

/* ───────────── PalAvatar ───────────── */
export function PalAvatar({ kind, mood = 'idle', size = 48, animated = false, title, className }:
  { kind: CharacterKind; mood?: Mood; size?: number; animated?: boolean; title?: string; className?: string }) {
  return (
    <span className={cx('ui-pal', className)} style={{ width: size, height: size, ['--pal-c' as string]: `var(--c-char-${kind})` }}>
      <Character kind={kind} mood={mood} size={Math.round(size * 0.86)} animated={animated} title={title} />
    </span>
  );
}

/* ───────────── Badge ───────────── */
/** Count pill. Pass `decorative` when the count is announced elsewhere (e.g. sr-only text next to it). */
export function Badge({ count, max = 99, testId, decorative, className }: { count: number; max?: number; testId?: string; decorative?: boolean; className?: string }) {
  if (count <= 0) return null;
  return <span className={cx('ui-badge', className)} data-testid={testId} aria-hidden={decorative || undefined}>{count > max ? `${max}+` : count}</span>;
}

/* ───────────── Skeleton ───────────── */
export function Skeleton({ w = '100%', h = 14, r = 8, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={cx('ui-skel', className)} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

/* ───────────── Spinner ───────────── */
export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="ui-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/* ───────────── SectionHeader (optionally collapsible) ───────────── */
export function SectionHeader({ title, count, action, open, onToggle, controls }:
  { title: ReactNode; count?: number; action?: ReactNode; open?: boolean; onToggle?: () => void; controls?: string }) {
  const body = (
    <>
      <span className="ui-sechead__title">{title}</span>
      {count !== undefined && <span className="ui-sechead__count">{count}</span>}
      {onToggle && <Icon name="chevronDown" size={18} className={cx('ui-sechead__chev', !open && 'is-closed')} />}
    </>
  );
  return (
    <div className="ui-sechead">
      <h2 className="ui-sechead__h">
        {onToggle
          ? <button type="button" className="ui-sechead__toggle" aria-expanded={open} aria-controls={controls} onClick={onToggle}>{body}</button>
          : <span className="ui-sechead__toggle">{body}</span>}
      </h2>
      {action}
    </div>
  );
}

/* ───────────── SpeechBubble ───────────── */
export function SpeechBubble({ children, tail = 'left', className, testId }: { children: ReactNode; tail?: 'left' | 'top' | 'bottom'; className?: string; testId?: string }) {
  return <div className={cx('ui-bubble', `ui-bubble--${tail}`, className)} data-testid={testId}>{children}</div>;
}

/* ───────────── EmptyState ───────────── */
export function EmptyState({ kind = 'truck', mood = 'idle', art, title, body, children, testId, compact }:
  { kind?: CharacterKind; mood?: Mood; art?: ReactNode; title: ReactNode; body?: ReactNode; children?: ReactNode; testId?: string; compact?: boolean }) {
  return (
    <div className={cx('ui-empty', compact && 'ui-empty--compact')} data-testid={testId}>
      <div className="ui-empty__art" aria-hidden="true">
        <span className="ui-empty__glow" />
        {art ?? <Character kind={kind} mood={mood} size={compact ? 96 : 132} />}
      </div>
      <h2 className="ui-empty__title">{title}</h2>
      {body && <p className="ui-empty__body">{body}</p>}
      {children && <div className="ui-empty__actions">{children}</div>}
    </div>
  );
}

/* ───────────── ConfirmSheet ───────────── */
export function ConfirmSheet({ open, onClose, onConfirm, title, body, confirmLabel, cancelLabel, danger, confirmTestId, testId, kind, mood = 'worried' }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: ReactNode; confirmLabel: string; cancelLabel: string;
    danger?: boolean; confirmTestId?: string; testId?: string; kind?: CharacterKind; mood?: Mood }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} testId={testId}>
      <div className="ui-confirm">
        {kind && <div className="ui-confirm__art" aria-hidden="true"><Character kind={kind} mood={mood} size={88} /></div>}
        {body && <p className="ui-confirm__body">{body}</p>}
        <div className="ui-confirm__actions">
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} data-testid={confirmTestId} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Sheet>
  );
}
