# Conversões para o ChatGPT Ads (beta)

Integração com a API de eventos do ChatGPT Ads Manager, em beta. Envia o evento
`appointment_scheduled` quando o visitante clica num CTA de WhatsApp.

Esta é a única medição do site que **não** passa pelo GTM. Explicação em
"Por que não foi no GTM", abaixo. O resto da medição continua em
[README.md](README.md).

---

## Como funciona

```
landing com ?oppref=…  →  cookie __oppref (90 dias)
        │
clique em a[href*="wa.me"]  ou  submit do #leadForm
        │
        ├─► dataLayer.push({event:'click_whatsapp'})   → GTM → GA4   (já existia)
        │
        └─► POST /api/conversao  {id, pagina, oppref}
                    │
                    └─► Azure Function  api/conversao/
                              │  monta o payload, adiciona pid + Bearer
                              └─► POST https://bzr.openai.com/v1/events?pid=…
```

Payload enviado à OpenAI:

```json
{
  "validate_only": false,
  "events": [{
    "id": "<uuid v4 gerado no navegador>",
    "type": "appointment_scheduled",
    "timestamp_ms": 1755500000000,
    "source_url": "https://drfelipevillaca.com.br/",
    "action_source": "web",
    "data": { "type": "customer_action" },
    "oppref": "gAAAAAb123"
  }]
}
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `assets/js/analytics.js` (bloco `2b`) | captura o `oppref`, gera o id, chama `/api/conversao` |
| `api/conversao/index.js` | guarda a chave, valida, repassa à OpenAI |
| `api/conversao/function.json` | rota `conversao`, `authLevel: anonymous`, só POST |
| `staticwebapp.config.json` | libera `/api/conversao` para visitante anônimo |

## Variáveis de ambiente (Azure)

Portal → Static Web App → **Configuration** → Application settings. Não vão no
repositório.

| Nome | Valor | Obrigatória |
|---|---|---|
| `OPENAI_ADS_PID` | `2RZxUyarKeybvgcJcLe5Ah` | sim |
| `OPENAI_ADS_TOKEN` | chave do painel do ChatGPT Ads | sim |
| `OPENAI_ADS_EVENT_TYPE` | padrão `appointment_scheduled` | não |
| `SITE_ORIGENS` | padrão `https://drfelipevillaca.com.br,https://www.drfelipevillaca.com.br` | não |

Sem as duas obrigatórias a Function devolve **503** e registra o motivo no
Application Insights — falha explícita, não silenciosa.

---

## Decisões

### Por que não foi no GTM

A regra deste projeto é que tag de mídia mora no container `GTM-PGQZNSJS`. Aqui
não dava: a API exige `Authorization: Bearer <chave>`. Tag no GTM roda no
navegador, e uma chave em Custom HTML fica legível para qualquer visitante — o
container é servido em texto puro. Quem copiasse a chave poderia injetar
conversões falsas na conta de anúncios e envenenar a otimização das campanhas.
Por isso a chamada saiu para uma Function.

### Por que o navegador não escolhe o que é enviado

O navegador manda só `id` e `pagina`. O tipo do evento, o `pid` e a `source_url`
são montados na Function, e a `source_url` usa o cabeçalho `Origin` — não o que
o cliente disser. Se o navegador pudesse enviar o payload inteiro, um terceiro
registraria conversão em nome de outro domínio.

### `oppref` — sem ele a conversão não é atribuída

`oppref` é o click ID do ChatGPT Ads: o equivalente ao `gclid` do Google ou ao
`fbclid` da Meta. A OpenAI o acrescenta à URL da landing quando a visita vem de
um anúncio (`…/lp?oppref=gAAAAAb123`).

A doc é explícita: *"Unlike the pixel, the API does not capture `oppref` for
you. Capture the value yourself and pass it with the server event when it is
available to support click matching."* Sem ele o evento é aceito, mas a OpenAI
não consegue ligar a conversão ao clique — os números aparecem no painel sem
campanha atribuída e a otimização não aprende nada. É o erro silencioso mais
provável desta integração.

Por isso o `analytics.js` captura o parâmetro em toda carga de página e grava no
cookie **`__oppref`, 90 dias, `SameSite=Lax`**. O cookie é necessário porque
clique e conversão quase nunca acontecem na mesma página: o visitante cai na
`/lp` com o `oppref` na URL e clica no CTA depois de navegar, quando o parâmetro
já sumiu.

