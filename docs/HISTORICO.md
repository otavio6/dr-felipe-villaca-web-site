# Histórico de mudanças

Ordem cronológica, com o motivo de cada uma. Serve para entender **por que** o
código está do jeito que está, não só o que mudou.

---

## 2026-08-04 — Tag Manager e medição centralizada

`9e2fbd1` · `6d0a89a`

GTM `GTM-PGQZNSJS` instalado em `index.html`, `lp.html` e nas páginas do blog. O
Consent Mode saiu de dentro do `analytics.js` e virou bloco inline no topo do
`<head>`, **antes** do GTM — o `analytics.js` carrega com `defer` e chegaria tarde
demais, deixando o GTM disparar tag antes do aceite.

Em seguida, o GA4 foi removido do código: o container já tinha o GA4 configurado
dentro dele, e as duas medições juntas contavam cada visita em dobro. Confirmado no
navegador — o `gtag/js` presente na página era injetado pelo próprio GTM.

Os cinco eventos passaram de `gtag('event', ...)` para
`dataLayer.push({event: ...})`. Não é cosmético: acionador de Evento Personalizado
do GTM só escuta a chave `event`. No formato antigo os eventos sairiam do site e não
chegariam a lugar nenhum, sem erro visível.

**Os números do GA4 entre os dois commits estão inflados** e devem ser
desconsiderados.

Também trocou o link da Comunidade VIP de `sendflow.pro` para o grupo direto do
WhatsApp, a pedido. Registro: o sendflow funcionava, mas apontava para outro grupo,
provavelmente lotado — ele fazia rotação automática quando um grupo enchia, e com
link direto isso acaba.

## 2026-08-04 — Link para o painel no rodapé

`f360883`

"Área restrita" ao lado da Política de Privacidade, em cinza apagado, com
`rel="nofollow"`. Discreto de propósito: painel administrativo não se anuncia.
Não entra na `lp.html`, que não leva link externo por decisão de conversão.

## 2026-08-04 — Sistema de blog

`22999ff` · `792aade` · `060aba6` · `d809011` · `32b35a7`

Gerador, painel, API e documentação. Detalhes em [`blog/README.md`](blog/README.md).

Duas falhas encontradas testando no ar: `/admin` devolvia a página de erro 401 crua
da Azure, e — mais sério — salvar com sessão vencida exibia "Salvo" sem ter salvo
nada, porque o redirecionamento para o login retorna HTML com status 200. A editora
perderia o texto achando que publicou.

## 2026-08-03 — Galeria real na landing page

`d8b09e4`

A galeria da `/lp` usava **uma única foto genérica do CDN nos 12 slots** — a mesma
imagem em "Antes" e "Depois" nos seis cards, com o comparador arrastando a foto
contra ela mesma. O rodapé exibia ao visitante o próprio recado de obra:
*"substituir pelas fotos reais autorizadas pelas pacientes"*. Estava em produção na
página de tráfego pago.

Junto saiu o `filter: grayscale(1) brightness(.92)` do `.ba .before`, que com foto
real de paciente faz o antes parecer pior do que era.

## 2026-08-03 — Correções de auditoria

`2704c5e` · `3662252`

Evento `usa_comparador` disparava sozinho: no reload o Chrome restaura o valor dos
`input[type=range]` e emite `input` sem gesto. Quatro eventos registrados numa carga
sem interação. Resolvido com `autocomplete="off"` e exigência de gesto real.

`links.html` ganhou `noindex,follow` — hub de bio, conteúdo raso.

## 2026-07-31 — SEO e medição

`7eeb37d` · `62905fb` · `0a6a796` · `89e9779`

Dados estruturados, Open Graph, `robots.txt`, `sitemap.xml`, página 404 real,
palavra-chave no H1, schema `FAQPage`. Detalhes em [`seo/README.md`](seo/README.md).

O achado mais grave: o `navigationFallback` devolvia HTTP 200 para **qualquer** rota
inexistente — soft-404 infinito.

Unificação do número de WhatsApp: `links.html` e `links-embed-builder.html`
apontavam para outro número e o exibiam na tela. Toda mensagem passou a declarar a
origem do contato.

**Erro próprio corrigido:** publiquei o RQE como "3224" em vez de "32245" no schema
e nas meta de compartilhamento. Causa: li o número com `grep` limitado a 20
caracteres, que cortou o último dígito.

Por fim, GA4 com Consent Mode v2, banner de LGPD e `privacidade.html`.

## 2026-07-30 — Comparador antes/depois

`a088e53` · `b655a49` · `2695751` · `bb18a07` · `1e48469`

Três dos cinco cards estavam em lado a lado, sem barra. A abdominoplastia foi
resolvida com recorte alinhado, porque o par já tinha o mesmo fundo.

Glúteo e lipedema exigiram uniformizar o fundo. **Duas tentativas por heurística de
cor foram publicadas e revertidas** — deixaram manchas do fundo original e, na
tentativa de corrigir, apagaram parte das pernas. A raiz está documentada em
[`galeria-resultados/README.md`](galeria-resultados/README.md): nessas fotos existe
pele com a mesma cor e o mesmo contraste de borda que a parede.

Resolvido com o modelo de segmentação `briaai/RMBG-1.4`.

O aviso de conformidade da galeria foi ajustado no mesmo passo, para declarar que o
fundo foi padronizado — o texto anterior afirmava que não havia edição nenhuma.

---

## Padrões que se firmaram nesta sequência

**Verificar em produção depois de cada deploy.** Vários problemas só apareceram no
ar: o soft-404, as manchas de fundo, a galeria de placeholder da LP, o falso sucesso
do painel, a duplicação de medição.

**Medir antes de concluir.** O gradiente do contorno (7-18 contra 0-3 da parede) e o
status real do endpoint do GA4 (204, não o 503 que a extensão reporta) mudaram
decisões que teriam ido para o lado errado por suposição.

**Documentar no mesmo passo da mudança**, conforme regra do cliente.
