'use client';
import {extractViaActions} from '@/lib/actions-extract';
import {useStoreConnection} from './store';
import { useRef, useState } from 'react';
import { Link2, Play, RefreshCw, ArrowRight, Square } from 'lucide-react';
import { categories, emptyOffer, uniqueLinks, type Offer } from '@/lib/shared/offer';
import { api, body, type Config } from '@/lib/client';
import type { Draft } from './editor';
import { Button, ProductImage } from './ui';
type Row = {
    url: string;
    status: 'waiting' | 'processing' | 'review' | 'image' | 'failed' | 'duplicate' | 'invalid';
    draft?: Draft;
    error?: string;
};
const labels = { waiting: 'Na fila', processing: 'Processando…', review: 'Aguardando revisão', image: 'Imagem necessária', failed: 'Falha na extração', duplicate: 'Duplicado', invalid: 'Link inválido' };
export function Batch({ offers, config, onReview, notify, jinaKey }: {
    offers: Offer[];
    jinaKey?: string;
    config: Config | null;
    onReview: (d: Draft) => void;
    notify: (s: string) => void;
}) {
    const {token:githubToken}=useStoreConnection();
    const [provider,setProvider]=useState('auto');
    const [text, setText] = useState(''), [rows, setRows] = useState<Row[]>([]), [running, setRunning] = useState(false);
    const stop = useRef(false);
    const patch = (index: number, update: Partial<Row>) => setRows(old => old.map((r, i) => i === index ? { ...r, ...update } : r));
    async function processRow(row: Row, index: number) { patch(index, { status: 'processing', error: '' }); try {
        const data = provider==='github'?await extractViaActions(githubToken,row.url):await api('extract', body({ url: row.url,...(jinaKey?{jina_key:jinaKey}:{}) }));
        let draft: Draft = { ...emptyOffer(), affiliate_url: row.url, name: data.name, description: data.description, image_url: data.image_url, price: data.price, previous_price:data.previous_price, brand: data.brand, store: data.store, specs: data.specs, category: categories.includes(data.category) ? data.category : 'Informática' };
        let aiWarning = '';
        if (config?.ai && config?.user && (draft.image_url || draft.name)) {
            try {
                const ai = await api('ai', body({ name: draft.name, description: draft.description, brand: draft.brand, specs: draft.specs, image_path: null, image_url: draft.image_url || undefined }));
                draft = { ...draft, name: ai.name || draft.name, description: ai.description, keywords: ai.keywords, category: ai.category, brand: ai.brand || draft.brand, specs: ai.specs, uncertainties: ai.uncertainties };
            }
            catch (e) {
                aiWarning = 'IA: ' + (e as Error).message;
            }
        }
        patch(index, { status: draft.image_url ? 'review' : 'image', draft, error: aiWarning || data.warning });
    }
    catch (e) {
        patch(index, { status: 'failed', error: (e as Error).message, draft: { ...emptyOffer(), affiliate_url: row.url } });
    } }
    async function run(input: Row[], retry = false) { stop.current = false; setRunning(true); let pointer = 0; const targets = input.map((r, i) => ({ r, i })).filter(x => retry ? x.r.status === 'failed' : x.r.status === 'waiting'); async function worker() { while (pointer < targets.length && !stop.current) {
        const { r, i } = targets[pointer++];
        await processRow(r, i);
    } } try {
        await Promise.all(provider==='github'?[worker()]:[worker(),worker()]);
        notify(stop.current ? 'Processamento pausado. Os resultados concluídos foram mantidos.' : 'Links processados. Revise cada oferta antes de salvar.');
    }
    finally {
        setRunning(false);
    } }
    return <section className="panel"><div className="section-head"><div><h2>Adicionar vários links</h2><p>Uma fila organizada. Você revisa antes de cadastrar.</p></div><span className="pill">PROCESSAMENTO EM LOTE</span></div><label>Método de leitura<select disabled={running} value={provider} onChange={e=>setProvider(e.target.value)}><option value="auto">Leitura direta + Jina</option><option value="github">GitHub Actions · uma tarefa por produto</option></select></label><label>Links de afiliado (um por linha)<textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={'https://loja.com/produto1\nhttps://loja.com/produto2'} disabled={running}/></label><p className="hint">Até 50 links por lote, com duas leituras simultâneas. Links originais e parâmetros são preservados.</p><div className="action-row"><Button disabled={running || !text.trim()} variant="primary" onClick={() => { const links = uniqueLinks(text, offers.map(o => o.affiliate_url)); if (links.length > 50) {
        notify('Cole até 50 links por lote.');
        return;
    } const input = links.map(({ url, status }) => ({ url, status: status === 'valid' ? 'waiting' : status } as Row)); setRows(input); run(input); }}><Play size={16}/>Processar todos os links</Button>{running ? <Button onClick={() => { stop.current = true; }}><Square size={14}/>Parar após os atuais</Button> : <><Button disabled={!rows.some(r => r.status === 'failed')} variant="secondary" onClick={() => run(rows, true)}><RefreshCw size={15}/>Tentar falhas novamente</Button><Button disabled={!rows.some(r => r.status === 'waiting')} onClick={() => run(rows)} variant="ghost">Continuar fila</Button></>}</div>{rows.length > 0 && <div className="batch-summary"><span>{rows.filter(r => ['review', 'image'].includes(r.status)).length} processado(s)</span><span>{rows.filter(r => r.status === 'processing').length} em andamento</span><span>{rows.filter(r => r.status === 'failed').length} falha(s)</span></div>}<div className="batch-list">{rows.map((row, index) => <article className="batch-item" key={index}><ProductImage src={row.draft?.image_url} name={row.draft?.name || 'Produto'}/><div><strong>{row.draft?.name || 'Produto ' + (index + 1)}</strong><small>{row.url}</small><span className={'status ' + (row.status === 'failed' ? 'error' : 'review')}>{labels[row.status]}</span>{row.error && <p className="hint">{row.error}</p>}</div>{row.draft && <Button disabled={running} variant="secondary" onClick={() => onReview(row.draft!)}>Revisar<ArrowRight size={15}/></Button>}</article>)}</div></section>;
}

