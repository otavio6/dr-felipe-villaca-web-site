# SEO

Só a home é indexável. Todo o resto do site carrega `noindex` por decisão.

---

## Diretivas por página

| Página | robots | Onde |
|---|---|---|
| `index.html` | `index,follow,max-image-preview:large` | meta |
| `blog/` e `blog/<slug>/` | `index,follow,max-image-preview:large` | meta, via gerador |
| `lp.html` | `noindex` | meta (já vinha assim) |
| `links.html` | `noindex,follow` | meta |
| `privacidade.html` | `noindex,follow` | meta |
| `404.html` | `noindex,follow` | meta |
| `/defesa-alteracoes-lp` | `noindex, nofollow` | header no `staticwebapp.config.json` |
| `/links-embed-builder` | `noindex, nofollow` | header no `staticwebapp.config.json` |

**Regra:** página com `noindex` não entra no `sitemap.xml` nem no `Disallow` do
`robots.txt`. Bloqueada no robots, o rastreador nunca chega a ler o `noindex` e a
URL pode continuar indexada, só que sem descrição.

O `Disallow: /links-embed-builder` existente **não** afeta `/links` — a regra é por
prefixo.

---

## Dados estruturados

JSON-LD no `<head>` do `index.html`, com `@graph` de três entidades:

- **`Physician` + `MedicalBusiness`** — NAP completo, CRM-MG 48463, RQE 32245,
  `areaServed` Belo Horizonte, redes sociais e os 8 procedimentos como
  `MedicalProcedure`
- **`WebSite`**
- **`FAQPage`** — as 11 perguntas da seção de FAQ

Cada artigo do blog gera seu próprio `BlogPosting`.

### O FAQPage é gerado a partir do HTML

Não foi escrito à mão. O Google exige que o texto do schema case exatamente com o
visível. Se as perguntas da página mudarem, **regerar** — o script `faq.js` que
extrai os `.faq-item` e reinjeta no `@graph` ficou no scratchpad da sessão; refazer
é trivial.

### Omitidos de propósito

Horário de atendimento, e-mail e `geo` **não** entram no schema: não constam no
site, e NAP inventado prejudica SEO local mais do que campo ausente — a
inconsistência entre fontes é o que o Google penaliza. Se o Dr. fornecer, incluir.

---

## Compartilhamento

Open Graph e Twitter Card em `index.html`, `lp.html` e em cada artigo do blog.

Imagem: `assets/social/og-cover.jpg`, 1200x630, gerada a partir do retrato do Dr.
no dark/dourado do site.

**Ela está em `assets/social/` e não em `assets/img/`** porque o `.gitignore`
bloqueia `assets/img/*` para manter fora do repositório os originais das pacientes.

---

## Soft-404 — corrigido, não regredir

O `navigationFallback` do Static Web Apps devolvia a home com **HTTP 200** para
qualquer rota inexistente. Verificado em produção antes da correção:
`/pagina-que-nao-existe-123` e `/viagra-barato` retornavam 200 com a página inteira.

Isso permite indexação de URL lixo e serve de vetor para spam de links: qualquer um
podia linkar `drfelipevillaca.com.br/qualquer-coisa` e ter uma página respondendo.

Removido. O site não é SPA — as URLs limpas vêm de `routes` explícitas, e
`responseOverrides` aponta o 404 para `/404.html`. Hoje rota inexistente devolve
404 de verdade.

---

## H1

A sobrelinha "Cirurgião Plástico em Belo Horizonte · Contorno Corporal de Alta
Performance" faz parte do `<h1>`, acima da headline institucional. Texto visível,
nada oculto.

No mobile o tracking de `.28em` quebrava a linha em 3-4 linhas; abaixo de 640px ele
cai para `.13em` e a fonte para `.62rem`, o que devolve 2 linhas de 360 a 430px de
largura.

---

## Canibalização entre páginas

`lp.html` é destino de tráfego pago e já vinha com `noindex` — **não** foi
adicionado canonical apontando para a home: canonical e `noindex` na mesma URL são
sinais conflitantes. Para LP de tráfego pago, `noindex` sozinho basta.

