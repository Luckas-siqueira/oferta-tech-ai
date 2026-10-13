'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Plus, Link2, History as HistoryIcon, Settings as SettingsIcon, ArrowUpRight, Package, Sparkles, Send, Clock, ChevronRight, Menu, X, RefreshCw, ShieldCheck, WifiOff, Cpu } from 'lucide-react';
import { emptyOffer, currency, statusLabel, imageSource, type Offer } from '@/lib/shared/offer';
import { api, body, type Config, type Stats } from '@/lib/client';
import {StoreProvider,MyStore} from './store';
import {Store} from 'lucide-react';
import { Editor, type Draft } from './editor';
import { History } from './history';
import { Batch } from './batch';
import { Settings } from './settings';
import { Button, Empty, ProductImage } from './ui';
type Page = 'dashboard' | 'new' | 'batch' | 'history' | 'settings' | 'store';
const nav = [{id: 'store' as Page, label: 'Minha loja', icon: Store}, { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard }, { id: 'new' as Page, label: 'Nova oferta', icon: Plus }, { id: 'batch' as Page, label: 'Vários links', icon: Link2 }, { id: 'history' as Page, label: 'Minhas ofertas', icon: HistoryIcon }, { id: 'settings' as Page, label: 'Configurações', icon: SettingsIcon }];
const headings: Record<Page, [
    string,
    string
]> = { store: ['Sua loja, no mesmo aplicativo.', 'Publique e organize os produtos da Mega Vitrine.'], dashboard: ['Suas próximas ofertas começam aqui.', 'Transforme produtos de tecnologia em ofertas prontas para compartilhar.'], new: ['Prepare sua próxima oferta.', 'Do link à mensagem: extraia, revise e compartilhe.'], batch: ['Mais links. Menos trabalho.', 'Processe uma lista de produtos e revise cada resultado.'], history: ['Tudo que você já preparou.', 'Consulte, edite e organize suas ofertas salvas.'], settings: ['Seu espaço, configurado.', 'Conecte os serviços e instale o aplicativo no celular.'] };
export default function OfferApp() {
    const [page, setPage] = useState<Page>('dashboard'), [config, setConfig] = useState<Config | null>(null), [offers, setOffers] = useState<Offer[]>([]), [stats, setStats] = useState<Stats | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [toast, setToast] = useState(''), [menu, setMenu] = useState(false), [initial, setInitial] = useState<Draft>(emptyOffer()), [limited, setLimited] = useState(false), [offline, setOffline] = useState(false);
    const [recovery,setRecovery]=useState(false);
    const currentDraft = useRef<Draft>(initial), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null), installPrompt = useRef<any>(null);
    const notify = useCallback((message: string) => { setToast(message); if (toastTimer.current)
        clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6500); }, []);
    const remember = useCallback((draft: Draft) => { currentDraft.current = draft; }, []);
    const loadOffers = useCallback(async () => { const [data, counts] = await Promise.all([api<{
            offers: Offer[];
            limited: boolean;
        }>('offers'), api<Stats>('stats')]); setOffers(data.offers); setLimited(data.limited); setStats(counts); setError(''); }, []);
    const reload = useCallback(async () => { setLoading(true); try {
        let data = await api<Config>('status');
        if (data.database && !data.user) {
            try {
                await api('auth/refresh', { method: 'POST' });
                data = await api<Config>('status');
            }
            catch { }
        }
        setConfig(data);
        if (data.database && data.user)
            await loadOffers();
        else {
            setOffers([]);
            setStats(null);
        }
        setError('');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }, [loadOffers]);
    useEffect(() => { const params=new URLSearchParams(window.location.hash.slice(1)); if(params.get('type')==='recovery' && params.get('access_token')) { const access_token=params.get('access_token'), refresh_token=params.get('refresh_token'); window.history.replaceState(null,'',window.location.pathname); api('auth/recovery-session',body({access_token,refresh_token})).then(()=>{setRecovery(true);setPage('settings');reload()}).catch(e=>notify(e.message)); } if (window.location.hash === '#loja') setPage('store'); reload(); const install = (e: Event) => { e.preventDefault(); installPrompt.current = e; }; const online = () => setOffline(!navigator.onLine); online(); window.addEventListener('beforeinstallprompt', install); window.addEventListener('online', online); window.addEventListener('offline', online); if ('serviceWorker' in navigator)
        navigator.serviceWorker.register('/sw.js').catch(() => { }); return () => { window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('online', online); window.removeEventListener('offline', online); }; }, [reload]);
    function go(next: Page) { if (page === 'new')
        setInitial(currentDraft.current); setPage(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function fresh() { if (page === 'new' && (currentDraft.current.name || currentDraft.current.affiliate_url) && !confirm('Começar um novo rascunho? As alterações não salvas serão descartadas.'))
        return; const d = emptyOffer(); currentDraft.current = d; setInitial(d); setPage('new'); setMenu(false); window.scrollTo(0, 0); }
    function edit(d: Draft) { setInitial(d); currentDraft.current = d; setPage('new'); window.scrollTo(0, 0); }
    async function saved(o: Offer, keepForm = false) { setOffers(old => old.some(x => x.id === o.id) ? old.map(x => x.id === o.id ? o : x) : [o, ...old]); if (!keepForm) { setInitial(o); currentDraft.current = o; } try {
        setStats(await api<Stats>('stats'));
    }
    catch {
        notify('Oferta salva. Não foi possível atualizar os indicadores; toque em Atualizar.');
    } }
    async function remove(ids: string[]) { const result = await api<{
        ids: string[];
        cleanup_pending: number;
    }>('offers/delete', body({ ids })); setOffers(old => old.filter(o => !result.ids.includes(o.id))); if (currentDraft.current.id && result.ids.includes(currentDraft.current.id)) {
        setInitial(emptyOffer());
        currentDraft.current = emptyOffer();
    } try {
        setStats(await api<Stats>('stats'));
    }
    catch {
        notify('Ofertas excluídas. Atualize para recarregar os indicadores.');
        return;
    } notify(result.cleanup_pending ? 'Oferta excluída com sucesso. Alguns arquivos aguardam limpeza em Configurações.' : 'Oferta excluída com sucesso'); }
    async function markShared(o: Offer) { const { id, user_id, created_at, updated_at, signed_image_url, ...data } = o; const r = await api<{
        offer: Offer;
    }>('offers/' + id, { ...body({ ...data, status: 'shared' }), method: 'PATCH' }); await saved(r.offer); notify('Oferta marcada como compartilhada.'); }
    async function install() { if (installPrompt.current) {
        await installPrompt.current.prompt();
        installPrompt.current = null;
    }
    else
        notify('No Chrome: toque no menu ⋮ e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.'); }
    const count = (key: keyof Stats) => loading ? '…' : stats ? stats[key] : '—';
    const ready = config?.database && config?.user;
    return <StoreProvider><div className="app-shell"><aside className={'sidebar ' + (menu ? 'open' : '')}><a className="brand" href="#" onClick={e => { e.preventDefault(); go('dashboard'); }}><div className="brand-icon"><Cpu size={23}/></div><div>Oferta Tech<span>AI</span><small>CENTRAL DE OFERTAS</small></div></a><button className="mobile-close icon-btn" aria-label="Fechar navegação" onClick={() => setMenu(false)}><X size={20}/></button><p className="nav-label">SEU ESPAÇO</p><nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}><Icon size={19}/>{label}{id === page && <ChevronRight size={15}/>}</button>)}</nav><div className="sidebar-tip"><div><ShieldCheck size={19}/><strong>Você tem o controle</strong></div><p>Revise cada oferta e confirme o envio no seu grupo.</p><span>Compartilhamento semiautomático</span></div><div className="sidebar-footer"><span className={'connection-dot ' + (ready ? 'connected' : '')}/>{ready ? 'Conta conectada' : 'Configuração pendente'}<small>Oferta Tech AI · v1.0</small></div></aside>{menu && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenu(false)}/>}<div className="main-shell"><header className="topbar"><button className="mobile-menu icon-btn" aria-label="Abrir navegação" onClick={() => setMenu(true)}><Menu size={22}/></button><div className="breadcrumb">Seu espaço <ChevronRight size={14}/><strong>{nav.find(n => n.id === page)?.label}</strong></div><div className="topbar-right"><span className="private-label"><ShieldCheck size={14}/>Espaço privado</span><button className="avatar" aria-label="Abrir configurações da conta" onClick={() => go('settings')}>{config?.user?.email?.slice(0, 1).toUpperCase() || 'OT'}</button></div></header><main><div className="page-heading"><div><div className="eyebrow">TECNOLOGIA QUE VIRA OPORTUNIDADE</div><h1>{headings[page][0]}</h1><p>{headings[page][1]}</p></div>{page === 'dashboard' && <Button variant="primary" onClick={fresh}><Plus size={17}/>Nova oferta</Button>}</div>{offline && <div className="notice warning"><WifiOff size={17}/>Você está offline. Banco, extração e IA precisam de internet.</div>}{error && <div className="notice error" role="alert">{error}<Button variant="ghost" onClick={() => reload()}>Tentar novamente</Button></div>}{!loading && (!config?.database || !config?.ai || !config?.user) && page !== 'settings' && <div className="setup-banner"><div><span className="setup-icon"><SettingsIcon size={18}/></span><div><strong>{!config?.database ? 'Finalize as conexões para guardar suas ofertas' : !config?.user ? 'Entre para acessar suas ofertas' : 'A integração de IA ainda está pendente'}</strong><p>{!config?.database ? 'Você pode preparar um rascunho. Salvamento e histórico aguardam Supabase.' : !config?.user ? 'Seu histórico e suas imagens são protegidos por usuário.' : 'A geração manual de mensagens e os outros recursos seguem disponíveis.'}</p></div></div><button onClick={() => go('settings')}>Configurar<ArrowUpRight size={15}/></button></div>}
    {page === 'dashboard' && <><div className="stats-grid">{[{ key: 'total' as const, label: 'Ofertas cadastradas', icon: Package, color: 'blue' }, { key: 'generated' as const, label: 'Mensagens geradas', icon: Sparkles, color: 'purple' }, { key: 'shared' as const, label: 'Compartilhadas', icon: Send, color: 'green' }, { key: 'review' as const, label: 'Aguardando revisão', icon: Clock, color: 'amber' }].map(({ key, label, icon: Icon, color }) => <div className="stat-card" key={key}><div className="stat-top"><span>{label}</span><div className={'stat-icon ' + color}><Icon size={19}/></div></div><strong>{count(key)}</strong><small>{stats ? 'Dados reais da sua conta' : 'Aguardando conexão com o banco'}</small></div>)}</div><div className="dashboard-grid"><section className="panel recent-panel"><div className="section-head"><div><h2>Últimas ofertas</h2><p>Seus produtos mais recentes</p></div><button className="text-button" onClick={() => go('history')}>Ver todas<ArrowUpRight size={14}/></button></div>{offers.length ? <div className="recent-list">{offers.slice(0, 5).map(o => <button className="recent-item" key={o.id} onClick={() => edit(o)}><ProductImage src={imageSource(o)} name={o.name}/><div><strong>{o.name}</strong><small>{o.category} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</small></div><div className="recent-meta"><b>{o.price !== null ? currency(o.price) : 'Sem preço'}</b><span className={'status ' + o.status}>{statusLabel[o.status]}</span></div></button>)}</div> : <Empty title={ready ? 'Sua primeira oferta está por vir' : 'Seu histórico aparecerá aqui'}>{ready ? 'Adicione um produto para começar a organizar suas ofertas.' : 'Conecte o Supabase e entre na conta. Nenhum dado de exemplo é usado no painel.'}</Empty>}<div className="panel-footer"><Button variant="secondary" onClick={() => go('history')}><HistoryIcon size={16}/>Ver todas as ofertas</Button><Button variant="ghost" onClick={() => reload()} disabled={loading}><RefreshCw size={15}/>Atualizar</Button></div></section><section className="quick-card"><div className="quick-icon"><Link2 size={27}/></div><span className="eyebrow">MAIS PRODUTIVIDADE</span><h2>Uma lista de links.<br />Várias oportunidades.</h2><p>Cole seus links de afiliado e prepare seus produtos em uma única fila de revisão.</p><Button onClick={() => go('batch')} variant="primary"><Plus size={17}/>Adicionar vários links</Button><div className="quick-points"><span><ShieldCheck size={14}/>Links originais preservados</span><span><Sparkles size={14}/>IA com revisão humana</span></div></section></div><section className="workflow-panel"><div><span className="pill">SEU FLUXO DE TRABALHO</span><h3>Pronto para compartilhar em 3 etapas.</h3></div><div className="workflow-steps"><span><b>01</b>Adicione o produto</span><span><b>02</b>Revise sua oferta</span><span><b>03</b>Escolha seu grupo</span></div></section></>}
    {page === 'new' && <Editor initial={initial} config={config} onSaved={saved} notify={notify} onChange={remember}/>}
    {page === 'batch' && <Batch offers={offers} config={config} onReview={edit} notify={notify}/>}
    {page === 'history' && <>{limited && <div className="notice warning">Exibindo os 1.000 registros mais recentes. Os indicadores incluem todo o banco.</div>}{!ready ? <section className="panel"><Empty title="Conecte sua conta para acessar o histórico">As ofertas serão consultadas no Supabase. Vá a Configurações para conectar e entrar.</Empty><Button variant="primary" onClick={() => go('settings')}>Abrir configurações</Button></section> : <History offers={offers} onEdit={edit} onDelete={remove} onMarkShared={markShared} notify={notify}/>}</>}
    {page === 'store' && <MyStore notify={notify} onReview={edit}/>}
    {page === 'settings' && <Settings recovery={recovery} onRecovered={()=>setRecovery(false)} config={config} reload={reload} notify={notify} install={install}/>}
    <footer className="app-footer"><span>Oferta Tech AI</span><span>Revise. Compartilhe. Venda com clareza.</span></footer></main></div><nav className="bottom-nav" aria-label="Navegação principal">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}><Icon size={19}/><span>{id === 'dashboard' ? 'Início' : id === 'history' ? 'Histórico' : id === 'settings' ? 'Ajustes' : label}</span></button>)}</nav>{toast && <div className="toast" role="status" aria-live="polite">{toast}<button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={16}/></button></div>}</div></StoreProvider>;
}

