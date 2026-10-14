# Oferta Tech AI

Aplicativo web semiautomático para preparar ofertas de eletrônicos e informática para WhatsApp. React 19, TypeScript, Tailwind CSS, rotas de API em TypeScript, Supabase PostgreSQL/Auth/Storage e OpenAI Responses multimodal.

**Não há produtos fictícios, preços inventados ou resultados de IA simulados.** Sem configuração de Supabase, o aplicativo prepara rascunhos na tela, mas não salva ofertas nem mostra contagens falsas. Sem OPENAI_API_KEY, os botões de IA ficam indisponíveis.

## Funcionalidades

- Dashboard com contagens exatas consultadas no banco.
- Formulário editável, metadados públicos Open Graph/JSON-LD e preservação do link de afiliado original.
- Seleção de imagens JPG, PNG e WebP pela galeria; prévia, substituição e remoção. Limite 5 MB; a imagem é enviada ao salvar e armazenada em bucket privado.
- Análise multimodal de imagem e texto por integração real com a OpenAI. Saída estruturada e validada; incertezas exigem revisão.
- Mensagens simples, profissionais e promocionais. Preço e desconto aparecem somente se informados/confirmados; preço extraído só é aceito em BRL.
- Texto personalizado e cópia. O botão principal prepara a foto e abre o compartilhamento nativo do Android para seleção do WhatsApp e do grupo. Compartilhamento de arquivo + texto quando o navegador suporta; alternativa de baixar a foto e copiar o texto.
- Processamento de até 50 links por lote, duas leituras simultâneas, resultados individuais, duplicados, retomada e nova tentativa de falhas. Cada produto precisa de revisão e salvamento explícito.
- Histórico, busca, filtros, ordenação, edição, exclusão individual ou de até 100 ofertas selecionadas. A tela só remove registros após confirmação do servidor.
- Exclusão transacional por usuário, preservação de imagens compartilhadas e fila de limpeza quando o armazenamento falha.
- PWA com ícones, manifest e tela offline; não armazena respostas administrativas ou imagens privadas em cache do service worker.

## Arquitetura e hospedagem

O código usa a estrutura App Router do Next.js. O projeto disponibiliza duas formas de execução:

1. **Hospedagem desta entrega:** Sites com o adaptador Vinext do ambiente, em Cloudflare Workers. O runtime publicado é Workers, **não um processo Node.js permanente**. A integração mantida `sites()` foi preservada.
2. **Hospedagem Node.js:** `npm run build:node` e `npm run start:node` usam Next.js. O backend TypeScript usa APIs HTTP padronizadas, sem conexões TCP, e é compatível com a estrutura de rotas do Next.js. Essa variante compilou com sucesso; não foi implantada nem verificada ponta a ponta nesta entrega.

O acesso ao Site privado exige entrada no ChatGPT. O banco utiliza uma conta Supabase separada, com senha e cookies HttpOnly. É possível preparar um rascunho e buscar metadados no Site privado enquanto o banco não está configurado. Fora de Sites, a extração exige autenticação Supabase.

## Estrutura principal

```text
app/
  api/[...path]/route.ts   APIs, autenticação, CRUD, imagens e IA
  page.tsx                Entrada do aplicativo
  layout.tsx              Metadados e PWA
  globals.css             Tailwind e interface responsiva
components/offer/
  app.tsx                 Navegação e dashboard
  editor.tsx              Cadastro, edição e prévia
  history.tsx             Histórico e exclusão
  batch.tsx               Processamento em lote
  settings.tsx            Conta, conexões e instalação
  ui.tsx                  Componentes reutilizáveis
lib/
  client.ts               Cliente HTTP e compartilhamento
  shared/offer.ts         Tipos, validações e mensagens
  server/extraction.ts    Extração, URLs e imagens
  server/supabase.ts      Autenticação e acesso HTTP ao banco
  server/ai.ts            OpenAI multimodal e saída estruturada
supabase/migrations/001_initial.sql
public/                   Ícones, PWA e tela offline
scripts/run-tests.mjs
tests/                    Testes de lógica e APIs com respostas controladas
.env.example
```

