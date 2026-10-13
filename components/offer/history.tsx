'use client';
import { useMemo, useState } from 'react';
import { Trash2, Eye, Pencil, Copy, Send, Search, Image as ImageIcon, Check } from 'lucide-react';
import { categories, currency, statusLabel, imageSource, type Offer } from '@/lib/shared/offer';
import { copyText, openWhatsApp, offerImage, shareImage } from '@/lib/client';
import { Button, Modal, Empty, ProductImage } from './ui';
import {ShareOffer} from './share';
export function History({ offers, onEdit, onDelete, onMarkShared, notify }: {
    offers: Offer[];
    onEdit: (o: Offer) => void;
    onDelete: (ids: string[]) => Promise<void>;
    onMarkShared: (o: Offer) => Promise<void>;
    notify: (s: string) => void;
}) {
    const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all'), [sort, setSort] = useState('desc'), [selected, setSelected] = useState<Set<string>>(new Set()), [remove, setRemove] = useState<string[] | null>(null), [busy, setBusy] = useState(false), [view, setView] = useState<Offer | null>(null);
    const visible = useMemo(() => offers.filter(o => o.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) && (category === 'all' || category === o.category) && (status === 'all' || status === o.status)).sort((a, b) => sort === 'desc' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)), [offers, query, category, status, sort]);
    const chosen = offers.filter(o => selected.has(o.id)).map(o => o.id);
    const allSelected = visible.length > 0 && visible.every(o => selected.has(o.id));
    const run = async (fn: () => Promise<void>) => { try {
        await fn();
    }
    catch (e) {
        if ((e as Error).name !== 'AbortError')
            notify((e as Error).message);
    } };
    return <section className="panel history-panel"><div className="section-head"><div><h2>Minhas ofertas</h2><p>{offers.length} registro(s) carregado(s) do banco</p></div><span className="pill">HISTÓRICO</span></div><div className="filters"><label className="search-field"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar produto" aria-label="Pesquisar produto"/></label><select aria-label="Categoria" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os status</option><option value="review">Aguardando revisão</option><option value="ready">Pronta</option><option value="shared">Compartilhada</option></select><select aria-label="Ordenar por data" value={sort} onChange={e => setSort(e.target.value)}><option value="desc">Mais recentes</option><option value="asc">Mais antigas</option></select></div>{chosen.length > 0 && <div className="selection-bar"><span>{chosen.length} selecionada(s)</span><Button variant="ghost" onClick={() => setSelected(new Set())}>Desmarcar</Button><Button variant="danger" onClick={() => setRemove(chosen)}><Trash2 size={15}/>Excluir selecionadas</Button></div>}{!visible.length ? <Empty title={offers.length ? 'Nenhum resultado' : 'Seu histórico começa aqui'}>{offers.length ? 'Altere a pesquisa ou os filtros.' : 'Salve sua primeira oferta para encontrá-la aqui, mesmo depois de fechar o aplicativo.'}</Empty> : <div className="table-scroll" tabIndex={0} role="region" aria-label="Histórico de ofertas"><table><thead><tr><th><input type="checkbox" aria-label="Selecionar todas as ofertas exibidas" checked={allSelected} onChange={e => { if (e.target.checked && visible.length > 100) {
        notify('Selecione até 100 ofertas por exclusão. Refine os filtros.');
        return;
    } setSelected(old => { const n = new Set(old); for (const o of visible)
        e.target.checked ? n.add(o.id) : n.delete(o.id); return n; }); }}/></th><th>Produto</th><th>Preço</th><th>Categoria</th><th>Cadastro</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map(o => <tr key={o.id}><td><input type="checkbox" aria-label={'Selecionar ' + o.name} checked={selected.has(o.id)} onChange={e => { if (e.target.checked && chosen.length >= 100) {
        notify('Limite de 100 ofertas por exclusão.');
        return;
    } setSelected(old => { const n = new Set(old); e.target.checked ? n.add(o.id) : n.delete(o.id); return n; }); }}/></td><td><div className="table-product"><ProductImage src={imageSource(o)} name={o.name}/><div><strong>{o.name}</strong><small>{o.store || new URL(o.affiliate_url).hostname}</small></div></div></td><td className="price">{o.price !== null ? currency(o.price) : 'Não informado'}</td><td>{o.category}</td><td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td><td><span className={'status ' + o.status}>{statusLabel[o.status]}</span></td><td><div className="table-actions"><button title="Visualizar" aria-label={'Visualizar ' + o.name} onClick={() => setView(o)}><Eye size={16}/></button><button title="Editar" aria-label={'Editar ' + o.name} onClick={() => onEdit(o)}><Pencil size={16}/></button><button title="Copiar" aria-label={'Copiar ' + o.name} onClick={() => run(async () => { await copyText(o.message); notify('Oferta copiada.'); })}><Copy size={16}/></button><ShareOffer image={o} message={o.message} notify={notify} compact/><button className="delete" title="Excluir" aria-label={'Excluir ' + o.name} onClick={() => setRemove([o.id])}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>}<p className="hint">No celular, deslize a tabela para ver as ações. Compartilhar abre o WhatsApp; você confirma o envio.</p>{remove && <Modal title={remove.length === 1 ? 'Excluir oferta' : `Excluir ${remove.length} ofertas selecionadas?`} onClose={() => { if (!busy)
        setRemove(null); }}><p>Tem certeza de que deseja excluir esta oferta? Esta ação não poderá ser desfeita.</p>{remove.length > 1 && <p>Somente as {remove.length} ofertas selecionadas serão excluídas.</p>}<div className="action-row"><Button disabled={busy} onClick={() => setRemove(null)}>Cancelar</Button><Button disabled={busy} variant="danger" onClick={async () => { setBusy(true); try {
        await onDelete(remove);
        setSelected(old => new Set([...old].filter(id => !remove.includes(id))));
        setRemove(null);
    }
    catch (e) {
        notify((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><Trash2 size={16}/>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</Button></div></Modal>}{view && <Modal title={view.name} onClose={() => setView(null)}><ProductImage src={imageSource(view)} name={view.name} className="view-image"/><p>{view.description}</p><p className="price">{view.price !== null ? currency(view.price) : 'Preço não informado'}</p><div className="message-preview">{view.message}</div><div className="action-row"><Button variant="secondary" onClick={() => { setView(null); onEdit(view); }}><Pencil size={16}/>Editar</Button><ShareOffer image={view} message={view.message} notify={notify}/></div>{view.status !== 'shared' && <Button variant="ghost full" onClick={() => run(async () => { await onMarkShared(view); setView({ ...view, status: 'shared' }); })}><Check size={16}/>Já enviei: marcar compartilhada</Button>}</Modal>}</section>;
}

