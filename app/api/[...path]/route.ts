import { z } from 'zod';
import { offerSchema,removeAffiliateDisclosure } from '@/lib/shared/offer';
import { analyzeProduct } from '@/lib/server/ai';
import { allowedURL, boundedBody, extractProduct, imageType, remoteImage, extractionFailure } from '@/lib/server/extraction';
import { ApiError, authenticate, configuration, consumeQuota, cookieToken, readJSON, sb, sessionCookies, signedImage } from '@/lib/server/supabase';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
function originGuard(r: Request) { const origin = r.headers.get('origin'); if (origin && origin !== new URL(r.url).origin)
    throw new ApiError('Origem não autorizada.', 403); if (r.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError('Origem não autorizada.', 403); }
function cookies(response: Response, session: unknown, r: Request) { for (const cookie of sessionCookies(session, new URL(r.url).protocol === 'https:'))
    response.headers.append('Set-Cookie', cookie); return response; }
async function cleanStorage(token: string, paths: string[]) { let failed = 0; for (const path of paths) {
    try {
        await sb('/storage/v1/object/offer-images', token, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) });
        await sb('/rest/v1/image_delete_queue?path=eq.' + encodeURIComponent(path), token, { method: 'DELETE' });
    }
    catch {
        failed++;
    }
} return failed; }
async function releaseImage(token: string, path: string) { const r = await sb('/rest/v1/rpc/release_image', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset_path: path }) }); return (await r.json()) ? cleanStorage(token, [path]) : 0; }
async function attachImages(token: string, offers: any[]) { return Promise.all(offers.map(async (o) => { if (o.image_path)
    try {
        o.signed_image_url = await signedImage(token, o.image_path);
    }
    catch {
        o.signed_image_url = '';
    } return {...o,message:removeAffiliateDisclosure(o.message||''),affiliate_disclosure:false}; })); }
