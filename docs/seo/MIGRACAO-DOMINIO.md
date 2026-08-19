# Migração de `felipevillaca.com` → `drfelipevillaca.com.br`

Mapa de redirecionamento e o raciocínio por trás dele. Inventário levantado em
**19/08/2026** rastreando o domínio legado.

| Arquivo | Uso |
|---|---|
| [`redirect-map.csv`](redirect-map.csv) | a lista, para colar no painel |
| [`redirects.htaccess`](redirects.htaccess) | alternativa, só se o domínio sair do Website Builder |
| [`inventario-felipevillaca-com.json`](inventario-felipevillaca-com.json) | rastreamento bruto: status, title, H1, contagem de palavras |

---

## Onde isso é aplicado

**No Hostinger, não neste repositório.** O site legado é servido pelo Hostinger
Website Builder (`Server: hcdn`, `X-Powered-By: HostingerWebsiteBuilder`). O 301
tem que sair do servidor que responde por `felipevillaca.com`; nada no Azure
consegue redirecionar um domínio que não é dele.

Se o painel do Website Builder não permitir redirect por URL, o caminho é apontar
o DNS do domínio para uma hospedagem que permita — aí vale o `.htaccess` incluído.

---

## Estado do domínio legado

18 URLs vivas, todas **HTTP 200**, nenhuma com `noindex`. Não é um site
abandonado: é um segundo site completo com as mesmas páginas de procedimento,
disputando as mesmas buscas.

### Descoberta 1 — `/en` não é inglês

As 5 URLs sob `/en` servem **o mesmo texto em português**. Só o rótulo do menu
muda ("Português (BR)", "Na Mídia (EN)"). Não é tradução, é duplicata exata.

Cada `/en/*` vai para o mesmo destino da sua equivalente em português. Se um dia
existir versão em inglês de verdade, ela nasce no domínio novo com `hreflang`.

### Descoberta 2 — erro clínico ao vivo em `/remodelamento-gluteo`

A página de **glúteo** traz, no bloco de indicações:

> "Indicado para: Pacientes com **mamas flácidas, assimétricas ou pequenas** em
> relação ao corpo."
> "Contraindicado para: Pacientes com **mamas muito grandes que exigiriam
> mastopexia**…"

Texto da página de mama colado na de glúteo. Um paciente lendo indicação de um
procedimento na página de outro é erro editorial grave em conteúdo médico, e
está publicado agora.

**É a URL mais urgente da lista.** O 301 tira a página do ar de imediato — mais
rápido que corrigir o texto num site que está sendo aposentado.

### Descoberta 3 — `/tec` é rascunho publicado

137 palavras, sem `<h1>`, sem description, `<title>` literalmente "Tec". Foi
publicada por engano e está indexável.

---

## O mapa

`agora` = pode aplicar hoje. `depois` = só depois de recriar o conteúdo.

### Aplicar agora (12)

| Origem | Destino | Por quê |
|---|---|---|
| `/` | `/` | home → home |
| `/remodelamento-gluteo` | `/#procedimentos` | **prioridade** — tira o erro das mamas de circulação |
| `/lipedema` | `/blog/tratamento-do-lipedema-nas-pernas-como-funciona-a-cirurgia/` | mesmo tema, e o artigo novo é mais completo que as 245 palavras da legada |
| `/abdominoplastia` | `/blog/neo-umbigo-abdominoplastia-natural-dr-felipe-villaca/` | mesmo tema |
| `/lipoescultura` | `/blog/cirurgia-de-contorno-corporal-avancado-com-dr-felipe-villaca/` | contorno corporal é o tema mais próximo publicado |
| `/aumento-dos-seios` | `/blog/protese-de-recuperacao-rapida-existe-mesmo-dr-felipe-villaca/` | casamento parcial — rever quando houver página de mamoplastia |
| `/mastopexia` | `/#procedimentos` | sem equivalente |
| `/valores` | `/#contato` | o site novo trata orçamento na conversa |
| `/na-midia` | `/` | 60 palavras, e a seção "Na Mídia" saiu da home nova |
| `/tec` | `/` | rascunho |
| `/en` | `/` | duplicata |
| `/en/na-midia` | `/` | duplicata |

