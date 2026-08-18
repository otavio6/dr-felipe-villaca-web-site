# Conversões para o ChatGPT Ads (beta)

Integração com a API de eventos do ChatGPT Ads Manager, em beta. Envia o evento
`appointment_scheduled` quando o visitante clica num CTA de WhatsApp.

Esta é a única medição do site que **não** passa pelo GTM. Explicação em
"Por que não foi no GTM", abaixo. O resto da medição continua em
[README.md](README.md).

---

## Como funciona

```
clique em a[href*="wa.me"]
        │
        ├─► dataLayer.push({event:'click_whatsapp'})   → GTM → GA4   (já existia)
        │
        └─► POST /api/conversao  {id, pagina}
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
    "data": { "type": "customer_action" }
  }]
}
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `assets/js/analytics.js` (bloco `2b`) | gera o id, chama `/api/conversao` |
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
consultas. Em aba anônima sem storage o código segue e envia — melhor contar a
mais do que perder a conversão.

### `keepalive: true`

O clique navega para fora, para o WhatsApp. Sem `keepalive` o navegador cancela
a requisição na navegação e a conversão se perde de forma intermitente — some
mais em conexão lenta, que é justamente onde o clique é mais valioso.

### Dispara sem aceite do banner

O payload não tem identificador do visitante: só um id aleatório de
deduplicação, o caminho da página e o horário. Não lê cookie e não manda IP (a
chamada à OpenAI parte do Azure, não do navegador). Por isso não foi
condicionado ao consentimento. Se o jurídico entender diferente, a trava é uma
linha em `analytics.js`: condicionar `registrarConversao()` a
`lido() === 'granted'`.

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

O formulário de lead (`submit_lead`) também não dispara conversão hoje. Só o
clique de WhatsApp.

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

**5. Logs:** Portal → Static Web App → Application Insights. Buscar `conversao:`.
Sucesso registra `conversao: appointment_scheduled registrado para <url>`.
Falha da API registra o status e os primeiros 500 caracteres da resposta — o
corpo do erro nunca é devolvido ao navegador, porque pode conter detalhe da
conta de anúncios.

## Pendências

- [ ] Cadastrar `OPENAI_ADS_PID` e `OPENAI_ADS_TOKEN` no Azure **antes** do
      push — sem isso o site chama o endpoint e recebe 503 em toda conversão.
- [ ] Rodar o teste `validate_only` uma vez antes de contar com o número.
- [ ] Decidir se `submit_lead` também vira conversão.
- [ ] Confirmar com a clínica se dá para disparar o agendamento real a partir da
      agenda/CRM (ver aviso acima).
