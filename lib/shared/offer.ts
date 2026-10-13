import { z } from 'zod';
export const categories = ['Informática', 'Computadores', 'Processadores', 'Placas de vídeo', 'Memória RAM', 'SSDs e HDs', 'Placas-mãe', 'Fontes', 'Periféricos', 'Monitores', 'Acessórios gamer', 'Outros eletrônicos'] as const;
export const statuses = ['review', 'ready', 'shared'] as const;
export type Status = typeof statuses[number];
export type Style = 'simple' | 'professional' | 'promotional';
export const statusLabel: Record<Status, string> = { review: 'Aguardando revisão', ready: 'Pronta', shared: 'Compartilhada' };
export function safeURL(value: string) { try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && value.length <= 4096;
}
catch {
    return false;
} }
const url = z.string().max(4096).refine(safeURL, 'Informe um link HTTP ou HTTPS válido.');
export const offerSchema = z.object({ name: z.string().trim().min(1, 'Informe o nome do produto.').max(180), description: z.string().trim().max(700), affiliate_url: url, image_url: z.union([z.literal(''), url]).default(''), image_path: z.string().max(300).nullable().default(null), price: z.number().finite().positive().max(10000000).nullable(), previous_price: z.number().finite().positive().max(10000000).nullable(), brand: z.string().max(100).default(''), category: z.enum(categories), specs: z.array(z.string().max(200)).max(20).default([]),
    keywords: z.array(z.string().max(60)).max(10).default([]), store: z.string().max(120).default(''), status: z.enum(statuses), style: z.enum(['simple', 'professional', 'promotional']), message: z.string().max(6000), affiliate_disclosure: z.boolean(), uncertainties: z.array(z.string().max(250)).max(20).default([]) }).strict().superRefine((v, c) => { if (v.status === 'ready' && v.uncertainties.length)
    c.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Confirme os dados incertos antes de marcar como pronta.' }); });
export type OfferInput = z.infer<typeof offerSchema>;
export type Offer = OfferInput & {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    signed_image_url?: string;
};
export function emptyOffer(): OfferInput { return { name: '', description: '', affiliate_url: '', image_url: '', image_path: null, price: null, previous_price: null, brand: '', category: 'Informática', specs: [], keywords: [], store: '', status: 'review', style: 'promotional', message: '', affiliate_disclosure: true, uncertainties: [] }; }
export function currency(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }
export function confirmedDiscount(o: Pick<OfferInput, 'price' | 'previous_price'>) { return o.price !== null && o.price > 0 && o.previous_price !== null && o.previous_price > o.price ? Math.floor(((o.previous_price - o.price) / o.previous_price) * 100 + 1e-9) : null; }
export function generateMessage(o: OfferInput) { const discount = confirmedDiscount(o); const price = o.price !== null && o.price > 0 ? `💰 Preço: ${currency(o.price)}` : ''; const off = discount && discount > 0 ? `🏷️ Desconto: ${discount}% (sobre ${currency(o.previous_price!)})` : ''; const disclosure = o.affiliate_disclosure ? 'Link de afiliado: posso receber uma comissão pela compra.' : ''; const parts = o.style === 'simple' ? [o.name, o.description, price, off, o.affiliate_url, disclosure] : o.style === 'professional' ? [`🖥️ ${o.name}`, o.description, price, off, `🛒 Confira a oferta:\n${o.affiliate_url}`, disclosure, 'Preço e disponibilidade sujeitos a alteração.'] : ['🔥 OFERTA TECH ENCONTRADA!', `🖥️ ${o.name}`, o.description ? `📝 ${o.description}` : '', price, off, `🛒 Confira a oferta:\n${o.affiliate_url}`, '⚡ Aproveite enquanto estiver disponível!', disclosure, 'Preço e disponibilidade podem mudar. Confira na loja.']; return parts.filter(Boolean).join('\n\n'); }
export function imageSource(o: Pick<Offer, 'image_url' | 'signed_image_url'>) { return o.signed_image_url || o.image_url || ''; }
export function uniqueLinks(text: string, existing: string[] = []) { const seen = new Set(existing); return text.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map(value => { if (!safeURL(value))
    return { url: value, status: 'invalid' as const }; if (seen.has(value))
    return { url: value, status: 'duplicate' as const }; seen.add(value); return { url: value, status: 'valid' as const }; }); }

