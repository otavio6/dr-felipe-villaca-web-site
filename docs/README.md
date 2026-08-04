# Documentação — site Dr. Felipe Villaça

Ponto de partida. Leia esta página antes de mexer em qualquer coisa; ela diz onde
está cada assunto e o que está pendente.

**Produção:** https://drfelipevillaca.com.br
**Repositório:** `otavio6/dr-felipe-villaca-web-site`
**Hospedagem:** Azure Static Web Apps, plano gratuito, deploy no push da `main`

---

## O que é este site

HTML estático puro. Sem framework, sem banco. A única etapa de build gera as páginas
do blog a partir de arquivos Markdown.

```
index.html      site institucional
lp.html         landing page de tráfego pago (noindex)
links.html      hub de bio, destino do QR do cartão (noindex)
privacidade.html  política de privacidade (noindex, revisão jurídica pendente)
404.html        página de erro
sem-acesso.html mostrada a quem entra no painel sem permissão
admin/          painel do blog
api/            funções que gravam os artigos
content/blog/   fonte dos artigos em Markdown
tools/          gerador do blog
blog/           saída do gerador (não versionada)
docs/           esta documentação
```

---

## Índice

| Assunto | Documento |
|---|---|
| Blog: arquitetura, painel, agendamento | [`blog/README.md`](blog/README.md) |
| Blog: guia de quem escreve | [`blog/COMO-PUBLICAR.md`](blog/COMO-PUBLICAR.md) |
| Medição, GTM e consentimento | [`analytics/README.md`](analytics/README.md) |
| Galeria antes/depois | [`galeria-resultados/README.md`](galeria-resultados/README.md) |
| SEO | [`seo/README.md`](seo/README.md) |
| Histórico do que mudou e por quê | [`HISTORICO.md`](HISTORICO.md) |

---

## Regras que valem para o projeto inteiro

**O Azure publica tudo que está na pasta do site.** Já vazaram por URL: `/content/*`
(artigo agendado antes da data de publicação) e `/docs/*` (esta documentação). Ao
criar pasta nova, decidir conscientemente se ela deve ser servida — e bloquear com
`statusCode: 404` no `staticwebapp.config.json` se não.

**Não reintroduzir `navigationFallback`.** Ele fazia qualquer rota inexistente
devolver a home com HTTP 200 — soft-404 infinito, com URL lixo indexável e vetor de
spam. O site não é SPA; as URLs limpas vêm de rotas explícitas.

**Página com `noindex` não entra no `sitemap.xml` nem no `Disallow` do
`robots.txt`.** Bloqueada no robots, o rastreador nunca lê o `noindex` e a URL pode
continuar indexada sem descrição.

**Fotos de paciente exigem confirmação antes do deploy.** Push na `main` publica na
hora. Nenhum filtro visual pode ser aplicado só ao "antes" — ver
[galeria](galeria-resultados/README.md).

**`.gitignore` bloqueia `assets/img/*`** de propósito: ali ficam os originais das
pacientes, com EXIF de GPS e data. Asset novo de site vai em outra pasta.

---

## Pendências consolidadas

### Dependem de decisão do cliente
- [ ] **Os dois domínios.** O site tem 12 links `follow` para `felipevillaca.com`,
      um segundo site ativo do mesmo médico com os artigos de cada procedimento.
      Com o blog aqui, passam a ser dois blogs disputando as mesmas palavras. É a
      questão de maior impacto em aberto.
- [ ] Trocar os seis cards de blog da home, hoje apontando para o outro site, pelos
      artigos deste blog — depende da decisão acima.
- [ ] Campos `[A CONFIRMAR]` da política de privacidade: base legal, prazo de
      retenção e encarregado (DPO). Precisa vir da assessoria jurídica.

### Dependem de acesso a painéis externos
- [ ] Criar no GTM os acionadores e tags dos cinco eventos —
      **sem isso não há medição de conversão**
- [ ] Marcar `click_whatsapp` e `submit_lead` como conversão no GA4
- [ ] Submeter `sitemap.xml` no Google Search Console
- [ ] Convite da editora do blog com papel `editor`
- [ ] Horário de atendimento no schema, se o Dr. fornecer

### Técnicas, já mapeadas
- [ ] Teste de ponta a ponta do painel: publicar um artigo real e conferir no ar.
      É o que valida se o token do GitHub tem permissão de escrita.
- [ ] `/defesa-alteracoes-lp` e `/links-embed-builder` são documentos internos e
      respondem 200 em produção. Têm `noindex`, mas deveriam sair do deploy.
- [ ] Sem par fotografado de Remodelamento Costal — o card não existe na galeria.

---

## Não coberto

Lighthouse e performance, teste cross-browser, e auditoria de acessibilidade além do
básico (`alt`, `lang`, hierarquia de headings, labels de formulário).