## Configurar pelo celular

1. Crie/conecte seu projeto Supabase. No **SQL Editor**, execute os arquivos de `supabase/migrations/` em ordem, uma única vez. O projeto conectado nesta entrega já recebeu essas migrações. A migração cria tabelas, funções, políticas RLS e o bucket privado `offer-images`.
2. Em Supabase, habilite autenticação por e-mail/senha. Cadastros com confirmação por e-mail devem ser confirmados antes do primeiro login. Em Authentication → URL Configuration, defina Site URL como `https://oferta-tech-ai.openluck9.chatgpt.site` (ou a URL da sua implantação).
3. Configure no servidor as variáveis listadas em `.env.example`:

| Variável | Uso | Exposição |
|---|---|---|
| `SUPABASE_URL` | URL do projeto Supabase | Somente no servidor neste app |
| `SUPABASE_ANON_KEY` | Chave pública/anon do projeto | Mantida no servidor; RLS continua obrigatório |
| `OPENAI_API_KEY` | Chave privada da API OpenAI | Segredo do servidor |
| `OPENAI_MODEL` | Modelo multimodal com Structured Outputs; padrão `gpt-4.1-mini` | Configuração do servidor |

**Não use a chave `service_role`**: todas as operações de ofertas usam o JWT do usuário e RLS. Não coloque chaves em arquivos públicos, commits, variáveis `NEXT_PUBLIC_` ou mensagens públicas. A assinatura ChatGPT não configura nem paga o consumo desta API automaticamente.

4. Republique para aplicar as variáveis no runtime. No aplicativo, abra **Configurações**, crie sua conta e entre.
5. Crie um rascunho em **Nova oferta**. Cole o link e use **Buscar**. Se a loja bloquear a leitura, complete o formulário e selecione uma foto da galeria.
6. Use **Gerar com IA**, revise as sugestões e confirme os dados. Informe preços confirmados e gere a mensagem.
7. Salve no banco. Use **WhatsApp** e escolha seu grupo. O envio é sempre confirmado por você. Marque como compartilhada somente depois de ter enviado.

## Instalação Android

Abra a URL HTTPS no Chrome. No menu ⋮, escolha **Adicionar à tela inicial** ou **Instalar aplicativo**. O botão de instalação nas Configurações também abre o prompt quando o navegador o disponibiliza. A extração, o banco e a IA precisam de internet.

## Desenvolvimento

Node >= 22.13.0. O projeto usa `pnpm-lock.yaml`.

```sh
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run typecheck
pnpm test
pnpm dev:node
```

Para servidor Node:

```sh
pnpm build:node
pnpm start:node
```

Para a hospedagem gerenciada da entrega, use os helpers Sites já configurados. `pnpm build` produz o bundle Vinext/Workers. O manifesto `.openai/hosting.json` identifica esse Site específico; não reutilize sua identidade ao criar outro projeto.

## Segurança e limites

- Cookies Secure em HTTPS, HttpOnly e SameSite=Lax; tokens não são enviados ao JavaScript do navegador.
- Validação de sessão no Supabase Auth e de origem nas mutações.
- RLS por usuário em ofertas, registro de imagens e fila de limpeza.
- Extração somente em domínios de lojas/CDNs aprovadas. Sem fetch de IPs, localhost, protocolos alternativos, credenciais embutidas ou portas arbitrárias. Cada redirecionamento é validado novamente. Não há tentativa de contornar bloqueios, CAPTCHA ou login.
- Metadados e conteúdo da imagem são tratados como dados, não instruções para a IA.
- API e Storage validam tamanho e assinatura do arquivo. A prévia verifica que a imagem é decodificável no navegador.
- Quota atômica PostgreSQL: 20 chamadas de IA por usuário/dia UTC e 30 extrações/minuto. Tentativas de IA contam mesmo se a resposta do provedor falhar; configure também orçamento no provedor. Para campanhas de grande volume, acrescente controles globais do projeto, monitoramento e limpeza periódica de usage_limits.
- Imagens substituídas/removidas de registros salvos são liberadas após salvar. Fotos do rascunho são mantidas só na memória até o upload. Uploads interrompidos podem deixar ativos sem oferta; planeje limpeza periódica desses ativos antigos após ativar o ambiente.
- Imagens são privadas; o app fornece URLs assinadas com validade de uma hora. Recarregue o histórico se uma foto expirar.