O nome `__oppref` é o que o pixel da OpenAI usaria. Se o pixel for instalado um
dia, os dois leem o mesmo valor em vez de gravar cookies concorrentes.

Visita orgânica não tem `oppref`. A conversão vai do mesmo jeito, só sem
atribuição — o log da Function diz qual dos dois casos aconteceu.

### O pixel não está instalado

O site não tem o pixel da OpenAI, só a Conversions API. Consequências:

- não existe cookie `__obref`, então o campo `user.obref` nunca é enviado;
- não há deduplicação a fazer. Se o pixel for instalado depois, a regra da doc é
  reusar o mesmo valor como `id` da API e `event_id` do pixel, com o mesmo Pixel
  ID nos dois.

A doc recomenda o modo híbrido (pixel + API) como o mais preciso. Ficou de fora
por ora porque tag no navegador é decisão de container (GTM) e o pixel traz
cookie próprio, o que muda o texto da política de privacidade.

### Nenhum dado do visitante é enviado

O objeto `user` da API aceita `email_sha256`, `external_id_sha256`,
`ip_address`, `user_agent`, cidade e CEP. **Nada disso é enviado.** O IP que a
OpenAI enxerga é o do Azure, não o do visitante, porque a chamada parte do
servidor.

O efeito é menos casamento de usuário e, portanto, menos conversões atribuídas
do que o teto teórico. Foi a troca escolhida: o site é de uma clínica médica, o
visitante costuma chegar por busca de procedimento cirúrgico, e mandar sinal de
identidade para uma plataforma de anúncios exigiria consentimento explícito e
mudança na política de privacidade. Se o jurídico liberar, os campos entram na
Function sem mexer no resto.

### O endpoint é público — o que impede abuso

`/api/conversao` precisa aceitar visitante anônimo, então três travas:

1. **`Origin` na lista** de `SITE_ORIGENS`. Não é barreira forte (fora do
   navegador o cabeçalho é falsificável), mas corta chamada de outro site e
   abuso casual.
2. **Limite de 10 eventos por IP a cada 10 min**, em memória. A instância da
   Function recicla e o mapa se perde: isso é teto de abuso, não contabilidade.
3. **`id` tem que ser UUID v4** e o corpo só aceita dois campos.

### Uma vez por sessão

`sessionStorage['fv-conversao-enviada']`. O mesmo visitante costuma clicar em
mais de um CTA (hero, barra fixa, botão flutuante) e três cliques não são três
consultas. Vale também entre gatilhos diferentes: preencher o formulário e
depois clicar no botão flutuante conta uma vez. Em aba anônima sem storage o código segue e envia — melhor contar a
mais do que perder a conversão.

### `keepalive: true`

O clique navega para fora, para o WhatsApp. Sem `keepalive` o navegador cancela
a requisição na navegação e a conversão se perde de forma intermitente — some
mais em conexão lenta, que é justamente onde o clique é mais valioso.

### Dispara sem aceite do banner — e por que isso precisa ser revisto

Hoje a conversão é enviada independentemente do banner de consentimento.

O que **não** é enviado: nada que identifique o visitante. Sem e-mail, sem
telefone, sem IP (a chamada parte do Azure), sem `user` nenhum.

O que **é** gravado no dispositivo: o cookie `__oppref`, primeira parte, 90
dias. Ele carrega o click ID do anúncio — não diz quem a pessoa é, mas é um
identificador de origem publicitária guardado no navegador, e o próprio manual
da OpenAI manda tratá-lo sob consentimento no caso irmão (`__obref`): *"Before
collecting or forwarding the cookie, follow your site's measurement consent
requirements. If the user revokes consent, stop sending it."*

Ou seja: a leitura mais segura é que `__oppref` deveria seguir o mesmo Consent
Mode que já rege o GA4 neste site, onde `ad_storage` começa **negado**. Não foi
travado ainda porque isso derruba a atribuição da maioria das visitas — quem
ignora o banner deixa de ser atribuído — e a escolha entre medir e travar é do
responsável, não do código.

**Pendente de decisão do jurídico.** As duas travas são pequenas e ficam em
`analytics.js`:

- condicionar `capturaOppref()` a `lido() === 'granted'` — para de gravar o
  cookie;
