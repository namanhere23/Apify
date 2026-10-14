import React, { useEffect, useId, useRef } from 'react';
import { X, AlertCircle, ArrowUpRight, LoaderCircle } from 'lucide-react';
export function Avatar({ name = 'Agent', large = false, tone = '' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  const color = tone || (name.charCodeAt(0) % 2 ? 'sage' : 'rose');
  return <span className={`avatar ${large ? 'avatar-large' : ''} avatar-${color}`} aria-hidden="true">{initials}</span>;
}
export function SourceLinks({ person }) {
  return <div className="source-links"><a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`${person.name}'s LinkedIn profile`}>LinkedIn <ArrowUpRight size={13} /></a><a href={person.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`${person.name}'s Instagram profile`}>Instagram <ArrowUpRight size={13} /></a></div>;
}
export function ErrorNotice({ message, onRetry }) {
  return <div className="error-notice" role="alert"><AlertCircle size={19} /><div><strong>Something needs attention</strong><p>{message}</p></div>{onRetry && <button type="button" className="btn btn-small btn-secondary" onClick={onRetry}>Try again</button>}</div>;
}
export function Loading({ children = 'Loading…' }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spinner" size={23} /><span>{children}</span></div>;
}
export function EmptyState({ eyebrow, title, children, action }) {
  return <div className="empty-state"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{children}</p>{action}</div>;
}
export function Dialog({ title, subtitle, children, onClose, wide = false, busy = false }) {
  const id = useId(); const dialog = useRef(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy}><header className="dialog-header"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21} /></button></header><div className="dialog-body">{children}</div></section></div>;
}
export function formatTimestamp(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
}
export function ScoreBreakdown({ breakdown = {} }) {
  return <dl className="score-breakdown">{Object.entries(breakdown).filter(([, value]) => typeof value === 'number').map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd><span>{Math.round(value)}<small>/100</small></span><span className="score-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span></dd></div>)}</dl>;
}

