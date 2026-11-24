import { ArrowUpRight, ChevronRight, CircleAlert, Inbox, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function Panel({ title, subtitle, action, children, className = '' }: {
  title: ReactNode; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`panel ${className}`}>
    <header className="panel-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </header>
    {children}
  </section>;
}

export function Metric({ title, value, caption, icon, tone = 'mint', href }: {
  title: string; value: string; caption?: string; icon: ReactNode; tone?: string; href?: string;
}) {
  const Card = href ? 'a' : 'div';
  return <Card className={href ? 'metric metric-link' : 'metric'} href={href}>
    <div className="metric-top"><span className="metric-label">{title}{href && <ArrowUpRight size={13} aria-hidden="true" />}</span>
      <span className={`metric-icon ${tone}`}>{icon}</span></div>
    <strong>{value}</strong>
    {caption && <p>{caption}</p>}
  </Card>;
}

export function RankLink({ href, label, value, share, color }: {
  href: string; label: string; value: string; share: number; color?: string;
}) {
  return <a className="rank-item" href={href}>
    <span>{label}</span><strong>{value}<ChevronRight size={13} aria-hidden="true" /></strong>
    <i aria-hidden="true"><b style={{ width: `${Math.max(0, share) * 100}%`, background: color }} /></i>
  </a>;
}

export function Empty({ message, children }: { message: string; children?: ReactNode }) {
  return <div className="empty"><Inbox size={23} /><p>{message}</p>{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="status"><CircleAlert size={17} /><div>{children}</div></div>;
}

export function Dialog({ title, children, close, className }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={className} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="dialog-inner">
      <header className="dialog-head"><h2 id={titleId}>{title}</h2><button className="icon-btn" type="button" onClick={close} aria-label="Sluiten"><X size={19} /></button></header>
      {children}
    </div>
  </dialog>;
}