**A questão maior segue aberta:** `felipevillaca.com` é um segundo site ativo do
mesmo médico, com os artigos de cada procedimento, e este site manda **12 links
`follow`** para lá — incluindo o "Saiba mais" de cada card de procedimento. Enquanto
a decisão de qual domínio deve rankear não for tomada, parte do SEO daqui trabalha a
favor do outro.

---

## Reescrita de copy da home (2026-08-19)

Segunda rodada sobre o mesmo brief. A primeira removeu dez frases com promessa
ou superlativo; esta troca a **mensagem de cada seção**, porque a página seguia
lendo igual — tirar palavra solta não muda o que o texto promete.

Passou por comparativo lado a lado aprovado antes de aplicar. 22 trocas em 8
seções.

O comparativo lado a lado que foi aprovado antes de aplicar esta guardado em
[comparativo-copy-home.html](comparativo-copy-home.html) — abrir direto no navegador.
Cada linha traz o texto anterior, o que subiu e o motivo, com selo de publicado ou
pendente. Ele nao e servido pelo site: `/docs/*` responde 404 no `staticwebapp.config.json`.

### O que mudou

| Seção | De | Para |
|---|---|---|
| **H1** | "Onde tecnologia, arte cirúrgica e cuidado humano se encontram" | "Cirurgião plástico em Belo Horizonte com foco em contorno corporal" |
| **Sobrelinha do H1** | "Cirurgião Plástico em BH · Contorno Corporal de Alta Performance" | identificação médica completa: nome · MÉDICO · CRM · especialidade · RQE |
| **Abertura** | credencial primeiro | o que a pessoa recebe primeiro; a credencial vira prova |
| **Sobre** | "Duas décadas dedicadas à arte do contorno corporal" | "Experiência clínica com atenção ao que faz sentido para cada paciente" |
| **Procedimentos** | "Precisão técnica, desenhada para o seu corpo" | "O que você deseja entender ou melhorar?" |
| **Cards** (7 dos 8) | uma linha de vantagem | indicação, limite e o que o procedimento **não** é |
| **Diferenciais** | "Por que os resultados do Dr. Felipe são diferentes?" | "Planejamento, ambiente adequado e acompanhamento em cada etapa" |
| **Jornada** | "Do primeiro contato à sua transformação" | "Da primeira conversa ao acompanhamento pós-operatório" |
| **Jornada, etapa 5** | "A transformação que você buscava, com o cuidado que você merece" | "Retornos e orientações ajudam a monitorar a evolução…" |
| **Resultados** | "Resultados que falam por si" | "Resultado não começa pela foto: começa pela indicação correta" |
| **Depoimentos** | "Mais de 15.000 histórias de transformação" | "O que pacientes relatam sobre orientação e acompanhamento" |
| **FAQ** ×2 | "apresenta o plano cirúrgico ideal" / riscos emendados com a estrutura que os minimiza | resposta direta, com a possibilidade de adiar a cirurgia |

### As três construções que se repetiam

**"Ideal"** aparecia três vezes — botão de procedimentos, etapa 1 da jornada e
FAQ da consulta. Era a construção mais repetida e a que mais prometia: sugere
que existe uma resposta certa esperando, quando a consulta pode concluir que
nenhuma cirurgia se aplica.

**"Transformação"** aparecia em quatro seções, inclusive como última etapa da
jornada. Além de garantia de resultado, era factualmente errado: a jornada
termina no acompanhamento, que é o diferencial que o site quer vender.

**O feminino** cobria a seção inteira de jornada — "Jornada da Paciente", "você
se sinta segura", "cuidada" — e o CTA "Quero ser a próxima história". Excluía os
homens que operam com ele.

### Mensagens de WhatsApp acompanharam os botões

Dois CTAs mudaram de rótulo, e o texto pré-preenchido mudou junto — senão o
botão diz uma coisa e a mensagem que chega na equipe diz outra:

- "quero descobrir qual procedimento é ideal para mim" → "quero entender se
  algum procedimento pode ser considerado no meu caso"
- "quero ser a próxima história de transformação" → "quero falar com a equipe
  sobre a consulta"

Ambas mantêm "vim pelo site", que é o que separa lead orgânico de lead de
anúncio (a `/lp` diz "vim pela página").

### Um desvio do comparativo aprovado