- condicionar `registrarConversao()` a `lido() === 'granted'` — para de enviar
  o evento.

A segunda é mais agressiva do que o necessário: o evento em si não tem dado
pessoal. Se for para travar só uma, travar a primeira.

---

## ⚠️ O clique não é uma consulta agendada

O evento se chama `appointment_scheduled`, mas o que o site consegue observar é
**o clique que abre o WhatsApp**. O agendamento acontece depois, na conversa com
a equipe, fora do site.

Consequência prática: o otimizador do ChatGPT Ads vai aprender a buscar quem
**clica**, não quem **agenda**. Se a taxa de clique→agendamento variar entre
públicos, o custo por consulta real sobe sem aparecer no painel.

O tipo foi mantido porque é o que está configurado no painel do ChatGPT Ads.
Para medir agendamento de verdade seria preciso um disparo a partir da agenda ou
do CRM da clínica, chamando a mesma API com o `id` do evento original — o campo
existe justamente para isso.

## Onde NÃO dispara

`links.html` e `404.html` têm links de WhatsApp mas não carregam
`analytics.js` — nenhum evento sai dessas páginas, nem este nem os do GTM. É
comportamento anterior a esta integração. Se passarem a receber tráfego pago,
incluir o script.

O formulário de lead **dispara**, junto com o `submit_lead`. Faz sentido porque
o envio do formulário também termina abrindo o WhatsApp — é o mesmo desfecho do
clique no CTA, por outro caminho. Quem preenche o formulário e depois ainda
clica no botão flutuante conta uma vez só, pela trava de sessão.

---

## Testes

**1. Modo validação, sem gravar nada.** Trocar `validate_only` para `true` em
`api/conversao/index.js`, publicar, clicar num CTA e conferir o log. A API
valida o payload e não registra.

**2. A rota está anônima?** Em aba anônima (sem login do painel):

```bash
curl -i -X POST https://drfelipevillaca.com.br/api/conversao \
  -H "Origin: https://drfelipevillaca.com.br" \
  -H "Content-Type: application/json" \
  --data '{"id":"00000000-0000-4000-8000-000000000000","pagina":"/"}'
```

- `204` → funcionando.
- `401` em HTML → a regra `/api/conversao` no `staticwebapp.config.json` saiu de
  ordem; ela precisa vir **antes** de `/api/*`, que exige `editor`.
- `503` → falta `OPENAI_ADS_PID` ou `OPENAI_ADS_TOKEN` na configuração do Azure.
- `403` → `Origin` fora de `SITE_ORIGENS`.

**3. Origem recusada** (tem que dar `403`): repetir sem o cabeçalho `Origin`.

**4. Deduplicação:** clicar em dois CTAs na mesma aba. Só a primeira chamada sai;
a segunda nem chega a ser feita. Abrir aba nova para testar de novo.

**5. O `oppref` está sendo capturado?** Abrir
`https://drfelipevillaca.com.br/lp?oppref=gAAAAAteste123` e, no console:

```js
document.cookie.match(/__oppref=([^;]*)/)
```

Tem que devolver `gAAAAAteste123`. Navegar para a home e repetir: o cookie
continua lá, e é isso que faz a atribuição sobreviver à navegação.

**6. Logs:** Portal → Static Web App → Application Insights. Buscar `conversao:`.
Sucesso registra `conversao: appointment_scheduled registrado para <url>`.
Falha da API registra o status e os primeiros 500 caracteres da resposta — o
corpo do erro nunca é devolvido ao navegador, porque pode conter detalhe da
conta de anúncios.

## Pendências

- [ ] Cadastrar `OPENAI_ADS_PID` e `OPENAI_ADS_TOKEN` no Azure **antes** do
      push — sem isso o site chama o endpoint e recebe 503 em toda conversão.
- [ ] Rodar o teste `validate_only` uma vez antes de contar com o número.
- [ ] Conferir no painel, depois das primeiras conversões, se elas aparecem
      **atribuídas a campanha**. Se aparecerem sem campanha, o `oppref` não está
      chegando — checar se o anúncio está mandando o parâmetro na URL final.
- [ ] Decidir com o jurídico se o pixel entra (modo híbrido) e se os campos de
      `user` podem ser enviados.
- [ ] Confirmar com a clínica se dá para disparar o agendamento real a partir da
      agenda/CRM (ver aviso acima).
