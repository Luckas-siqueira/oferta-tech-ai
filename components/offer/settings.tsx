'use client';
import {Account} from './account';
import { useState } from 'react';
import { Database, Sparkles, ShieldCheck, Download, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, body, type Config } from '@/lib/client';
import { Button, Busy } from './ui';
export function Settings({ config, reload, notify, install, recovery, onRecovered, jinaKey, onJinaKey }: {
    jinaKey: string;
    onJinaKey: (key: string) => void;
    config: Config | null;
    recovery?: boolean;
    onRecovered: () => void;
    reload: () => Promise<void>;
    notify: (s: string) => void;
    install: () => void;
}) { const [keyInput,setKeyInput]=useState(''); const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false); async function auth(signup = false) { setBusy(true); try {
    const data = await api('auth/' + (signup ? 'signup' : 'login'), body({ email, password }));
    setPassword('');
    notify(data.confirmation_required ? 'Confira seu e-mail e confirme o cadastro antes de entrar.' : 'Você entrou na conta.');
    await reload();
}
catch (e) {
    notify((e as Error).message);
}
finally {
    setBusy(false);
} } return <div className="settings-grid"><section className="panel"><div className="section-head"><h2>Conexões do aplicativo</h2><ShieldCheck size={22}/></div><div className="connection"><div className="connection-icon"><Database size={22}/></div><div><strong>Supabase</strong><p>Banco PostgreSQL, conta e imagens privadas</p></div><span className={'status ' + (config?.database ? 'ready' : 'review')}>{config?.database ? 'Configurado' : 'Pendente'}</span></div><div className="connection"><div className="connection-icon"><Sparkles size={22}/></div><div><strong>Inteligência artificial</strong><p>Análise multimodal de produtos</p></div><span className={'status ' + (config?.ai ? 'ready' : 'review')}>{config?.ai ? 'Configurada' : 'Pendente'}</span></div>{(!config?.database || !config?.ai) && <div className="notice warning"><strong>Configuração necessária</strong><p>O aplicativo só mostrará dados salvos e resultados de IA quando os serviços estiverem configurados. Chaves privadas ficam no servidor.</p><ol><li>Conectar Supabase e criar um projeto.</li><li>Executar a migração SQL incluída no projeto.</li><li>Configurar SUPABASE_URL e SUPABASE_ANON_KEY no servidor.</li><li>Configurar OPENAI_API_KEY para habilitar a IA.</li></ol></div>}<div className="notice"><strong>Limites de uso</strong><p>20 análises de IA por usuário/dia (UTC) e 30 extrações por minuto. Tentativas enviadas à IA contam no limite, mesmo se o provedor falhar.</p></div><h3>Lojas com leitura de metadados</h3><div className="store-tags">{config?.stores.map(s => <span key={s}>{s}</span>)}</div><p className="hint">A leitura depende de dados públicos e pode ser bloqueada pela loja. APIs oficiais precisam de credenciais específicas e não estão ativadas nesta versão.</p></section><section className="panel"><h2>Jina Reader · chave própria</h2><p>Copie sua chave no site do Jina e cole neste campo. Ela será usada na leitura de produtos.</p><label>Chave da sua conta Jina<input type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Cole a chave aqui"/></label><div className="action-row"><Button variant="primary" disabled={!keyInput.trim()} onClick={()=>{const key=keyInput.trim();if(!/^[A-Za-z0-9_.-]{20,1000}$/.test(key)){notify('Cole somente o valor da chave, sem o comando curl ou Bearer.');return;}onJinaKey(key);setKeyInput('');notify('Chave carregada para esta sessão. Abra Nova oferta e selecione Jina Reader.');}}>Usar chave nesta sessão</Button><Button variant="ghost" disabled={!jinaKey} onClick={()=>{onJinaKey('');setKeyInput('');notify('Chave removida da sessão.');}}>Remover chave</Button></div><p className="hint">{jinaKey?'Chave própria carregada.':'Nenhuma chave própria carregada.'} A chave não é salva no navegador, banco ou GitHub. Recarregar ou fechar a aba remove a chave. O uso consome o saldo de tokens da sua conta Jina.</p></section><section className="panel"><h2>Sua conta</h2>{config?.user && !recovery ? <><p>Conectado como <strong>{config.user.email}</strong></p><Button variant="secondary" onClick={async () => { try {
    await api('auth/logout', { method: 'POST' });
    await reload();
    notify('Você saiu da conta.');
}
catch (e) {
    notify((e as Error).message);
} }}><LogOut size={16}/>Sair</Button><Button variant="ghost full" onClick={async () => { try {
    const result = await api('images/cleanup', { method: 'POST' });
    notify(result.remaining ? 'Algumas imagens ainda não puderam ser removidas.' : 'Limpeza das imagens pendentes concluída.');
}
catch (e) {
    notify((e as Error).message);
} }}>Limpar arquivos pendentes</Button></> : <Account configured={Boolean(config?.database)} reload={reload} notify={notify} recovery={recovery} onRecovered={onRecovered}/>}<div className="settings-install"><div className="connection-icon"><Download size={24}/></div><h3>Seu aplicativo no Android</h3><p>Abra no Chrome e use “Adicionar à tela inicial” ou “Instalar aplicativo”.</p><Button variant="secondary" onClick={install}><Download size={16}/>Instalar aplicativo</Button><p className="hint">A leitura de links, o banco e a IA precisam de internet.</p></div></section></div>; }

