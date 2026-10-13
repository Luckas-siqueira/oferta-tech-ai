import { removeAffiliateDisclosure, type Offer } from './shared/offer';
export type Config = {
    database: boolean;
    ai: boolean;
    user: {
        id: string;
        email: string;
    } | null;
    quotas: {
        ai: number;
        extract: number;
    };
    stores: string[];
};
export type Stats = {
    total: number;
    generated: number;
    shared: number;
    review: number;
};
let refreshPromise: Promise<boolean> | null = null;
export async function api<T = any>(path: string, options: RequestInit = {}, retry = true): Promise<T> { const response = await fetch('/api/' + path, { ...options, credentials: 'same-origin', headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); if (response.status === 401 && retry && !path.startsWith('auth/')) {
    if (!refreshPromise)
        refreshPromise = fetch('/api/auth/refresh', { method: 'POST' }).then(r => r.ok).finally(() => { refreshPromise = null; });
    if (await refreshPromise)
        return api<T>(path, options, false);
} const data = await response.json() as any; if (!response.ok)
    throw Error(data.error || 'Não foi possível concluir a operação.'); return data as T; }
export function body(data: unknown): RequestInit { return { method: 'POST', body: JSON.stringify(data) }; }
export async function copyText(text: string) { if (!text.trim())
    throw Error('Gere a mensagem primeiro.'); text=removeAffiliateDisclosure(text); if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
} const element = document.createElement('textarea'); element.value = text; element.style.position = 'fixed'; element.style.opacity = '0'; window.document.body.appendChild(element); element.select(); const ok = document.execCommand('copy'); element.remove(); if (!ok)
    throw Error('Seu navegador não permitiu copiar. Selecione o texto da prévia.'); }
export function openWhatsApp(message: string) { if (!message.trim())
    throw Error('Gere a mensagem primeiro.'); message=removeAffiliateDisclosure(message); window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer'); }
export async function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
export async function offerImage(o: Offer) { if (o.image_path && o.signed_image_url) {
    const r = await fetch(o.signed_image_url);
    if (!r.ok)
        throw Error('A foto expirou. Atualize o histórico.');
    return r.blob();
} if (o.image_url) {
    const response = await fetch('/api/image?url=' + encodeURIComponent(o.image_url));
    if (!response.ok)
        throw Error('Não foi possível baixar a foto. Envie uma imagem da galeria.');
    return response.blob();
} throw Error('Esta oferta não tem imagem.'); }
export async function shareImage(blob: Blob, message: string) { const file = new File([blob], 'oferta-tech.' + (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'), { type: blob.type }); const data = { files: [file], text: removeAffiliateDisclosure(message) }; if (typeof navigator.share==='function' && navigator.canShare?.({files:[file]})) {
    await navigator.share(data);
    return 'Foto entregue ao compartilhamento. Escolha WhatsApp, seu grupo e confira a legenda antes de enviar.';
} await downloadBlob(blob, file.name); await copyText(message); return 'Imagem baixada e texto copiado. Anexe a foto no grupo e cole a mensagem.'; }