### Segurar até recriar o conteúdo (6)

São as três páginas mais longas do site legado — e as duas em `/en` que as
duplicam. Página longa é a que tem mais chance de estar posicionada; trocá-la por
uma âncora da home entrega menos conteúdo do que existia, e o Google pode tratar
como perda em vez de mudança de endereço.

| Origem | Palavras | Recriar como | Destino depois |
|---|---|---|---|
| `/remodelamento-costal-conheca-a-tecnica-que-ajuda-a-afinar-a-cintura` | 616 | artigo no blog | o artigo novo |
| `/terapia-hiperbarica-acelera-cicatrizacoes-de-cirurgias` | 651 | artigo com **título corrigido** | o artigo novo |
| `/a-medicina-e-para-os-humanos` | 525 | artigo institucional, se ainda representa o posicionamento | o artigo novo |

Sobre a hiperbárica: a própria URL afirma que a técnica "acelera cicatrizações",
efeito clínico universal. Ao recriar, o texto precisa dizer indicação, qualidade
da evidência e limitações — foi por isso que o botão para essa matéria saiu da
home.

Se a decisão for não recriar, o destino provisório da tabela vale, aceitando a
perda. **O que não vale é deixar sem redirect nenhum:** aí a URL antiga continua
competindo e ninguém herda nada.

---

## Regras que não podem ser quebradas

**301, nunca 302.** O 302 diz "temporário" e o Google mantém a URL antiga
indexada, sem transferir sinal.

**URL por URL, nunca tudo para a home.** Redirecionar um conjunto inteiro para a
raiz o Google trata como soft 404 e descarta o sinal — o resultado fica pior do
que não redirecionar.

**Um salto só.** Se `/en/x` vai para `/x` e `/x` vai para o domínio novo, virou
cadeia. Por isso cada `/en/*` já aponta direto para o destino final.

**Manter o domínio registrado e o 301 no ar por pelo menos um ano.** O Google
reprocessa URL por URL e leva meses. Domínio expirado no meio disso perde tudo.

**Atualizar os links externos.** Bio do Instagram, YouTube, TikTok, diretórios,
Perfil da Empresa no Google, assinatura de e-mail, material impresso. O 301
resolve o rastreador; o link certo resolve a pessoa. O bloco de links já foi
corrigido neste repositório (`links.html` chamava o domínio legado de "Site
Oficial").

---

## Sobre as âncoras no destino

Três destinos usam fragmento (`/#procedimentos`, `/#contato`). Para o visitante
funciona: o navegador rola até a seção. Para o Google, fragmento é ignorado — ele
consolida em `/`. Ou seja, essas três consolidam na home mesmo. O fragmento é
cortesia com a pessoa, não estratégia de SEO.

Quando existirem páginas de procedimento de verdade, esses três destinos devem
ser reapontados.

---

## Depois de aplicar

1. Testar cada linha: `curl -sI https://felipevillaca.com/<rota>` tem que
   devolver `301` e o `Location` correto, em **um** salto.
2. Search Console do domínio antigo: usar a ferramenta de mudança de endereço.
3. Search Console do domínio novo: acompanhar cobertura e a chegada das URLs.
4. Monitorar 404 e soft 404 nos dois por 90 dias.
5. Comparar impressões e cliques por URL antes/depois — a queda inicial é
   esperada; o que importa é a curva voltando no domínio novo.

---

## Como regerar

O inventário e o mapa foram gerados por script (`crawl-legado.js` e
`gerar-mapa.js`, no scratchpad da sessão). Se o site legado mudar antes da
migração, vale rastrear de novo antes de aplicar: o mapa vale para o inventário
de 19/08/2026.
