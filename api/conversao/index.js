/* POST /api/conversao
   Repassa uma conversao do site para a API de eventos do ChatGPT Ads (beta).

   Por que existe uma Function no meio, e nao uma chamada direta do navegador:
   a API exige "Authorization: Bearer <chave>". Este site e estatico e todo
   arquivo servido e publico - uma chave no JS ficaria visivel no DevTools de
   qualquer visitante, e quem a copiasse poderia injetar conversoes falsas na
   conta de anuncios. A chave fica so nas variaveis de ambiente do Azure.

   O navegador NAO escolhe o que e enviado: manda apenas o id do evento e o
   caminho da pagina. O tipo do evento, o pid e a chave sao montados aqui. */

const ENDPOINT = 'https://bzr.openai.com/v1/events';

// appointment_scheduled e o tipo escolhido no painel do ChatGPT Ads. Fica em
// variavel de ambiente para trocar sem novo deploy.
const TIPO_EVENTO = process.env.OPENAI_ADS_EVENT_TYPE || 'appointment_scheduled';

// Origens aceitas. Sem essa trava o endpoint e publico e qualquer um pode
// disparar conversao por curl. Nao e barreira forte (o cabecalho e falsificavel
// fora do navegador), mas corta abuso casual e chamada de outro site.
const ORIGENS = (process.env.SITE_ORIGENS || 'https://drfelipevillaca.com.br,https://www.drfelipevillaca.com.br')
  .split(',').map(s => s.trim()).filter(Boolean);

// Limite por IP: 10 eventos a cada 10 min. Em memoria mesmo - a instancia da
// Function recicla e o mapa se perde, entao isso e teto de abuso casual, nao
// contabilidade. O ganho real e nao repassar rajada para a API de anuncios.
const JANELA_MS = 10 * 60 * 1000;
const TETO = 10;
const vistos = new Map();

function passouNoLimite(ip) {
  const agora = Date.now();
  const marcas = (vistos.get(ip) || []).filter(t => agora - t < JANELA_MS);
  if (marcas.length >= TETO) { vistos.set(ip, marcas); return false; }
  marcas.push(agora);
  vistos.set(ip, marcas);
  if (vistos.size > 5000) vistos.clear();   // trava de memoria
  return true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function (context, req) {
  const responder = (status, corpo) => {
    context.res = { status, body: corpo, headers: { 'Content-Type': 'application/json' } };
  };

  const pid = process.env.OPENAI_ADS_PID;
  const chave = process.env.OPENAI_ADS_TOKEN;
  if (!pid || !chave) {
    context.log.error('conversao: OPENAI_ADS_PID ou OPENAI_ADS_TOKEN ausente na configuracao do Azure.');
    return responder(503, { erro: 'Integração não configurada.' });
  }

  const origem = req.headers['origin'] || '';
  if (ORIGENS.length && !ORIGENS.includes(origem)) {
    context.log.warn('conversao: origem recusada: ' + (origem || '(vazia)'));
    return responder(403, { erro: 'Origem não autorizada.' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
  if (!passouNoLimite(ip)) return responder(429, { erro: 'Muitas chamadas.' });

  const { id, pagina } = req.body || {};
  if (!UUID.test(String(id || ''))) return responder(400, { erro: 'id inválido.' });

  // O caminho vem do navegador, mas a origem nao: montar a URL aqui impede que
  // um terceiro registre a conversao como vinda de outro dominio.
  const caminho = String(pagina || '/');
  const sourceUrl = /^\/[\w\-./]*$/.test(caminho) ? origem + caminho : origem + '/';

  const corpo = {
    validate_only: false,
    events: [{
      id: String(id),
      type: TIPO_EVENTO,
      timestamp_ms: Date.now(),
      source_url: sourceUrl,
      action_source: 'web',
      data: { type: 'customer_action' }
    }]
  };

  try {
    const r = await fetch(ENDPOINT + '?pid=' + encodeURIComponent(pid), {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + chave,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corpo)
    });

    if (!r.ok) {
      // Loga o motivo no Application Insights, mas nao devolve ao navegador:
      // resposta de erro da API pode conter detalhe da conta de anuncios.
      const texto = await r.text().catch(() => '');
      context.log.error('conversao: API respondeu ' + r.status + ' - ' + texto.slice(0, 500));
      return responder(502, { erro: 'Falha ao registrar a conversão.' });
    }

    context.log('conversao: ' + TIPO_EVENTO + ' registrado para ' + sourceUrl);
    return responder(204, null);
  } catch (e) {
    context.log.error('conversao: erro de rede - ' + e.message);
    return responder(502, { erro: 'Falha ao registrar a conversão.' });
  }
};
