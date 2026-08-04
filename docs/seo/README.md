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
- [ ] Decidir o destino do `felipevillaca.com`
- [ ] Horário de atendimento no schema
