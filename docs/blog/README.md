# Blog — sistema de publicação

Sistema para a social media escrever, agendar e publicar artigos pelo próprio site,
sem depender de desenvolvedor.

**Status:** no ar e validado de ponta a ponta em 05/08/2026 — a editora publicou
artigo e imagem de capa pelo painel, com commits assinados com o e-mail dela.

---

## Como funciona, do começo ao fim

```
Editora abre /admin
   └─ login por e-mail (Microsoft Entra ID)
        └─ escreve, anexa capa, escolhe data, salva
             └─ API grava o .md no repositório (1 commit por save)
                  └─ commit dispara o deploy
                       └─ gerador roda e monta as páginas
                            └─ artigo no ar em 1–2 min
```

Artigo com **data futura não é gerado**. Um workflow agendado republica o site de
hora em hora; quando a data chega, a página passa a existir. É assim que o
agendamento funciona num site estático — não há servidor consultando relógio.

---

## Decisões fechadas, e por quê

### Conteúdo no repositório, não em banco
O painel tem login por e-mail, mas o texto vira arquivo `.md` versionado no Git.

- **Histórico de versões sai de graça** e melhor do que qualquer implementação
  própria: cada save é um commit com data, autor e diff, com restauração de
  qualquer versão anterior.
- **SEO máximo**: cada artigo é HTML estático real, não montado no navegador.
- **Custo zero**: sem banco, sem storage account, sem mensalidade.

