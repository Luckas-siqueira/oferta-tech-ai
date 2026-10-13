# Validação da primeira versão

## Executado nesta entrega

- TypeScript: `tsc --noEmit` — aprovado.
- Testes: `node scripts/run-tests.mjs` — 31 testes aprovados, 0 falhas.
- Build para Sites/Vinext/Workers — aprovado.
- Build Next.js para Node.js — aprovado (compilação, TypeScript e geração das rotas).
- Integração Supabase e OpenAI: código implementado; **não ativada** sem as variáveis e serviços externos.

Os testes das APIs usam respostas HTTP controladas (fixtures) em Node.js. Não são um banco Supabase real, nem uma análise paga de imagens. A execução deles valida contratos, autorização aplicada pela API, tratamento de falhas e preservação dos dados, mas **não** comprova que as políticas PostgreSQL foram executadas ou que a IA reconheceu um produto real.

## Cobertura e pendências

| Item solicitado | Verificação feita | O que falta verificar |
|---|---|---|
| Cadastro com link | Validação + POST com resposta controlada; URL de afiliado preservada | Inserção real após migração Supabase |
| Link sem metadados | Parser testado com HTML vazio e metadados parciais | Leitura de produtos reais em cada loja |
| Imagem manual | Validação de assinatura, formato e tamanho; API recusa arquivo falso | Upload real e seleção na galeria Android |
| Identificação multimodal | Esquema de saída validado; rota informa chave ausente | Chamada real à OpenAI e revisão do resultado |
| Nome e descrição | Metadados + integração multimodal implementados | Qualidade da geração com imagens reais |
| Edição | Formulário e PATCH implementados; tipagem e build passaram | Alteração persistente com Supabase real |
| Mensagem WhatsApp | Testes dos estilos, omissão de preços e descontos não confirmados | Revisão pelo usuário no aparelho |
| Cópia | Clipboard e fallback implementados | Permissão e comportamento no Android |
| Compartilhamento | `wa.me`, Web Share e download implementados | Escolha do grupo, foto/legenda e confirmação no WhatsApp |
| Cadastro em lote | Duplicados, URLs inválidas e preservação de rastreamento testados | Lote de produtos reais e salvamento após revisão |
| Banco e histórico | APIs REST, RLS e SQL preparados; fixtures do histórico testadas | Migração, autenticação e RLS em projeto Supabase |
| Exclusão individual/em massa | Testes das rotas verificam somente IDs selecionados e falha preservada | RPC PostgreSQL real, concorrência e limpeza Storage |
| Indicadores | API testada lendo totais de `Content-Range` do banco | Contagens reais no projeto configurado |
| Responsividade Android | CSS com layouts para 560/850/1150 px e navegação móvel | Inspeção visual e toque em aparelho real |
| PWA | Manifest, ícones, standalone e regras de cache testados | Instalação no Chrome Android |

Não houve teste visual em navegador ou dispositivo nesta execução: o ambiente não disponibilizou a habilidade de controle de navegador exigida pelo fluxo de publicação. Não foram instalados navegadores alternativos.

## Roteiro para validar depois da configuração

1. Criar duas contas de teste e cadastrar uma oferta em cada uma.
2. Confirmar que cada conta só consulta, altera e exclui seus próprios registros. Tentar IDs da outra conta e verificar erro.
3. Enviar imagem da galeria; gerar sugestões com IA; confirmar incertezas e salvar.
4. Fechar e abrir o app, entrar na conta e confirmar persistência.
5. Editar preço, imagem e mensagem; recarregar e conferir os valores.
6. Copiar e compartilhar no grupo; conferir a legenda e confirmar manualmente o envio.
7. Processar lote com um link válido, um duplicado e um bloqueado; repetir a falha e completar manualmente.
8. Selecionar duas ofertas, cancelar a exclusão e conferir que ficaram; confirmar e verificar tabela e indicadores.
9. Usar uma mesma imagem em mais de um registro via banco autorizado; excluir um e confirmar preservação da imagem do outro.
10. Testar falha de banco/Storage e quota; confirmar mensagens e fila de limpeza.
11. Instalar pelo Chrome Android e validar navegação, formulários, tabelas e compartilhamento.

