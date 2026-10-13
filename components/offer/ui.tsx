'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, LoaderCircle, Package } from 'lucide-react';
export function Button({ children, onClick, type = 'button', variant = '', disabled = false, title }: {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    variant?: string;
    disabled?: boolean;
    title?: string;
}) { return <button type={type} className={'btn ' + variant} onClick={onClick} disabled={disabled} title={title}>{children}</button>; }
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []); return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose(); }}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Fechar" onClick={onClose}><X size={20}/></button></div>{children}</dialog>; }
export function ProductImage({ src, name, className = '' }: {
    src?: string;
    name: string;
    className?: string;
}) { return <div className={'product-image ' + className}>{src ? <img src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('image-failed'); }}/> : <Package size={32} strokeWidth={1.25}/>}</div>; }
export function Busy({ children }: {
    children: ReactNode;
}) { return <span className="busy"><LoaderCircle size={16} className="spin"/>{children}</span>; }
export function Empty({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <div className="empty"><div className="empty-icon"><Package size={30}/></div><h3>{title}</h3><p>{children}</p></div>; }

