# Medição — GA4, GTM e consentimento (LGPD)

O site mede audiência com **GA4** instalado direto no código e tem o **Google Tag
Manager** disponível para tags futuras. Tudo sob Consent Mode v2.

| | |
|---|---|
| GA4 | `G-F5MHSH1SJ6` |
| GTM | `GTM-PGQZNSJS` |
| Onde | `index.html`, `lp.html` e todas as páginas do blog |

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
`consent:default → GTM.start → gtag:js → gtag:config`.

### Por que existe um bloco inline e um arquivo externo

O `analytics.js` é carregado com `defer`, ou seja, roda depois do HTML. Tarde demais
para o GTM. Por isso o Consent Mode ficou inline no `<head>`, e o `analytics.js`
cuida do resto: banner, eventos e configuração do GA4.

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
| `submit_lead` | `procedimento`, `pagina` | quem preenche o formulário e o que busca |
| `usa_comparador` | `procedimento` | se a galeria antes/depois engaja |
| `filtro_resultados` | `categoria` | qual cirurgia desperta mais curiosidade |
| `consentimento` | `escolha` | taxa de aceite do banner |

A conversão deste site é um clique que leva o visitante **para fora**, para o
WhatsApp. Sem rastreio explícito, só a visita seria registrada e nenhuma conversão.

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
