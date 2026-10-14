'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Link2, ImagePlus, Trash2, RefreshCw, Copy, Send, Save, Image as ImageIcon, Check } from 'lucide-react';
import { categories, emptyOffer, generateMessage, offerSchema, type Offer, type OfferInput, type Style } from '@/lib/shared/offer';
import { api, body, copyText, openWhatsApp, shareImage, type Config } from '@/lib/client';
import { Button, Busy, ProductImage } from './ui';
import {extractViaActions} from '@/lib/actions-extract';
import {useStoreConnection} from './store';
import {PublishStore} from './store';
import {ShareOffer} from './share';
import {removeAffiliateDisclosure} from '@/lib/shared/offer';
export type Draft = OfferInput & {
    id?: string;
    signed_image_url?: string;
};
export function Editor({ initial, config, onSaved, notify, onChange, jinaKey }: {
    jinaKey?: string;
    initial: Draft;
    config: Config | null;
    onSaved: (offer: Offer, keepForm?: boolean) => void;
    notify: (message: string) => void;
    onChange: (draft: Draft) => void;
}) {
    const [draft, setDraft] = useState<Draft>(initial), [busy, setBusy] = useState(''), [file, setFile] = useState<File | null>(null), [localImage, setLocalImage] = useState(''), [warning, setWarning] = useState(''), [aiReview, setAiReview] = useState(false);
    const [generated, setGenerated] = useState<{draft: Draft; file: File | null} | null>(null), [generatedImage, setGeneratedImage] = useState('');
    useEffect(() => { if (!generated?.file) { setGeneratedImage(''); return; } const url = URL.createObjectURL(generated.file); setGeneratedImage(url); return () => URL.revokeObjectURL(url); }, [generated?.file]);
    const {token:githubToken}=useStoreConnection();
    const [reader,setReader]=useState('auto'),[directURL,setDirectURL]=useState('');
    const input = useRef<HTMLInputElement>(null);
    const previewPanel = useRef<HTMLElement>(null);
    const current = useRef(draft);
    current.current = draft;
    useEffect(() => { setDraft({...initial,message:removeAffiliateDisclosure(initial.message),affiliate_disclosure:false}); setFile(null); setLocalImage(''); setWarning(''); setDirectURL(''); setGenerated(null); setAiReview(Boolean(initial.uncertainties.length)); }, [initial]);
    useEffect(() => { onChange(draft); }, [draft, onChange]);
    useEffect(() => () => { if (localImage)
        URL.revokeObjectURL(localImage); }, [localImage]);
    const update = (patch: Partial<Draft>) => setDraft(o => ({ ...o, ...patch }));
    const perform = async (label: string, fn: () => Promise<void>) => { setBusy(label); try {
        await fn();
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy('');
    } };
    const readFile = async (f: File) => { if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
        throw Error('Envie uma imagem JPG, PNG ou WebP.'); if (f.size > 5000000)
        throw Error('A imagem deve ter até 5 MB.'); const url = URL.createObjectURL(f); try {
        await new Promise<void>((resolve, reject) => { const img = new window.Image(); img.onload = () => img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth * img.naturalHeight <= 40000000 ? resolve() : reject(Error('Imagem muito grande. Use uma foto com até 40 megapixels.')); img.onerror = () => reject(Error('O arquivo não é uma imagem válida.')); img.src = url; });
        setFile(f);
        setLocalImage(url);
        update({ image_url: '', image_path: null, signed_image_url: '' });
        notify('Imagem selecionada. Será enviada ao salvar a oferta.');
    }
    catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    } };
    async function extract() { if (!draft.affiliate_url.trim())
        throw Error('Cole o link do produto primeiro.'); const original = draft.affiliate_url; const data = reader==='github'?await extractViaActions(githubToken,original,setBusy,directURL.trim()||undefined):await api('extract', body({ url: original,provider:reader,...(jinaKey?{jina_key:jinaKey}:{}) })); if (current.current.affiliate_url !== original)
        return; setDraft(o => ({ ...o, name: o.name || data.name, description: o.description || data.description, image_url: file || o.image_url || o.image_path ? o.image_url : data.image_url, price: o.price ?? data.price, previous_price:o.previous_price ?? data.previous_price, brand: o.brand || data.brand, store: data.store, specs: o.specs.length ? o.specs : data.specs, category: categories.includes(data.category) ? data.category : o.category })); setWarning(data.warning); notify(data.partial ? 'Extração parcial. Complete os dados e confira o produto.' : 'Dados encontrados. Revise antes de divulgar.'); }
    async function ai(regenerate = false) { if (!config?.ai)
        throw Error('A integração de IA ainda precisa ser configurada. Veja Configurações.'); if (!config?.user)
        throw Error('Entre na sua conta para usar a IA.'); let image_data: string | undefined; if (file)
        image_data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(Error('Não foi possível ler a imagem.')); r.readAsDataURL(file); }); const data = await api('ai', body({ name: draft.name, description: draft.description, brand: draft.brand, specs: draft.specs, image_path: draft.image_path, image_url: draft.image_url || undefined, image_data })); setDraft(o => ({ ...o, ...(!regenerate ? { name: data.name || o.name, brand: data.brand || o.brand, category: data.category, specs: data.specs } : {}), description: data.description, keywords: data.keywords, uncertainties: data.uncertainties, status: 'review' })); setAiReview(true); notify('Sugestões da IA prontas. Confira e confirme as informações.'); }
    async function save(target: Draft = draft, targetFile: File | null = file, keepForm = false) {
        if (!config?.database || !config.user)
            throw Error('Conecte o Supabase e entre na conta para salvar no banco. O rascunho permanece nesta tela.');
        let prepared = { ...target };
        let uploaded: string | undefined;
        if (targetFile) {
            const image = await api('images', { method: 'POST', headers: { 'Content-Type': targetFile.type }, body: targetFile });
            prepared = { ...prepared, image_path: image.path, image_url: '', signed_image_url: image.url };
            uploaded = image.path;
            if (!keepForm) { update({ image_path: image.path, signed_image_url: image.url }); setFile(null); setLocalImage(''); }
        }
        try {
            const { id, signed_image_url, user_id, created_at, updated_at, ...data } = prepared as Draft & Partial<Offer>;
            const parsed = offerSchema.parse({ ...data, message: data.message || generateMessage(data) });
            const result = await api<{
                offer: Offer;
                cleanup_pending?: number;
            }>(id ? 'offers/' + id : 'offers', { ...body(parsed), method: id ? 'PATCH' : 'POST' });
            if (keepForm) setGenerated({draft: result.offer, file: null}); else setDraft(result.offer);
            onSaved(result.offer, keepForm);
            notify(result.cleanup_pending ? 'Alterações salvas. Limpeza da imagem antiga pendente.' : 'Oferta salva com sucesso no banco.');
        }
        catch (e) {
            if (uploaded) {
                if (!keepForm) { setFile(targetFile); if (targetFile) setLocalImage(URL.createObjectURL(targetFile)); update({ image_path: null, signed_image_url: '' }); }
                await api('images/release', body({ path: uploaded })).catch(() => { });
            }
            throw e;
        }
    }
    function generateAndClear() {
        if (!draft.name.trim() || !draft.affiliate_url.trim()) { notify('Informe o nome e o link do produto antes de gerar.'); return; }
        setGenerated({draft: {...draft, message: generateMessage(draft)}, file});
        setDraft(emptyOffer()); setDirectURL(''); setFile(null); setLocalImage(''); setWarning(''); setAiReview(false);
        requestAnimationFrame(() => previewPanel.current?.scrollIntoView({behavior: 'smooth', block: 'start'}));
        notify('Mensagem gerada. Campos limpos para o próximo produto; a foto e a oferta continuam na prévia.');
    }
    const previewDraft = generated?.draft || draft;
    const preview = removeAffiliateDisclosure(previewDraft.message || generateMessage(previewDraft));
    const previewSource = generated ? generatedImage || generated.draft.signed_image_url || generated.draft.image_url : localImage || draft.signed_image_url || draft.image_url;
    const source = localImage || draft.signed_image_url || draft.image_url;
    return <div className="editor-grid"><section className="panel"><div className="section-head"><div><h2>{draft.id ? 'Editar oferta' : 'Dados do produto'}</h2><p>Complete, confira e prepare a divulgação.</p></div><span className="pill">REVISÃO MANUAL</span></div><label>Método de leitura<select value={reader} onChange={e=>setReader(e.target.value)}><option value="auto">Automático · leitura direta + Jina</option><option value="direct">Somente leitura direta</option><option value="github">GitHub Actions · extrator próprio</option><option value="jina">Jina Reader · gratuito com limites</option></select></label><p className="hint">GitHub Actions pode levar alguns minutos e precisa da conexão em Minha loja. Jina e GitHub recebem somente o link público; não utilizam sua sessão da loja.</p><label>Link original de afiliado<div className="input-action"><input type="url" value={draft.affiliate_url} onChange={e => {setDirectURL('');update({ affiliate_url: e.target.value });}} placeholder="https://loja.com/produto"/><Button disabled={!!busy} onClick={() => perform('Buscando dados', extract)} variant="secondary"><Link2 size={16}/><span>Buscar</span></Button></div></label>{reader==='github'&&<label>Endereço direto do mesmo produto (opcional)<input type="url" value={directURL} onChange={e=>setDirectURL(e.target.value)} placeholder="Use se o link curto não abrir pelo GitHub"/><small>O link de afiliado acima continua sendo o link da oferta.</small></label>}{warning && <div className="notice warning" role="alert">{warning}</div>}<div className="image-editor"><ProductImage src={source} name={draft.name || 'Prévia do produto'}/><div><strong>Imagem do produto</strong><p>JPG, PNG ou WebP · até 5 MB</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f)
        perform('Lendo imagem', () => readFile(f)); e.target.value = ''; }}/><div className="action-row"><Button disabled={!!busy} onClick={() => input.current?.click()} variant="secondary"><ImagePlus size={16}/>{source ? 'Substituir imagem' : 'Adicionar imagem do produto'}</Button>{source && <Button disabled={!!busy} variant="danger subtle" onClick={() => { setFile(null); setLocalImage(''); update({ image_path: null, image_url: '', signed_image_url: '' }); }}><Trash2 size={16}/>Remover</Button>}</div></div></div><div className="ai-actions"><Button disabled={!!busy || !config?.ai} variant="ai" onClick={() => perform('Analisando com IA', () => ai())}><Sparkles size={16}/>Gerar com IA</Button><Button disabled={!!busy || !config?.ai} variant="ghost" onClick={() => perform('Regenerando descrição', () => ai(true))}><RefreshCw size={15}/>Regenerar descrição</Button></div>{!config?.ai && <p className="hint">A análise de imagens será habilitada após configurar a integração OpenAI.</p>}<label>Nome do produto<input value={draft.name} onChange={e => update({ name: e.target.value })} maxLength={180} placeholder="Ex.: Teclado mecânico para PC"/></label><label>Descrição breve<textarea value={draft.description} onChange={e => update({ description: e.target.value })} maxLength={700} rows={3} placeholder="Descreva somente características confirmadas."/></label><div className="form-grid"><label>Preço atual (R$)<input type="number" min="0.01" step="0.01" value={draft.price ?? ''} onChange={e => update({ price: e.target.value ? Number(e.target.value) : null })} placeholder="Não confirmado"/></label><label>Preço anterior (R$)<input type="number" min="0.01" step="0.01" value={draft.previous_price ?? ''} onChange={e => update({ previous_price: e.target.value ? Number(e.target.value) : null })} placeholder="Opcional"/></label><label>Categoria<select value={draft.category} onChange={e => update({ category: e.target.value as OfferInput['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Marca<input value={draft.brand} onChange={e => update({ brand: e.target.value })} maxLength={100} placeholder="Somente se confirmada"/></label></div><label>Palavras-chave comerciais<input value={draft.keywords.join(", ")} onChange={e => update({ keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean).slice(0, 10) })} placeholder="Ex.: PC, informática, upgrade"/></label><label>Características confirmadas (uma por linha)<textarea value={draft.specs.join('\n')} onChange={e => update({ specs: e.target.value.split('\n').slice(0, 20) })} rows={2}/></label>{draft.uncertainties.length > 0 && <div className="notice warning"><strong>Confirme antes de divulgar</strong><ul>{draft.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}{aiReview && <label className="check-label"><input type="checkbox" checked={!draft.uncertainties.length && !aiReview} onChange={e => { if (e.target.checked) {
        update({ uncertainties: [] });
        setAiReview(false);
    } }}/>Revisei e corrigi as sugestões da IA.</label>}<div className="form-grid"><label>Status<select value={draft.status} onChange={e => update({ status: e.target.value as OfferInput['status'] })}><option value="review">Aguardando revisão</option><option value="ready" disabled={draft.uncertainties.length > 0 || aiReview}>Pronta</option><option value="shared" disabled={aiReview}>Compartilhada</option></select></label><label>Estilo da mensagem<select value={draft.style} onChange={e => update({ style: e.target.value as Style })}><option value="simple">Simples</option><option value="professional">Profissional</option><option value="promotional">Promocional</option></select></label></div><div className="action-row"><Button disabled={!!busy} onClick={generateAndClear} variant="secondary"><Sparkles size={16}/>Gerar mensagem</Button><Button disabled={!!busy || !config?.user} onClick={() => perform('Salvando oferta', () => save())} variant="primary"><Save size={16}/>{draft.id ? 'Salvar alterações' : 'Salvar oferta'}</Button></div>{busy && <p role="status"><Busy>{busy}…</Busy></p>}{!config?.user && <p className="hint">Rascunho não salvo: entre na sua conta em Configurações para guardar esta oferta.</p>}</section><aside ref={previewPanel} className="preview-panel"><div className="section-head"><h2>Prévia da oferta</h2><span className="live-dot">WhatsApp</span></div><div className="whatsapp-preview"><ProductImage src={previewSource} name={previewDraft.name || 'Produto'}/><div className="message-bubble"><p>{preview}</p><span>Prévia · você confirma o envio</span></div></div><label>Editar mensagem<textarea value={previewDraft.message} onChange={e => generated ? setGenerated({...generated, draft: {...generated.draft, message: e.target.value}}) : update({ message: e.target.value })} rows={8} maxLength={6000} placeholder="A prévia usa o modelo automático. Digite aqui para personalizar."/></label><div className="action-row"><Button disabled={!!busy} onClick={() => perform('Copiando', async () => { await copyText(preview); notify('Oferta copiada. Cole no seu grupo.'); })} variant="secondary"><Copy size={16}/>Copiar oferta</Button><PublishStore offer={previewDraft} file={generated ? generated.file : file} notify={notify}/><ShareOffer image={previewDraft} file={generated ? generated.file : file} message={preview} notify={notify} disabled={!previewDraft.name||!!busy}/>{generated && <Button disabled={!!busy || !config?.user} onClick={() => perform('Salvando oferta gerada', () => save(generated.draft, generated.file, true))} variant="primary"><Save size={16}/>{generated.draft.id ? 'Salvar alterações da oferta' : 'Salvar oferta gerada'}</Button>}</div><p className="hint">Escolha seu grupo e confirme o envio no WhatsApp. A imagem e a legenda dependem do compartilhamento disponível no seu Android.</p></aside></div>;
}

