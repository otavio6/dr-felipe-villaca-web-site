# Medição — GA4, GTM e consentimento (LGPD)

O site mede audiência com **GA4 pelo Google Tag Manager**. O código envia eventos
ao `dataLayer`; o container configura os destinos. Tudo sob Consent Mode v2.

| | |
|---|---|
| GA4 | `G-F5MHSH1SJ6` |
| GTM | `GTM-PGQZNSJS` |
| Onde | `index.html`, `lp.html` e todas as páginas do blog |

> **Fora do GTM:** as conversões enviadas ao **ChatGPT Ads** (beta) não passam
> pelo container — a API exige uma chave secreta, então a chamada sai de uma
> Azure Function. Documentação em [CHATGPT-ADS.md](CHATGPT-ADS.md).

---

## A ordem de carregamento não pode mudar

Esta é a regra mais importante deste documento.

```
1. <head> — bloco inline de consentimento   ← nega cookies por padrão
2. <head> — GTM
3. <head> — resto da página
4. fim do <head> — assets/js/analytics.js (defer)
5. <body> — noscript do GTM
```

**O consentimento tem que vir antes do GTM.** GTM e GA4 leem o mesmo `dataLayer`.
Se o GTM subir primeiro, ele dispara tags antes de a pessoa aceitar e o banner de
LGPD vira enfeite — o site passaria a gravar cookie sem base legal.

Verificado no navegador: a sequência real do `dataLayer` é
`consent:default → GTM.start`; o GA4 é configurado no container.

### Por que existe um bloco inline e um arquivo externo

O `analytics.js` é carregado com `defer`, ou seja, roda depois do HTML. Tarde demais
para o GTM. Por isso o Consent Mode ficou inline no `<head>`, e o `analytics.js`
cuida do banner e dos eventos.

O bloco inline marca `window.__fvConsentInit = true`. O `analytics.js` só declara o
padrão se essa marca não existir — redeclarar depois de um `update` **apagaria um
aceite já dado**. A checagem também serve de rede: página sem o bloco inline ainda
nega cookies por padrão, em vez de assumir consentimento.

---

## Onde mexer para cada coisa

| Quero | Arquivo |
|---|---|
| Mudar o padrão de consentimento | bloco inline no `<head>` das páginas **e** `analytics.js` |
| Mexer no banner | `assets/js/analytics.js`, função `banner()` |
| Adicionar evento | `assets/js/analytics.js` |
| Página nova que precise medir | copiar o bloco inline + GTM do `index.html` |

Se criar página nova sem o bloco inline, ela ainda mede pelo `analytics.js`, mas
fica **sem GTM**. Para o blog isso já está resolvido: o gerador
(`tools/build-blog.mjs`) injeta os dois em toda página gerada.

---

## Eventos enviados ao dataLayer

O site **empurra**, o GTM **decide o que fazer**. Cada evento precisa de um
acionador de *Evento Personalizado* no container, com o nome exato abaixo, e de uma
tag de evento do GA4 ligada a ele. **Sem isso, o evento sai do site e não chega a
lugar nenhum.**

| Evento | Parâmetros | Responde |
|---|---|---|
| `click_whatsapp` | `origem`, `pagina` | qual CTA converte — hero, card, barra fixa, flutuante, rodapé |
| `submit_lead` | `event_id`, `origem`, `pagina`, `campanha` | formulário confirmado pelo CRM, sem respostas clínicas |
| `usa_comparador` | `procedimento` | se a galeria antes/depois engaja |
| `filtro_resultados` | `categoria` | qual cirurgia desperta mais curiosidade |
| `consentimento` | `escolha` | taxa de aceite do banner |

Formulário confirmado e clique no WhatsApp são ações distintas. Um clique não
comprova recebimento do formulário pelo CRM.

### Formato importa

O código usa `dataLayer.push({event: 'nome', ...})`, que é o que um acionador de
Evento Personalizado escuta. **Não trocar por `gtag('event', ...)`** — aquele
formato serve ao GA4 direto e o GTM não o reconhece como acionador. Os eventos
sumiriam sem nenhum erro visível.

---

## Armadilhas

**Não reinstalar GA4 no código.** O `G-F5MHSH1SJ6` vive dentro do container do GTM.
Se alguém colocar de volta no `analytics.js` ou inline no HTML, o site passa a
**contar cada visita duas vezes** — e como todos os números sobem juntos, parece
crescimento, não erro.

Houve uma janela curta em que isso aconteceu de fato: entre o deploy do GTM e a
remoção do GA4 do código, ambos estavam ativos. Os números do GA4 nesse intervalo
estão inflados e devem ser desconsiderados.

**Falso `503` nos envios do GA4.** A extensão do Chrome reporta HTTP 503 nas
chamadas para `google-analytics.com/g/collect`. É artefato de como ela observa
`sendBeacon` — um `fetch` direto ao mesmo endereço devolve 204. Não é falha de
entrega. E 204 vem até para ID inexistente, então só o Realtime do GA4 prova que os
dados caem na propriedade certa.

**Evento espúrio do comparador.** No reload o Chrome restaura o valor dos
`input[type=range]` e dispara `input` sem gesto do visitante, o que inflava
`usa_comparador`. Resolvido com `autocomplete="off"` nos sliders e exigência de
`pointerdown`/`touchstart`/`keydown` antes de contar. **Métrica nova baseada em
`input` precisa da mesma trava.**

---

## Pendências