## Supabase ativado e validado

O projeto Supabase foi reativado e as duas migrações foram aplicadas. Testes no PostgreSQL real verificaram cadastro, edição, exclusão individual, exclusão em lote, isolamento entre duas contas, rejeição atômica de seleção não autorizada, preservação de imagem compartilhada, fila de limpeza e limite diário de IA. Todas as contas e ofertas temporárias foram removidas. Isso atualiza as pendências de banco na tabela acima.

O teste do banco não enviou mensagens nem usou a API OpenAI. O reconhecimento real de imagens, o teste de galeria e o compartilhamento no Android continuam pendentes.

A análise de segurança identificou descoberta do esquema por contas autenticadas (permitida para as tabelas REST, com RLS por proprietário), e proteção contra senhas vazadas desativada. Essa proteção adicional pode ser configurada em Supabase Auth: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Atualização do compartilhamento com foto

O botão principal prepara a foto antes de abrir o compartilhamento nativo com arquivo e texto. Os testes adicionais verificam entrega do arquivo ao Web Share sem espera de rede no clique, cancelamento sem envio alternativo, remoção da frase automática sobre comissão em mensagens antigas e preservação do link original. TypeScript, 28 testes e build Sites passaram. A chave privada não foi encontrada no pacote compilado.

O envio de foto e legenda no WhatsApp real não foi testado em Android neste ambiente. O app oferece baixar a foto e copiar a legenda quando o navegador ou o WhatsApp não mantêm ambos juntos. A integração OpenAI ainda depende de saldo na API; a tentativa real anterior foi recusada por saldo insuficiente.

## Limpeza após gerar mensagem

Ao gerar com nome e link preenchidos, o editor guarda uma cópia independente dos dados e do arquivo de foto, limpa o cadastro e leva à prévia. A prévia permite editar, copiar, compartilhar e salvar o resultado sem recolocar os dados no formulário. Nenhuma exclusão do banco é executada. TypeScript, os 28 testes existentes e build foram verificados; o novo fluxo de toque no Android não foi testado em aparelho real.

## Painel da loja unificado

Integração com produtos.json da Mega Vitrine: leitura, publicação de foto e dados em um commit, edição com verificação de conflito e exclusão confirmada. Testes HTTP controlados verificam preservação do catálogo, duplicidade, alterações concorrentes e commit atômico; não representam uma publicação de produto real com um token do usuário. O painel antigo passa a abrir o aplicativo. Autorização do GitHub dentro do app e testes de toque em Android continuam necessários.

## Correção de cadastro e autenticação

Logs reais identificaram user_already_exists no cadastro e invalid_credentials no login. O e-mail é normalizado; a senha preserva espaços. O formulário separa criação de conta e entrada, confirma a senha, permite exibi-la e oferece recuperação por e-mail, retorno por sessão e validação manual do link. Mensagens falsas de criação para uma identidade duplicada são recusadas.

Cadastro e login com senha foram testados diretamente na API Supabase com uma conta temporária, ambos HTTP 200 com sessão válida. Os 37 testes automatizados incluem recuperação e alteração autorizada de senha. Não houve envio de e-mail de recuperação para a conta do usuário nem teste de interface em Android. Entrega de e-mail depende do SMTP e dos limites do Supabase.

## Jina Reader

Integração server-side sem chave paga, com seleção no editor e fallback automático. 40 testes passaram, incluindo seleção da foto e preço do produto em destaque, descarte de recomendações, páginas de login, URLs proibidas e limite HTTP 429. TypeScript passou. Teste da rota publicada é executado após a implantação; não há teste de toque no Android neste ambiente.
