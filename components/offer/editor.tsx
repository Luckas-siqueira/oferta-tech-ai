'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Link2, ImagePlus, Trash2, RefreshCw, Copy, Send, Save, Image as ImageIcon, Check } from 'lucide-react';
import { categories, emptyOffer, generateMessage, offerSchema, type Offer, type OfferInput, type Style } from '@/lib/shared/offer';
import { api, body, copyText, openWhatsApp, shareImage, type Config } from '@/lib/client';
import { Button, Busy, ProductImage } from './ui';
export type Draft = OfferInput & {
    id?: string;
    signed_image_url?: string;
};
export function Editor({ initial, config, onSaved, notify, onChange }: {
    initial: Draft;
    config: Config | null;
    onSaved: (offer: Offer) => void;
    notify: (message: string) => void;
    onChange: (draft: Draft) => void;
}) {
    const [draft, setDraft] = useState<Draft>(initial), [busy, setBusy] = useState(''), [file, setFile] = useState<File | null>(null), [localImage, setLocalImage] = useState(''), [warning, setWarning] = useState(''), [aiReview, setAiReview] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const current = useRef(draft);
    current.current = draft;
    useEffect(() => { setDraft(initial); setFile(null); setLocalImage(''); setWarning(''); setAiReview(Boolean(initial.uncertainties.length)); }, [initial]);
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
        throw Error('Cole o link do produto primeiro.'); const original = draft.affiliate_url; const data = await api('extract', body({ url: original })); if (current.current.affiliate_url !== original)
        return; setDraft(o => ({ ...o, name: o.name || data.name, description: o.description || data.description, image_url: file || o.image_url || o.image_path ? o.image_url : data.image_url, price: o.price ?? data.price, brand: o.brand || data.brand, store: data.store, specs: o.specs.length ? o.specs : data.specs, category: categories.includes(data.category) ? data.category : o.category })); setWarning(data.warning); notify(data.partial ? 'Extração parcial. Complete os dados e confira o produto.' : 'Dados encontrados. Revise antes de divulgar.'); }
    async function ai(regenerate = false) { if (!config?.ai)
        throw Error('A integração de IA ainda precisa ser configurada. Veja Configurações.'); if (!config?.user)
        throw Error('Entre na sua conta para usar a IA.'); let image_data: string | undefined; if (file)
        image_data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(Error('Não foi possível ler a imagem.')); r.readAsDataURL(file); }); const data = await api('ai', body({ name: draft.name, description: draft.description, brand: draft.brand, specs: draft.specs, image_path: draft.image_path, image_url: draft.image_url || undefined, image_data })); setDraft(o => ({ ...o, ...(!regenerate ? { name: data.name || o.name, brand: data.brand || o.brand, category: data.category, specs: data.specs } : {}), description: data.description, keywords: data.keywords, uncertainties: data.uncertainties, status: 'review' })); setAiReview(true); notify('Sugestões da IA prontas. Confira e confirme as informações.'); }
    async function save() {
        if (!config?.database || !config.user)
            throw Error('Conecte o Supabase e entre na conta para salvar no banco. O rascunho permanece nesta tela.');
        let prepared = { ...draft };
        let uploaded: string | undefined;
        if (file) {
            const image = await api('images', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
            prepared = { ...prepared, image_path: image.path, image_url: '', signed_image_url: image.url };
            uploaded = image.path;
            update({ image_path: image.path, signed_image_url: image.url });
            setFile(null);
            setLocalImage('');
        }
        try {
            const { id, signed_image_url, user_id, created_at, updated_at, ...data } = prepared as Draft & Partial<Offer>;
            const parsed = offerSchema.parse({ ...data, message: data.message || generateMessage(data) });
            const result = await api<{
                offer: Offer;
                cleanup_pending?: number;
            }>(id ? 'offers/' + id : 'offers', { ...body(parsed), method: id ? 'PATCH' : 'POST' });
            setDraft(result.offer);
            onSaved(result.offer);
            notify(result.cleanup_pending ? 'Alterações salvas. Limpeza da imagem antiga pendente.' : 'Oferta salva com sucesso no banco.');
        }
        catch (e) {
            if (uploaded) {
                setFile(file);
                if (file)
                    setLocalImage(URL.createObjectURL(file));
                update({ image_path: null, signed_image_url: '' });
                await api('images/release', body({ path: uploaded })).catch(() => { });
            }
            throw e;
        }
    }
    const preview = draft.message || generateMessage(draft);
    const source = localImage || draft.signed_image_url || draft.image_url;
    return <div className="editor-grid"><section className="panel"><div className="section-head"><div><h2>{draft.id ? 'Editar oferta' : 'Dados do produto'}</h2><p>Complete, confira e prepare a divulgação.</p></div><span className="pill">REVISÃO MANUAL</span></div><label>Link original de afiliado<div className="input-action"><input type="url" value={draft.affiliate_url} onChange={e => update({ affiliate_url: e.target.value })} placeholder="https://loja.com/produto"/><Button disabled={!!busy} onClick={() => perform('Buscando dados', extract)} variant="secondary"><Link2 size={16}/><span>Buscar</span></Button></div></label>{warning && <div className="notice warning" role="alert">{warning}</div>}<div className="image-editor"><ProductImage src={source} name={draft.name || 'Prévia do produto'}/><div><strong>Imagem do produto</strong><p>JPG, PNG ou WebP · até 5 MB</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f)
        perform('Lendo imagem', () => readFile(f)); e.target.value = ''; }}/><div className="action-row"><Button disabled={!!busy} onClick={() => input.current?.click()} variant="secondary"><ImagePlus size={16}/>{source ? 'Substituir imagem' : 'Adicionar imagem do produto'}</Button>{source && <Button disabled={!!busy} variant="danger subtle" onClick={() => { setFile(null); setLocalImage(''); update({ image_path: null, image_url: '', signed_image_url: '' }); }}><Trash2 size={16}/>Remover</Button>}</div></div></div><div className="ai-actions"><Button disabled={!!busy || !config?.ai} variant="ai" onClick={() => perform('Analisando com IA', () => ai())}><Sparkles size={16}/>Gerar com IA</Button><Button disabled={!!busy || !config?.ai} variant="ghost" onClick={() => perform('Regenerando descrição', () => ai(true))}><RefreshCw size={15}/>Regenerar descrição</Button></div>{!config?.ai && <p className="hint">A análise de imagens será habilitada após configurar a integração OpenAI.</p>}<label>Nome do produto<input value={draft.name} onChange={e => update({ name: e.target.value })} maxLength={180} placeholder="Ex.: Teclado mecânico para PC"/></label><label>Descrição breve<textarea value={draft.description} onChange={e => update({ description: e.target.value })} maxLength={700} rows={3} placeholder="Descreva somente características confirmadas."/></label><div className="form-grid"><label>Preço atual (R$)<input type="number" min="0.01" step="0.01" value={draft.price ?? ''} onChange={e => update({ price: e.target.value ? Number(e.target.value) : null })} placeholder="Não confirmado"/></label><label>Preço anterior (R$)<input type="number" min="0.01" step="0.01" value={draft.previous_price ?? ''} onChange={e => update({ previous_price: e.target.value ? Number(e.target.value) : null })} placeholder="Opcional"/></label><label>Categoria<select value={draft.category} onChange={e => update({ category: e.target.value as OfferInput['category'] })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Marca<input value={draft.brand} onChange={e => update({ brand: e.target.value })} maxLength={100} placeholder="Somente se confirmada"/></label></div><label>Palavras-chave comerciais<input value={draft.keywords.join(", ")} onChange={e => update({ keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean).slice(0, 10) })} placeholder="Ex.: PC, informática, upgrade"/></label><label>Características confirmadas (uma por linha)<textarea value={draft.specs.join('\n')} onChange={e => update({ specs: e.target.value.split('\n').slice(0, 20) })} rows={2}/></label>{draft.uncertainties.length > 0 && <div className="notice warning"><strong>Confirme antes de divulgar</strong><ul>{draft.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}{aiReview && <label className="check-label"><input type="checkbox" checked={!draft.uncertainties.length && !aiReview} onChange={e => { if (e.target.checked) {
        update({ uncertainties: [] });
        setAiReview(false);
    } }}/>Revisei e corrigi as sugestões da IA.</label>}<div className="form-grid"><label>Status<select value={draft.status} onChange={e => update({ status: e.target.value as OfferInput['status'] })}><option value="review">Aguardando revisão</option><option value="ready" disabled={draft.uncertainties.length > 0 || aiReview}>Pronta</option><option value="shared" disabled={aiReview}>Compartilhada</option></select></label><label>Estilo da mensagem<select value={draft.style} onChange={e => update({ style: e.target.value as Style })}><option value="simple">Simples</option><option value="professional">Profissional</option><option value="promotional">Promocional</option></select></label></div><label className="check-label"><input type="checkbox" checked={draft.affiliate_disclosure} onChange={e => update({ affiliate_disclosure: e.target.checked })}/>Identificar link de afiliado na mensagem</label><div className="action-row"><Button disabled={!!busy} onClick={() => { update({ message: generateMessage(draft) }); notify('Mensagem gerada. Confira a prévia.'); }} variant="secondary"><Sparkles size={16}/>Gerar mensagem</Button><Button disabled={!!busy || !config?.user} onClick={() => perform('Salvando oferta', save)} variant="primary"><Save size={16}/>{draft.id ? 'Salvar alterações' : 'Salvar oferta'}</Button></div>{busy && <p role="status"><Busy>{busy}…</Busy></p>}{!config?.user && <p className="hint">Rascunho não salvo: entre na sua conta em Configurações para guardar esta oferta.</p>}</section><aside className="preview-panel"><div className="section-head"><h2>Prévia da oferta</h2><span className="live-dot">WhatsApp</span></div><div className="whatsapp-preview"><ProductImage src={source} name={draft.name || 'Produto'}/><div className="message-bubble"><p>{preview}</p><span>Prévia · você confirma o envio</span></div></div><label>Editar mensagem<textarea value={draft.message} onChange={e => update({ message: e.target.value })} rows={8} maxLength={6000} placeholder="A prévia usa o modelo automático. Digite aqui para personalizar."/></label><div className="action-row"><Button disabled={!!busy} onClick={() => perform('Copiando', async () => { await copyText(preview); notify('Oferta copiada. Cole no seu grupo.'); })} variant="secondary"><Copy size={16}/>Copiar oferta</Button><Button disabled={!draft.name || !!busy} onClick={() => { try {
        openWhatsApp(preview);
    }
    catch (e) {
        notify((e as Error).message);
    } }} variant="whatsapp"><Send size={16}/>WhatsApp</Button></div><Button disabled={!source || !!busy} variant="ghost full" onClick={() => perform('Preparando imagem', async () => { let blob: Blob; if (file)
        blob = file;
    else if (draft.image_path && draft.signed_image_url) {
        const r = await fetch(draft.signed_image_url);
        if (!r.ok)
            throw Error('A imagem expirou. Atualize o histórico.');
        blob = await r.blob();
    }
    else {
        const r = await fetch('/api/image?url=' + encodeURIComponent(draft.image_url));
        if (!r.ok)
            throw Error('Entre na conta e tente novamente, ou use uma imagem da galeria.');
        blob = await r.blob();
    } notify(await shareImage(blob, preview)); })}><ImageIcon size={16}/>Compartilhar imagem + texto</Button><p className="hint">Escolha seu grupo e confirme o envio no WhatsApp. A imagem e a legenda dependem do compartilhamento disponível no seu Android.</p></aside></div>;
}