## Limitações declaradas

- APIs oficiais de lojas não estão integradas nesta versão porque exigem credenciais específicas. A extração atual usa metadados HTML públicos. Algumas lojas bloqueiam essas leituras, especialmente links curtos ou páginas renderizadas somente com JavaScript.
- Preço anterior é preenchido manualmente: não é inferido de `highPrice` de uma faixa de ofertas. O usuário confirma o desconto ao preencher ambos os preços.
- A IA só funciona com chave de API válida e saldo. A identificação por foto pode ser incerta; não existe garantia de leitura de modelo, marca ou especificações.
- A lista do histórico carrega os 1.000 itens mais recentes; o dashboard conta todos os registros no banco. Não há paginação além disso nesta primeira versão.
- A instalação e o comportamento de compartilhar arquivos dependem do navegador Android. A foto é preparada antes de um segundo toque no botão de compartilhamento para preservar a ativação do navegador; o app oferece alternativas de download e cópia.
- GitHub: código publicado em https://github.com/Luckas-siqueira/oferta-tech-ai. Nenhuma credencial real é incluída no repositório.
- Estado dos testes e integrações: leia `docs/VALIDACAO.md`. Não considerar banco, IA ou envio real testados enquanto os serviços não estiverem configurados.

## Fontes das integrações

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/resources/responses/methods/create

## Painel da Mega Vitrine

O painel antigo da loja redireciona para este aplicativo. Em Minha loja, conecte um token GitHub de expiração curta, somente para Luckas-siqueira/Mega-Vitrine e Contents: Read and write. Ele fica apenas na memória da aba e é enviado diretamente à API GitHub. Carregue o catálogo para editar ou excluir um produto; Nova oferta e a prévia permitem publicar novos produtos. Foto e catálogo são enviados em um commit atômico, sem force push. Mudanças concorrentes são rejeitadas. A publicação no GitHub Pages pode levar alguns minutos. Exclusões do catálogo não apagam imagens antigas nem ofertas no Supabase.

## Leitura alternativa com Jina Reader

Nova oferta oferece Automático, Somente leitura direta e Jina Reader. Automático tenta metadados públicos e usa o Jina em caso de dados incompletos. O backend chama r.jina.ai sem chave, com limite de tempo e resposta; o serviço recebe o link público. O link de afiliado permanece inalterado no cadastro. Páginas de login são recusadas; recomendações não são usadas para preencher preço do produto principal. Valores e imagens precisam ser revisados. O serviço gratuito tem limites e não garante leitura de todas as lojas.

Para usar uma chave própria do Jina, configure JINA_API_KEY como segredo no ambiente do servidor e republique. A chave não é retornada pelo aplicativo nem deve ser prefixada com NEXT_PUBLIC_. Sem chave, permanece a leitura básica limitada por IP.

No celular, Ajustes permite colar sua própria chave Jina em campo de senha e usar apenas nesta sessão. Ela é mantida em memória, enviada via POST ao backend e encaminhada exclusivamente ao Jina; não é persistida nem retornada na extração. O uso consome tokens da conta Jina. A variável JINA_API_KEY é uma alternativa permanente no servidor.

## Extrator próprio pelo GitHub Actions

Minha loja deve estar conectada com token limitado a Mega-Vitrine e permissões Contents: Read and write e Actions: Read and write. Em Nova oferta ou Vários links, escolha GitHub Actions. O workflow extrair-produto.yml usa Playwright para ler páginas públicas e publica resultados JSON em .extractions/, preservando o link original. Os resultados ficam públicos no repositório público. A tarefa pode levar alguns minutos. O extrator não faz login, não usa Apify/Jina e não garante leitura de páginas bloqueadas. Nenhum produto é publicado na loja automaticamente.