async function handle(request: Request) {
    const path = new URL(request.url).pathname.replace(/^\/api\//, '');
    try {
        if (request.method !== 'GET')
            originGuard(request);
        if (path === 'status') {
            const config = configuration();
            let user = null;
            if (config.database && cookieToken(request))
                try {
                    user = (await authenticate(request)).user;
                }
                catch { }
            return json({ database: config.database, ai: config.ai, user, quotas: { ai: 20, extract: 30 }, stores: ['Amazon', 'Mercado Livre', 'Shopee', 'Magalu', 'KaBuM!', 'Pichau', 'Terabyte', 'AliExpress'] });
        }
        if (path === 'auth/logout' && request.method === 'POST')
            return cookies(json({ ok: true }), {}, request);
        if (path === 'auth/login' || path === 'auth/signup') {
            if (request.method !== 'POST')
                throw new ApiError('Método inválido.', 405);
            const input = z.object({ email: z.string().trim().toLowerCase().email().max(250), password: z.string().min(8).max(128) }).parse(await readJSON(request));
            const route = path === 'auth/login' ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup';
            const response = await sb(route, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
            const session = await response.json() as any;
            if (path === 'auth/login' && (!session.access_token || !session.user?.id)) throw new ApiError('O login não retornou uma sessão válida. Tente novamente.', 502);
            if (path === 'auth/signup' && Array.isArray(session.user?.identities) && !session.user.identities.length) throw new ApiError('Já existe uma conta para este e-mail. Use Entrar ou Esqueci minha senha.', 409);
            return cookies(json({ user: session.user || null, confirmation_required: !session.access_token }), session, request);
        }
        if (path === 'auth/recover' && request.method === 'POST') {
            const input = z.object({email: z.string().trim().toLowerCase().email().max(250)}).parse(await readJSON(request));
            const redirect = new URL(request.url).origin + '/';
            await sb('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), undefined, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input)});
            return json({ok:true});
        }
        if (path === 'auth/verify-recovery' && request.method === 'POST') {
            const input = z.object({link:z.string().trim().min(20).max(4096)}).parse(await readJSON(request));
            let token = input.link;
            if (token.startsWith('https://')) { const u = new URL(token); if (u.origin !== new URL(configuration().url).origin || u.pathname !== '/auth/v1/verify' || u.searchParams.get('type') !== 'recovery') throw new ApiError('Copie o link de recuperação enviado por este aplicativo.'); token = u.searchParams.get('token') || ''; }
            if (!/^[a-zA-Z0-9_-]{20,256}$/.test(token)) throw new ApiError('Link de recuperação inválido. Solicite um novo e copie o endereço completo.');
            const r = await sb('/auth/v1/verify', undefined, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token_hash:token,type:'recovery'})});
            const session = await r.json() as any;
            if (!session.access_token || !session.user?.id) throw new ApiError('O link não gerou uma sessão. Solicite um novo link.',400);
            return cookies(json({ok:true}),session,request);
        }
        if (path === 'auth/recovery-session' && request.method === 'POST') {
            const input=z.object({access_token:z.string().min(20).max(10000),refresh_token:z.string().min(10).max(1000)}).parse(await readJSON(request));
            const r=await sb('/auth/v1/user',input.access_token); const user=await r.json() as any;
            if (!user.id) throw new ApiError('Link expirado. Solicite um novo link.',401);
            return cookies(json({ok:true}),{...input,expires_in:3600},request);
        }
        if (path === 'auth/password' && request.method === 'POST') {
            const {token}=await authenticate(request);
            const input=z.object({password:z.string().min(8).max(128)}).parse(await readJSON(request));
            await sb('/auth/v1/user',token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
            return json({ok:true});
        }
        if (path === 'auth/refresh' && request.method === 'POST') {
            const token = cookieToken(request, 'ota_refresh');
            if (!token)
                throw new ApiError('Entre novamente.', 401);
            const r = await sb('/auth/v1/token?grant_type=refresh_token', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: token }) });
            return cookies(json({ ok: true }), await r.json(), request);
        }
        // Extraction can be used by a signed-in private Site visitor before database setup.
        if (path === 'extract' && request.method === 'POST') {
            if (configuration().database) {
                const { token } = await authenticate(request);
                await consumeQuota(token, 'extract');
            }
            else if (!await getChatGPTUser())
                throw new ApiError('Entre pelo ChatGPT para preparar rascunhos, ou configure o Supabase.', 401);
            const input = z.object({ url: z.string().url().max(4096) }).parse(await readJSON(request));
            try {
                return json(await extractProduct(input.url));
            }
            catch (e) {
                throw new ApiError(extractionFailure + ' ' + (e instanceof Error ? e.message : ''), 422);
            }
        }
        const { token, user } = await authenticate(request);
        if (path === 'stats' && request.method === 'GET') {
            const filters = { total: '', generated: '&message=neq.', shared: '&status=eq.shared', review: '&status=eq.review' };
            const entries = await Promise.all(Object.entries(filters).map(async ([key, filter]) => { const r = await sb('/rest/v1/offers?select=id' + filter, token, { headers: { Prefer: 'count=exact', Range: '0-0' } }); const range = r.headers.get('content-range') || ''; await r.body?.cancel(); const count = Number(range.split('/')[1]); if (!Number.isFinite(count))
                throw new ApiError('Não foi possível obter os indicadores.', 502); return [key, count]; }));
            return json(Object.fromEntries(entries));
        }
        if (path === 'offers' && request.method === 'GET') {
            const r = await sb('/rest/v1/offers?select=*&order=created_at.desc&limit=1000', token);
            const offers = await attachImages(token, await r.json());
            return json({ offers, limited: offers.length === 1000 });
        }
        if (path === 'offers' && request.method === 'POST') {
            const input = offerSchema.parse(await readJSON(request)); input.message=removeAffiliateDisclosure(input.message); input.affiliate_disclosure=false;
            if (input.image_path && !input.image_path.startsWith(user.id + '/'))
                throw new ApiError('Imagem não autorizada.', 403);
            const r = await sb('/rest/v1/offers', token, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ ...input, user_id: user.id }) });
            return json({ offer: (await attachImages(token, await r.json()))[0] }, 201);
        }
        if (path.startsWith('offers/') && path !== 'offers/delete' && request.method === 'PATCH') {
            const id = uuid.parse(path.split('/')[1]);
            const input = offerSchema.parse(await readJSON(request)); input.message=removeAffiliateDisclosure(input.message); input.affiliate_disclosure=false;
            if (input.image_path && !input.image_path.startsWith(user.id + '/'))
                throw new ApiError('Imagem não autorizada.', 403);
            const old = await sb('/rest/v1/offers?id=eq.' + id + '&select=image_path', token);
            const before = await old.json() as any[];
            if (!before.length)
                throw new ApiError('Oferta não encontrada.', 404);
            const r = await sb('/rest/v1/offers?id=eq.' + id, token, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(input) });
            const updated = await r.json() as any[];
            if (!updated.length)
                throw new ApiError('Oferta não encontrada.', 404);
            let cleanup_pending = 0;
            if (before[0].image_path && before[0].image_path !== input.image_path)
                try {
                    cleanup_pending = await releaseImage(token, before[0].image_path);
                }
                catch {
                    cleanup_pending = 1;
                }
            return json({ offer: (await attachImages(token, updated))[0], cleanup_pending });
        }
        if (path === 'offers/delete' && request.method === 'POST') {
            const input = z.object({ ids: z.array(uuid).min(1).max(100) }).parse(await readJSON(request));
            const ids = [...new Set(input.ids)];
            const r = await sb('/rest/v1/rpc/delete_offers', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_ids: ids }) });
            const result = await r.json() as {
                ids: string[];
                paths: string[];
            };
            const cleanup_pending = await cleanStorage(token, result.paths || []);
            return json({ ids: result.ids, cleanup_pending });
        }
        if (path === 'images/cleanup' && request.method === 'POST') {
            const r = await sb('/rest/v1/image_delete_queue?select=path&limit=100', token);
            const rows = await r.json() as {
                path: string;
            }[];
            return json({ remaining: await cleanStorage(token, rows.map((x: any) => x.path)) });
        }
        if (path === 'images' && request.method === 'POST') {
            const declared = Number(request.headers.get('content-length') || 0);
            if (declared > 5500000)
                throw new ApiError('Limite de imagem: 5 MB.', 413);
            const bytes = await boundedBody(new Response(request.body), 5000000);
            const mime = imageType(bytes);
            if (!mime)
                throw new ApiError('Envie uma imagem JPG, PNG ou WebP válida.', 415);
            const path = user.id + '/' + crypto.randomUUID() + '.' + (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
            await sb('/storage/v1/object/offer-images/' + path, token, { method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes as unknown as BodyInit });
            try {
                await sb('/rest/v1/image_assets', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, user_id: user.id }) });
            }
            catch (e) {
                await cleanStorage(token, [path]);
                throw e;
            }
            return json({ path, url: await signedImage(token, path) }, 201);
        }
        if (path === 'images/release' && request.method === 'POST') {
            const { path: assetPath } = z.object({ path: z.string().max(300) }).parse(await readJSON(request));
            if (!assetPath.startsWith(user.id + '/'))
                throw new ApiError('Imagem não autorizada.', 403);
            return json({ cleanup_pending: await releaseImage(token, assetPath) });
        }
        if (path === 'image' && request.method === 'GET') {
            const url = new URL(request.url).searchParams.get('url') || '';
            const { bytes, type } = await remoteImage(url);
            return new Response(bytes as unknown as BodyInit, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
        }
        if (path === 'ai' && request.method === 'POST') {
            if (!configuration().ai)
                throw new ApiError('Configure OPENAI_API_KEY no servidor para habilitar a IA.', 503);
            const input = z.object({ name: z.string().max(180), description: z.string().max(700), brand: z.string().max(100), specs: z.array(z.string().max(200)).max(20), image_path: z.string().max(300).nullable(), image_url: z.string().max(4096).optional(), image_data: z.string().max(6800000).optional() }).parse(await readJSON(request, 7000000));
            let image: string | undefined;
            if (input.image_path) {
                if (!input.image_path.startsWith(user.id + '/'))
                    throw new ApiError('Imagem não autorizada.', 403);
                const r = await sb('/storage/v1/object/authenticated/offer-images/' + input.image_path, token);
                const bytes = await boundedBody(r, 5000000);
                const type = imageType(bytes);
                if (!type)
                    throw new ApiError('Imagem inválida.');
                image = 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64');
            }
            else if (input.image_data) {
                const match = input.image_data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
                if (!match)
                    throw new ApiError('Imagem inválida.');
                const bytes = new Uint8Array(Buffer.from(match[2], 'base64'));
                if (bytes.length > 5000000 || imageType(bytes) !== match[1])
                    throw new ApiError('Imagem inválida ou maior que 5 MB.');
                image = input.image_data;
            }
            else if (input.image_url) {
                if (!allowedURL(input.image_url, true))
                    throw new ApiError('Imagem externa não suportada para análise. Envie a imagem pela galeria.');
                const { bytes, type } = await remoteImage(input.image_url);
                image = 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64');
            }
            if (!image && !input.name)
                throw new ApiError('Adicione uma imagem ou o nome do produto para analisar.');
            await consumeQuota(token, 'ai');
            const { image_path, image_data, image_url, ...context } = input;
            return json(await analyzeProduct(image, context));
        }
        throw new ApiError('Rota não encontrada.', 404);
    }
    catch (e) {
        if (e instanceof z.ZodError)
            return json({ error: e.issues.map(x => x.message).join(' ') }, 400);
        if (e instanceof ApiError)
            return json({ error: e.message }, e.status);
        return json({ error: e instanceof Error && e.name === 'TimeoutError' ? 'O serviço demorou a responder. Tente novamente.' : e instanceof Error ? e.message : 'Erro inesperado. Tente novamente.' }, 502);
    }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;

