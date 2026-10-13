import { boundedBody } from './extraction';
export class ApiError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function configuration() { const url = process.env.SUPABASE_URL || ''; const key = process.env.SUPABASE_ANON_KEY || ''; return { url, key, database: Boolean(url && key), ai: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' }; }
export function requireConfig() { const config = configuration(); if (!config.database)
    throw new ApiError('Supabase ainda não configurado. O histórico e o salvamento serão habilitados após conectar o banco.', 503); return config; }
export async function sb(path: string, token?: string, options: RequestInit = {}) { const { url, key } = requireConfig(); const response = await fetch(url + path, { ...options, headers: { apikey: key, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers }, signal: AbortSignal.timeout(20000) }); if (!response.ok) {
    let error: any = {};
    try {
        error = await response.json();
    }
    catch { }
    throw new ApiError(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : error.message || error.msg || error.error_description || 'Não foi possível concluir a operação no banco.', response.status);
} return response; }
export function cookieToken(request: Request, name = 'ota_access') { const cookie = request.headers.get('cookie') || ''; return cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='))?.slice(name.length + 1) || ''; }
export async function authenticate(request: Request) { const token = cookieToken(request); if (!token)
    throw new ApiError('Entre na sua conta para acessar as ofertas.', 401); const response = await sb('/auth/v1/user', token); const user = await response.json() as {
    id: string;
    email: string;
}; if (!user.id)
    throw new ApiError('Sessão inválida.', 401); return { token, user }; }
export function sessionCookies(session: any, secure = true) { const suffix = `; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`; return [`ota_access=${session.access_token || ''}; Max-Age=${session.access_token ? Math.min(session.expires_in || 3600, 3600) : 0}${suffix}`, `ota_refresh=${session.refresh_token || ''}; Max-Age=${session.refresh_token ? 2592000 : 0}${suffix}`]; }
export async function readJSON(request: Request, max = 30000) { if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError('Envie JSON válido.', 415); const text = new TextDecoder().decode(await boundedBody(new Response(request.body), max)); try {
    return JSON.parse(text);
}
catch {
    throw new ApiError('JSON inválido.');
} }
export async function consumeQuota(token: string, kind: 'ai' | 'extract') { const response = await sb('/rest/v1/rpc/consume_usage', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usage_kind: kind }) }); if (!(await response.json()))
    throw new ApiError(kind === 'ai' ? 'Seu limite diário de IA foi atingido. Tente amanhã.' : 'Muitas leituras de links. Aguarde um minuto.', 429); }
export async function signedImage(token: string, path: string) { const r = await sb('/storage/v1/object/sign/offer-images/' + path.split('/').map(encodeURIComponent).join('/'), token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) }); const result = await r.json() as {
    signedURL: string;
}; return configuration().url + '/storage/v1' + result.signedURL; }