A etapa 5 da jornada foi proposta como "Acompanhamento", mas a etapa 4 já se
chama "Acompanhamento Pós-Operatório". Ficou **"Evolução e retornos"** — mesma
ideia, sem dois cabeçalhos iguais seguidos.

### Fora desta rodada, por decisão da equipe

- **O depoimento de Isabela Simões** ("é tão perfeito o que ele faz"). São as
  palavras autênticas de uma paciente; editá-las seria fabricar depoimento. As
  saídas são remover ou substituir por outro relato autorizado.
- **"Retornaremos em até 24 horas"**, 3 vezes visíveis. Manter só se a equipe
  sustenta o prazo. Prazo publicado e não cumprido é a primeira promessa que o
  paciente vê quebrar.
- **A citação em destaque** ("Cada resultado é uma história de coragem. A sua
  começa agora") — cria urgência para decisão cirúrgica, mas a substituta
  idealmente é uma frase do próprio Dr.

### Conferido depois de aplicar

```
FAQPage × FAQ visível     11/11 respostas idênticas
h1/h2/h3/section/article  contagem inalterada
"procedimento ideal"      0      "falam por si"            0
"sua transformação"       0      "são diferentes"          0
"Jornada da Paciente"     0      "próxima história"        0
```

---

## Consolidação de domínio e conformidade editorial (2026-08-18)

Rodada a partir do `REESTRUTURACAO_SEO_ANTIGRAVITY.md`, um brief externo de
reconstrução completa. A reconstrução (Astro, multipágina, 9 landing pages) não
foi feita. Foram aplicados os cinco itens que não dependem dela.

### 1. Nenhum link interno aponta mais para `felipevillaca.com`

Eram 8 links na home, 1 em `links.html` e 1 no gerador. Cada um empurrava
autoridade e visitante para o domínio que está sendo aposentado, e o card levava
a pessoa para fora com `target="_blank"` no meio da jornada de conversão.

Os cards de procedimento agora apontam para o artigo interno correspondente,
quando existe:

| Card | Destino |
|---|---|
| Lipoescultura HD | `/blog/cirurgia-de-contorno-corporal-avancado-com-dr-felipe-villaca/` |
| Retração com Árgon | `/blog/tecnologias-na-cirurgia-plastica-dr-felipe-villaca/` |
| Abdominoplastia / MILA | `/blog/neo-umbigo-abdominoplastia-natural-dr-felipe-villaca/` |
| Mamoplastia | `/blog/protese-de-recuperacao-rapida-existe-mesmo-dr-felipe-villaca/` |
| Lipedema | `/blog/tratamento-do-lipedema-nas-pernas-como-funciona-a-cirurgia/` |
| Remodelamento glúteo, Ugraft, Costal | `#contato` — não há artigo ainda |

**Quando existir artigo novo para glúteo, Ugraft ou costal, trocar o `#contato`
pelo artigo.** Um link para conteúdo vale mais que um link para formulário: a
pessoa nesses cards ainda está entendendo o procedimento, não decidindo.

O botão "Ver matéria sobre a hiperbárica" saiu. Apontava para o domínio legado e
a própria URL afirmava que a hiperbárica "acelera cicatrizações" — efeito clínico
universal, que é o que a Res. CFM 2.336/2023 veda. Volta quando houver conteúdo
próprio revisado.

Em `links.html` o domínio legado estava rotulado como **"Site Oficial"**, ou
seja, todo tráfego do Instagram ia para o site errado. Corrigido também em
`links-embed-builder.html`, que é o gerador — mudar só um faria a próxima
geração reintroduzir o valor antigo.

### 2. Linguagem superlativa removida

Saíram, na home e na `/lp`: "um dos mais experientes do Brasil", "o mais alto
rigor", "Segurança Máxima", "definição máxima, sem riscos desnecessários", "a
cintura que você sempre quis", "recuperação acelerada" (3×), "sua transformação",
"terapia hiperbárica para acelerar a cicatrização".

A `/lp` é `noindex`, então isso não é SEO ali — é o destino do tráfego pago, ou
seja, publicidade médica no sentido estrito da resolução. As mesmas frases pesam
**mais** naquela página, não menos.

Duas dessas frases viviam em dois lugares: no FAQ visível e no `FAQPage` do
JSON-LD. Foram trocadas juntas. **Conferido depois da edição: as 11 respostas do
schema continuam idênticas ao HTML visível.** Se divergirem, o Google descarta o
rich result inteiro.

### 3. Contadores param de renderizar zero

`<span class="count" data-target="15000">0</span>` virava "15.000" só depois que
o `IntersectionObserver` disparava. Quem lia o HTML — rastreador, leitor de tela,
navegador com JS bloqueado — via **zero**. Agora o valor real está no HTML e a
animação é só enfeite. Adicionada também a guarda de
`prefers-reduced-motion`: quem pede menos movimento vê o número parado, correto.

### 4. Data de nascimento fora do primeiro contato

O campo era **obrigatório** e o valor ia dentro da query string do `wa.me`:

```js
`*Data de nascimento:* ${encodeURIComponent(nascBR)}%0A`   // removido
```

Não era só excesso de coleta — era dado pessoal em URL, que fica no histórico do
navegador e em qualquer log intermediário. A equipe pede a data na conversa,
quando ela for necessária.

### 5. Identificação médica completa no rodapé

Antes: `Dr. Felipe Villaça Guimarães — CRM-MG 48463 · RQE 32245`
Agora: `Dr. Felipe Villaça Guimarães — MÉDICO · CRM-MG 48463 · Cirurgia Plástica · RQE 32245`

Faltavam a palavra **MÉDICO** e a especialidade escrita, ambas exigidas com
destaque equivalente.

---

## O que ficou de fora, e por quê

**O depoimento com "é tão perfeito o que ele faz"** (`index.html`, seção de
depoimentos) continua no ar. É a fala autêntica de uma paciente: reescrever as
palavras dela seria fabricar um depoimento, que é falta mais grave que a original.
As saídas legítimas são remover o trecho ou substituí-lo por outro relato real e
autorizado — decisão da equipe, não do código.

**`procedimento` continua sendo enviado ao GTM** no evento `submit_lead`. O §15.4
do brief classifica isso como risco de inferência sobre saúde. Remover é trivial,
mas apaga a segmentação por procedimento que hoje existe no GA4 — decisão de quem
usa o relatório.

**O canônico continua no apex** (`drfelipevillaca.com.br`), não em `www`. O brief
pede `www` sem justificar. O apex já está indexado; trocar custa 301 em massa,
rastreamento novo e uma janela de instabilidade, por zero ganho de posição.

**Os nomes dos eventos não mudaram.** O brief propõe `whatsapp_click`; o site usa
`click_whatsapp`. Renomear quebra os acionadores do GTM e parte a série histórica
do GA4 em duas. A taxonomia dele é melhor no vácuo; não paga o custo.

**"Quero saber qual é ideal para mim"** (CTA do WhatsApp na seção de
procedimentos) contraria o §9.4 do brief, que veda prometer o procedimento ideal
por marketing. Não foi alterado porque mexe na convenção de mensagens do
WhatsApp — vale decidir junto com o texto dos outros CTAs.

---

## Verificado em produção

```
/                      200, indexável
/pagina-inexistente    404 de verdade
/robots.txt            200, text/plain, aponta o sitemap
/sitemap.xml           200, application/xml, só a home
/lp /links             200, noindex
JSON-LD                Physician+MedicalBusiness | WebSite | FAQPage
```

---

## Pendências

- [ ] Submeter `sitemap.xml` no Google Search Console — **sem isso nada disso sai
      do lugar**
- [ ] Testar a home no Rich Results Test; o `FAQPage` é o rich result mais visível
- [ ] Aplicar os 301 do `felipevillaca.com` no Hostinger — mapa pronto em
      [MIGRACAO-DOMINIO.md](MIGRACAO-DOMINIO.md). 12 linhas aplicáveis hoje; a
      de `/remodelamento-gluteo` é urgente (a página legada indica mamas numa
      página de glúteo)
- [ ] Decidir o destino do `felipevillaca.com` — nenhum link interno aponta
      mais para lá, mas o domínio segue no ar; falta o 301 servidor a servidor
- [ ] Decidir o que fazer com o depoimento que contém "perfeito"
- [ ] Criar artigo para remodelamento glúteo, Ugraft e remodelamento costal, e
      trocar o `#contato` desses cards pelo artigo
- [ ] Horário de atendimento no schema
