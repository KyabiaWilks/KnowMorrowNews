import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { Mask, Tag } from '../lib/types';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="empty" style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
      <div className="spinner" />
      <span>{label}…</span>
    </div>
  );
}

export function Empty({ icon = '🌙', title, hint }: { icon?: string; title: string; hint?: ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 34, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: 'inherit', marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: 13 }}>{hint}</div>}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  dismissable = true,
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissable && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => dismissable && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 style={{ fontSize: 19 }}>{title}</h3>
            {subtitle && <div className="muted" style={{ marginTop: 5 }}>{subtitle}</div>}
          </div>
          {dismissable && (
            <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

const EVIDENCE = { yes: 'Detailed evidence included', no: 'No detailed evidence' };

export function TagChip({ label, onClick, active }: { label: string; onClick?: () => void; active?: boolean }) {
  const cls =
    label === EVIDENCE.yes ? 'chip chip--evidence' : label === EVIDENCE.no ? 'chip chip--noevidence' : 'chip';
  if (!onClick) return <span className={cls}>{label}</span>;
  return (
    <button type="button" className={`${cls} ${active ? 'chip--on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function TagPicker({
  tags,
  value,
  onChange,
  onCreate,
}: {
  tags: Tag[];
  value: string[];
  onChange: (next: string[]) => void;
  onCreate?: (label: string) => void;
}) {
  const toggle = (label: string) => {
    if (Object.values(EVIDENCE).includes(label)) {
      // 证据标签互斥，必须二选一
      const others = value.filter((v) => !Object.values(EVIDENCE).includes(v));
      onChange([label, ...others]);
      return;
    }
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label]);
  };

  return (
    <div className="stack" style={{ gap: 9 }}>
      <div className="row" style={{ gap: 6 }}>
        {tags
          .filter((t) => t.kind === 'system')
          .map((t) => (
            <TagChip key={t.id} label={t.label} active={value.includes(t.label)} onClick={() => toggle(t.label)} />
          ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {tags
          .filter((t) => t.kind !== 'system')
          .map((t) => (
            <TagChip key={t.id} label={t.label} active={value.includes(t.label)} onClick={() => toggle(t.label)} />
          ))}
        {onCreate && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              const label = window.prompt('New tag name (16 characters maximum)');
              if (label?.trim()) onCreate(label.trim());
            }}
          >
            ＋ New tag
          </button>
        )}
      </div>
    </div>
  );
}

/** 匿名身份徽章：只显示面具，不显示脸 */
export function MaskBadge({ mask, showMark = true }: { mask: Mask; showMark?: boolean }) {
  return (
    <span className="mask">
      <span className="mask__sigil">{mask.sigil}</span>
      {mask.alias}
      {showMark && mask.mark && <span className="mask__mark">#{mask.mark}</span>}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <span className="search__icon">🔍</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