Alternativa descartada: posts em banco com renderização por função. Motivo em
[Armadilhas](#armadilhas-encontradas), item do `x-ms-original-url`.

### Login por e-mail, GitHub bloqueado
O Entra ID vem pré-configurado no Static Web Apps e funciona no **plano gratuito**.
A editora nunca vê o GitHub, que fica escondido atrás da API apenas como
armazenamento. O provedor GitHub é bloqueado por regra de rota para não aparecer
uma segunda opção de login.

**Consequência:** o convite de acesso **precisa** ser por Microsoft Entra ID.
Bloquear um provedor impede aceitar convite por ele.

### Plano gratuito, e não Standard
Login por Google exigiria *custom authentication*, exclusivo do Standard
(US$ 9/mês). Para uma editora, não se justifica. Ela usa uma conta Microsoft criada
com o e-mail do Workspace dela. Se um dia forem cinco ou seis editores com
rotatividade, a troca para Standard não exige refazer nada.

### Conversor de Markdown próprio
`tools/markdown.mjs`, sem dependência. O projeto tem zero dependências e o painel
gera a sintaxe por botões — o que chega ao conversor é conhecido e limitado.
Escapa HTML e bloqueia URL `javascript:`.

**O painel e o gerador usam o mesmo arquivo.** A prévia que a editora vê é
literalmente o que vai publicado, sem chance de divergirem.

### Upload em base64, não multipart
Ler multipart numa Function exigiria biblioteca. O limite de requisição do Azure é
30 MB e a capa é limitada a 5 MB, então base64 cabe sobrando.

---

## Estrutura

| Caminho | Papel |
|---|---|
| `content/blog/*.md` | fonte dos artigos (frontmatter + corpo) |
| `content/blog/_modelo.md` | exemplo do formato; prefixo `_` = ignorado pelo gerador |
| `tools/build-blog.mjs` | gera `/blog/` e `/blog/<slug>/`, atualiza o `sitemap.xml` e os cards da home |
| `tools/markdown.mjs` | conversor Markdown→HTML e leitura de frontmatter |
| `admin/index.html` | painel |
| `sem-acesso.html` | mostrada a quem entra sem o papel `editor` |

O painel é alcançado por **"Área restrita"** no rodapé do `index.html` — discreto de
propósito, em cinza apagado ao lado da Política de Privacidade, com `rel="nofollow"`.
Não existe na `lp.html`: aquela página não leva link externo nenhum, por decisão de
conversão registrada no próprio arquivo.
| `api/posts-admin/` | lista artigos, inclusive agendados |
| `api/salvar-post/` | grava ou remove o `.md` |
| `api/upload/` | recebe a capa, grava em `assets/blog/` |
| `api/shared/` | acesso ao GitHub e validação de identidade |

`/blog/` é saída de build e está no `.gitignore` — é reconstruída a cada deploy.

### Os cards da home

A seção `#blog` do `index.html` tinha três cards escritos à mão, marcados "Em
breve" e sem link nenhum: nasceram antes do blog existir e nunca foram ligados a
ele. Hoje o gerador injeta ali os **três artigos mais recentes**, entre os
marcadores `<!-- BLOG:CARDS:INICIO -->` e `<!-- BLOG:CARDS:FIM -->`.

Editar o miolo à mão não adianta: o build descarta o que estiver entre os
marcadores. Mexer nos **marcadores**, sim, quebra — some o par e o gerador avisa no
log e deixa a home como está, sem derrubar o deploy. O que fica versionado é o
`index.html` com os marcadores e um card de fallback; quem é preenchido é só a
cópia que vai para o Azure, mesmo caminho já usado pelo `sitemap.xml`.

O card reaproveita o markup `.media-card`, que era da seção "Na Mídia" — removida
junto, em 05/08/2026. Eram três matérias hospedadas no `felipevillaca.com`: a home
exportava três links `follow` para um domínio que disputa as mesmas palavras-chave
que ela. Sobraram **8 links** para lá, todos na seção de procedimentos — mesma
questão, decisão ainda pendente do cliente (ver [Relacionado](#relacionado)).

### Frontmatter

```markdown
---
titulo: Título do artigo
data: 2026-07-28T09:00:00-03:00
resumo: Aparece no card e no Google
capa: /assets/blog/nome-da-imagem.jpg
instagram: https://www.instagram.com/p/...
---

Corpo em Markdown.
```

Só `titulo` e `data` são obrigatórios. Artigo sem `data` válida é ignorado com
aviso no log, sem derrubar o deploy.

---

## Configuração

### Variáveis de ambiente
Portal → Static Web App → *Settings* → **Environment variables** → ambiente
**Production**:

| Nome | Valor |
|---|---|
| `BLOG_GITHUB_TOKEN` | token fine-grained do GitHub, com `Contents: Read and write` só neste repositório |
| `BLOG_REPO` | `otavio6/dr-felipe-villaca-web-site` |
| `BLOG_BRANCH` | `main` |

O token só existe no servidor. Não aparece no HTML nem no JavaScript do navegador.

**Gotcha da tela:** são dois cliques em *Apply* — o primeiro fecha o formulário do
item, o segundo grava. Sair depois do primeiro perde tudo.

### Liberar uma editora
Portal → Static Web App → *Settings* → **Role Management** → **Invite**:

- Authorization provider: **Microsoft Entra ID** (nunca GitHub — ver decisões)
- Invitee details: o e-mail dela
- Domain: `drfelipevillaca.com.br`
- Role: `editor`
- Validade: até 168 horas (7 dias, máximo)

Se ela não tiver conta Microsoft, criar antes em `signup.live.com` usando
**"Usar um e-mail existente"** com o endereço dela. Isso não cria caixa nova nem
altera o e-mail existente — registra o endereço como identidade de login.
**Conta primeiro, convite depois**, senão o fluxo se perde no meio.

---

## Armadilhas encontradas

**`/content/*` vazava artigo agendado.** O Azure publica tudo que está na pasta do
site, então o `.md` de um artigo com data futura ficaria legível antes da
publicação. Rota bloqueada com 404.

**Página de erro 403 dentro da área protegida.** A tela que explica "sua conta não
tem acesso" estava em `/admin/sem-acesso.html` — seria barrada pelo mesmo 403 que
deveria explicar. Movida para a raiz.

**Falso sucesso ao salvar com sessão vencida.** Com o 401 redirecionando ao login,
uma chamada de API com sessão expirada segue o redirecionamento e devolve HTML com
status 200. O painel lia como sucesso e exibia "Salvo" sem ter salvo nada — a
editora perderia o texto achando que publicou. Toda chamada agora exige
`content-type: application/json`; HTML vira erro de sessão expirada, com aviso para
copiar o texto antes de sair.

**`"main"` no `api/package.json` derrubava a API inteira.** Toda chamada a `/api/*`
devolvia `500` em HTML — lista, salvar e upload — e nenhum artigo jamais chegou ao
repositório. O `package.json` da API declarava `"main": "index.js"` e esse arquivo
nunca existiu. No worker Node do Azure Functions esse campo é o ponto de entrada do
**modelo de programação v4**: o worker tenta carregar o arquivo na inicialização e,
não achando, falha **antes de registrar qualquer função**. Nada do nosso código
roda, nenhum log nosso aparece, e o host responde 500 sozinho. Estas funções usam o
modelo v3, com `function.json` em cada pasta, que não usa `main` — o campo entrou
por hábito de `package.json` comum e passou despercebido porque o teste de ponta a
ponta nunca tinha rodado.

O sintoma engana: parece problema de token ou de permissão. O que descarta essas
hipóteses de uma vez é o **content-type**. Os três handlers respondem JSON até nos
erros; se o que volta não é JSON, o código não rodou e o problema está no host, não
no GitHub. Antes de investigar token, confira isso.

**Não confundir com falha de deploy.** Dois saves seguidos pelo painel disparam dois
deploys, e o Azure cancela o anterior (`Deployment Canceled`). O run aparece
vermelho no GitHub Actions e não é problema nenhum — o último vence.

**"Sessão expirada" era o único diagnóstico possível — e quase sempre errado.**
O `staticwebapp.config.json` transforma em HTML *todos* os erros de acesso: `401`
vira redirect 302 para o login, `403` vira `/sem-acesso.html`, `404` vira
`/404.html`. O painel só sabia checar se a resposta era JSON, então conta sem o
papel `editor`, rota quebrada e sessão realmente vencida chegavam à editora com a
mesma frase. Agora, ao receber algo que não é JSON, o painel consulta `/.auth/me`
— que responde JSON com ou sem sessão — e separa os três casos.

**Relogar apagava o artigo inteiro.** A sessão do Azure cai depois de algumas
horas, e isso só aparecia no clique em *Salvar*, com o texto pronto. O aviso
oferecia um link de login que **navegava a própria aba**: ela entrava de novo e
voltava para um formulário em branco. Toda tentativa de publicar terminava em
perda do texto. Três mudanças: o rascunho é gravado no `localStorage` enquanto ela
escreve; o link de login abre em **outra aba** (o cookie de sessão vale para todas,
então basta voltar e clicar em Salvar de novo); e uma ronda de 5 em 5 minutos
avisa que a sessão caiu **antes** do trabalho estar pronto. O rascunho só é
apagado depois que o artigo é gravado no repositório de verdade.

**A prévia da capa mostrava imagem quebrada.** Depois do upload ela apontava para
`/assets/blog/<arquivo>`, e esse caminho só passa a existir quando o deploy termina
— um a dois minutos depois. Justamente no momento de conferir a foto escolhida, a
editora via um ícone quebrado. Hoje a prévia usa o arquivo que está no computador
dela, lido uma única vez e reaproveitado para o upload; o caminho remoto fica
guardado só para o frontmatter. Duas consequências que valem lembrar ao mexer aqui:
a prévia aparece **antes** de o upload terminar, e o rascunho guarda o caminho, não
a imagem — uma data URL de 5 MB estouraria a cota do `localStorage`.

**Trocar de foto limpa a capa anterior na hora.** Antes, a tela mostrava a foto
nova enquanto o artigo ainda gravaria a antiga: era possível publicar a capa errada
achando que era a que estava na tela. Se o upload falhar, o artigo fica sem capa e o
aviso diz por quê.

**Toda falha do GitHub virava "Não consegui gravar".** O motivo real — 401, 403,
404 — ia só para o `context.log`, que ninguém lê. A editora recebia uma frase sobre
a qual não podia agir e nem repassar. Agora `explicarFalhaGitHub()` traduz o status
em causa e responsável:

| Status do GitHub | O que é | O que a mensagem manda fazer |
|---|---|---|
| `401` | token inválido ou vencido | renovar `BLOG_GITHUB_TOKEN` |
| `403` | token sem escrita | gerar de novo com `Contents: Read and write` |
| `404` na escrita | `BLOG_REPO`/`BLOG_BRANCH` errados | conferir as variáveis |
| `409`/`422` | arquivo mudou no meio | recarregar e salvar de novo |

**O 404 na gravação virava "Salvo" sem ter salvo.** O `gh()` devolvia `null` em
qualquer 404, o que faz sentido na leitura (arquivo não existe) e é falso sucesso
na escrita: repositório ou branch errados respondem 404, `gravarArquivo` devolvia
`null` e o handler respondia `200 {ok:true}`. Era o mesmo falso sucesso já
corrigido no painel, escondido uma camada abaixo. Hoje o 404 só é tolerado onde é
pedido explicitamente (`aceitar404: true`), e leitura é o único lugar que pede.

**SSR por função é frágil no Static Web Apps.** Ao reescrever `/blog/post` para uma
função, o cabeçalho de origem chega já reescrito e a função não sabe qual artigo
foi pedido ([issue #580](https://github.com/Azure/static-web-apps/issues/580)). Foi
o que descartou a arquitetura com banco e definiu a geração estática.

**`fileURLToPath` no gerador.** Montar o caminho a partir de `import.meta.url` na
mão gera `/C:/...` no Windows e o script roda apontando para lugar nenhum.

---

## QA

Testado chamando os handlers direto, com o módulo do GitHub substituído por dublê:

| Caso | Resultado |
|---|---|
| Chamada sem login | `401` |
| Logado sem o papel `editor` | `403` |
| Salvar sem título / com data inválida | `400` com mensagem |
| Slug com acento (`Recuperação`) | `recuperacao-da-abdominoplastia` |
| Arquivo que não é imagem, rotulado como PNG | recusado por assinatura de bytes |
| Imagem acima de 5 MB | `413` |
| Ida e volta API → gerador | frontmatter gravado é lido corretamente |
| `javascript:` em link do Markdown | neutralizado para `#` |
| `<script>` no texto | escapado |

Painel testado com DOM, `localStorage` e `fetch` simulados (19 verificações):

| Caso | Resultado |
|---|---|
| Sessão vence no *Salvar* | texto gravado no rascunho, nada perdido |
| Mensagem da sessão vencida | diz que o texto está guardado, login abre em outra aba |
| Salvar de novo após relogar | grava e apaga o rascunho |
| Conta sem o papel `editor` | fala em permissão, **não** em sessão |
| Falha do servidor com sessão boa | mostra o código HTTP, **não** fala em sessão |
| Abrir o painel com rascunho pendente | oferece "Continuar de onde parei" |
| Retomar rascunho | devolve título, texto e data ao editor |
| Descartar rascunho | limpa o `localStorage` |
| Escolher capa, upload lento | foto aparece antes de o upload voltar |
| Upload concluído | prévia **não** troca para `/assets/blog/...` |
| Rascunho com capa | guarda o caminho, nunca a data URL |
| Trocar de foto | nome e capa acompanham a foto nova |
| Upload que falha | foto escolhida continua na tela, com o motivo |
| Abrir outro artigo | não herda a capa da sessão anterior |

API testada contra um GitHub simulado (17 verificações):

| Caso | Resultado |
|---|---|
| `403` na escrita | 500 com "permissão de escrita" e `Contents: Read and write` |
| `401` na escrita | fala em token inválido ou expirado |
| `404` na escrita | **não** vira sucesso; aponta `BLOG_REPO`/`BLOG_BRANCH` |
| `409` na escrita | manda recarregar e tentar de novo |
| Qualquer falha | resposta segue JSON e não carrega o token |
| Save e upload normais | 200, com `PUT` de fato disparado |
| `BLOG_GITHUB_TOKEN` ausente | 503 nomeando a variável |

Verificado em produção após o deploy: `/blog/` responde 200, `/admin` e `/api`
retornam 401 sem login, `/content/*` retorna 404, `/.auth/login/github` retorna 404
e `/.auth/login/aad` redireciona para o login.

No navegador: prévia renderizando título/lista/negrito, botões de formatação
inserindo Markdown, data futura exibindo "ficará invisível até essa data" e data
passada exibindo "publicado assim que salvar".

---

## Pendências

- [x] ~~Camila criar a conta Microsoft, receber o convite com papel `editor` e
      publicar um artigo de ponta a ponta~~ — concluído em 05/08/2026
- [x] ~~Trocar os cards de blog da home pelos artigos deste blog~~ — feito em
      05/08/2026; a home passa a listar os três mais recentes, gerados no build
- [ ] **Trocar o `BLOG_GITHUB_TOKEN`** — o valor em uso foi exposto durante a
      depuração de 05/08/2026. Gerar outro, atualizar a variável no portal e
      revogar o antigo
- [ ] Decidir o destino do `felipevillaca.com` — ver
      [a questão dos dois domínios](#relacionado)

## Relacionado

O site tem **12 links `follow`** apontando para `felipevillaca.com`, um segundo site
ativo do mesmo médico, com os artigos de cada procedimento. Publicar um blog aqui
sem resolver isso cria dois blogs concorrendo pelas mesmas palavras-chave. Decisão
pendente do cliente.