- [ ] Marcar `click_whatsapp` e `submit_lead` como conversão na interface do GA4 —
      é configuração, não código
- [ ] Conferir o Realtime do GA4 para provar que os dados chegam na propriedade
- [ ] Campos `[A CONFIRMAR]` da política de privacidade, aguardando o jurídico


## Formulários confirmados e atribuição de origem

Os quatro formulários só chamam `FVGLeadTracking.confirmed` depois de HTTP de
sucesso **e** corpo JSON com `recebido: true` de `/api/leads`.

| Chave `origem` | Rótulo | `pagina` e destino de retorno | `campanha` |
|---|---|---|---|
| `home` | Página inicial | `/` | `institucional` |
| `lp` | Página de avaliação | `/lp` | `institucional` |
| `campanha` | Campanha pós-emagrecimento | `/campanha-excessodepele` | `pos-emagrecimento` |
| `campanha-eua` | Consulta online nos EUA | `/campanha` | `consulta-eua` |

O recibo `fvg-lead-receipt-v1` no sessionStorage guarda somente versão, UUIDv4,
origem allowlisted e timestamp. É removido antes da validação e consumido uma vez
em `/obrigado`. Validade: 30 minutos; datas futuras, schema extra ou inválido e
origens desconhecidas são descartados. Não leva nome, telefone, respostas do
formulário, parâmetros de URL ou identificadores de anúncio. O evento contém
somente `event: submit_lead`, `event_id`, `origem`, `pagina` e `campanha`.

Sem storage, o evento sai na página de origem; `eventCallback` do GTM ou timeout
de 1,5 segundo liberam a navegação uma única vez. Falhas de tracking não devem
alterar o sucesso do CRM. `?origem=` serve apenas para rótulo e retorno, nunca
para autorizar conversão; um recibo válido tem precedência. Acesso direto e
refresh sem recibo não convertem. Preview local não cria recibo nem evento.
Nenhum redirecionamento automático ao WhatsApp foi encontrado ou adicionado.

O hook `fvgConfirmedLead` em analytics.js envia a conversão de formulário ao
ChatGPT Ads com o mesmo ID e caminho; não usa a trava por sessão dos cliques no
WhatsApp. Cliques continuam independentes. Meta é enviado somente pelo GTM.

### Migração coordenada do GTM — pendente

O container público observado atribui Meta Lead e cinco ações de conversão do
Google Ads a cliques no WhatsApp. **Esta mudança de código não corrige, sozinha,
os relatórios de formulário nas plataformas.**

- Configurar acionador de Evento Personalizado `submit_lead` para conversões de
  formulário confirmado; mapear `event_id`, `origem`, `pagina` e `campanha`.
- Migrar a tag Meta Lead para formulário confirmado. No Google Ads, o gestor
  deve selecionar a(s) ação(ões) apropriada(s) por campanha entre as cinco ações
  observadas; não ligar todas incondicionalmente ao mesmo evento. Confirmar IDs,
  labels e objetivos de campanha, impedindo múltiplas conversões primárias para
  um único formulário. Se houver ações adicionais para observação, classificá-las
  como secundárias e excluí-las dos objetivos de otimização quando apropriado.
- Usar Evento Personalizado com nome exato `submit_lead` e condição de igualdade
  exata na variável de camada de dados `origem`, conforme a campanha:

  | Formulário | Condição do acionador |
  |---|---|
  | Home | `event = submit_lead` E `origem = home` |
  | LP padrão | `event = submit_lead` E `origem = lp` |
  | Pós-emagrecimento | `event = submit_lead` E `origem = campanha` |
  | EUA | `event = submit_lead` E `origem = campanha-eua` |

  Não usar correspondência parcial de `campanha`, que incluiria `campanha-eua`.
  Vincular cada tag somente às origens selecionadas pelo gestor; não inferir
  labels nem criar um segundo remetente Meta no código.
- Manter `click_whatsapp` classificado separadamente como clique, com ações
  específicas quando desejadas; não tratá-lo como formulário confirmado.
- Pixel público **observado**: `631982350987104`. A propriedade e configuração
  ainda **não foram confirmadas pelo gestor**.
- Antes de publicação autorizada, validar no GTM Preview: tentativa rejeitada não
  dispara, sucesso dispara uma vez, refresh não dispara, e as quatro origens são
  preservadas. Validar também Meta Test Events e diagnóstico de conversões do
  Google Ads com o responsável; não produzir leads reais neste trabalho.

Nenhuma publicação do GTM, push, merge ou deploy faz parte desta implementação.
Verificação local sem rede: `node tools/test-lead-tracking.cjs`,
`node --check assets/js/lead-tracking.js`, `node --check assets/js/analytics.js`
e `git diff --check`.

### Verificação desta implementação (2026-10-19)

- Suite Node aprovada: recibos, schemas inválidos, expiração, preview, storage
  bloqueado, callback/timeout, tracking bloqueado, privacidade e os quatro
  handlers reais com requests simulados, rejeição, erro de rede e retry.
- JavaScript e scripts inline válidos; `git diff --check` aprovado.
- Chrome headless com todas as requisições interceptadas: quatro origens em
  390 e 1440 px, rótulos/retornos corretos, sem overflow, evento único com
  recibo, nenhum evento por query isolada ou refresh. Capturas locais em
  `/tmp/fvg-thank-you-{origem}-{largura}.png`.
- GTM Preview e validação nas plataformas continuam pendentes de acesso e
  autorização da configuração. Nenhum lead real foi criado.
