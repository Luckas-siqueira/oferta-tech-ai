import { safeURL } from '../shared/offer';
export const extractionFailure = 'Não foi possível extrair todas as informações. Adicione uma imagem do produto para continuar.';
const shops = ['amazon.com.br', 'amazon.com', 'amzn.to', 'mercadolivre.com.br', 'mercadolivre.com', 'meli.la', 'shopee.com.br', 'shope.ee', 'magazineluiza.com.br', 'magalu.com', 'kabum.com.br', 'pichau.com.br', 'terabyteshop.com.br', 'aliexpress.com', 'aliexpress.us'];
const cdns = ['luckas-siqueira.github.io', 'media-amazon.com', 'ssl-images-amazon.com', 'mlstatic.com', 'shopeemobile.com', 'shopee.com.br', 'alicdn.com', 'magazineluiza.com.br', 'magalu.com', 'kabum.com.br', 'pichau.com.br', 'terabyteshop.com.br'];
export function allowedURL(raw: string, image = false) { if (!safeURL(raw))
    return false; const u = new URL(raw); return u.protocol === 'https:' && (!u.port || u.port === '443') && [...shops, ...(image ? cdns : [])].some(domain => u.hostname === domain || u.hostname.endsWith('.' + domain)); }
export async function boundedBody(response: Response, max: number) { const reader = response.body?.getReader(); if (!reader)
    throw Error('Resposta vazia.'); const chunks: Uint8Array[] = []; let total = 0; try {
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > max)
            throw Error('O conteúdo ultrapassou o tamanho permitido.');
        chunks.push(value);
    }
}
finally {
    await reader.cancel().catch(() => { });
} const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
} return bytes; }
export async function fetchExternal(raw: string, image = false, fetcher: typeof fetch = fetch) { let current = raw; for (let i = 0; i < 6; i++) {
    if (!allowedURL(current, image))
        throw Error('Esta loja ou destino ainda não está na lista de leitura segura. Preencha os dados manualmente.');
    const r = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { Accept: image ? 'image/jpeg,image/png,image/webp' : 'text/html,application/xhtml+xml', 'User-Agent': 'OfertaTechAI/1.0 (public product metadata)' } });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
        const location = r.headers.get('location');
        await r.body?.cancel();
        if (!location)
            throw Error('Redirecionamento inválido.');
        current = new URL(location, current).href;
        continue;
    }
    if (!r.ok) {
        await r.body?.cancel();
        throw Error('A loja bloqueou a leitura ou o produto está indisponível.');
    }
    return { response: r, url: current };
} throw Error('O link redirecionou muitas vezes.'); }
export function decode(s: unknown) { return String(s ?? '').replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi, m => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[m.toLowerCase()]!).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, v: string) => { const n = v[0].toLowerCase() === 'x' ? parseInt(v.slice(1), 16) : Number(v); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }); }
function clean(s: unknown, max = 500) { return decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function attrs(s: string) { const a: Record<string, string> = {}; for (const m of s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
    a[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]); return a; }
export function parsePrice(raw: unknown) { if (typeof raw === 'number')
    return Number.isFinite(raw) && raw > 0 ? raw : null; if (typeof raw !== 'string' || !raw.trim())
    return null; let s = raw.replace(/[^\d.,]/g, ''); if (s.includes(',') && s.includes('.'))
    s = s.replace(/\./g, '').replace(',', '.');
else if (s.includes(','))
    s = s.replace(',', '.'); const n = Number(s); return n > 0 && n < 10000000 ? n : null; }
export type Extracted = {
    name: string;
    description: string;
    image_url: string;
    price: number | null;
    previous_price: number | null;
    brand: string;
    category: string;
    specs: string[];
    store: string;
    partial: boolean;
    warning: string;
};
export function parseProduct(html: string, base: string): Extracted {
    const meta: Record<string, string> = {};
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
        const a = attrs(m[0]);
        const key = (a.property || a.name || '').toLowerCase();
        if (key && a.content && !meta[key])
            meta[key] = a.content;
    }
    let product: Record<string, unknown> | null = null;
    const walk = (value: unknown, depth = 0) => { if (depth > 15 || !value || product)
        return; if (Array.isArray(value))
        for (const v of value)
            walk(v, depth + 1);
    else if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if ([].concat(obj['@type'] as never || []).some((t: string) => /^(?:https?:\/\/schema.org\/)?Product$/i.test(t))) {
            product = obj;
            return;
        }
        for (const v of Object.values(obj))
            if (v && typeof v === 'object')
                walk(v, depth + 1);
    } };
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
        if (attrs(m[1]).type?.toLowerCase() === 'application/ld+json')
            try {
                walk(JSON.parse(m[2]));
            }
            catch { }
    const p = (product || {}) as Record<string, any>;
    const name = clean(p.name || meta['og:title'] || meta['twitter:title'] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180);
    const description = clean(p.description || meta['og:description'] || meta.description, 360);
    let raw = p.image;
    if (Array.isArray(raw))
        raw = raw[0];
    if (raw && typeof raw === 'object')
        raw = raw.url || raw.contentUrl;
    raw = raw || meta['og:image'] || meta['twitter:image'];
    let image_url = '';
    try {
        if (raw) {
            const u = new URL(raw, base);
            if (allowedURL(u.href, true))
                image_url = u.href;
        }
    }
    catch { }
    let offer = p.offers;
    if (Array.isArray(offer))
        offer = offer[0];
    const currency = offer?.priceCurrency || meta['product:price:currency'] || meta['og:price:currency'];
    const rawPrice = offer?.price ?? meta['product:price:amount'] ?? meta['og:price:amount'];
    const price = currency === 'BRL' ? parsePrice(rawPrice) : null;
    const brand = clean(typeof p.brand === 'object' ? p.brand?.name : p.brand, 100);
    const specs = Array.isArray(p.additionalProperty) ? p.additionalProperty.slice(0, 20).map((v: any) => clean([v.name, v.value].filter(Boolean).join(': '), 200)).filter(Boolean) : [];
    const partial = !name || !description || !image_url;
    return { name, description, image_url, price, previous_price: null, brand, category: clean(p.category, 80), specs, store: new URL(base).hostname.replace(/^www\./, ''), partial, warning: partial ? extractionFailure : '' };
}
export async function extractProduct(url: string) { const { response, url: base } = await fetchExternal(url); if (!/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw Error('O link não aponta para uma página HTML de produto.');
} return parseProduct(new TextDecoder().decode(await boundedBody(response, 2000000)), base); }
export function imageType(bytes: Uint8Array) { if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'; if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return 'image/png'; if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP')
    return 'image/webp'; return null; }
export async function remoteImage(url: string) { const { response } = await fetchExternal(url, true); const bytes = await boundedBody(response, 5000000); const type = imageType(bytes); if (!type)
    throw Error('A imagem deve ser JPG, PNG ou WebP.'); return { bytes, type }; }

