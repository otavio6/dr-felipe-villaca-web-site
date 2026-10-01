/* POST /api/leads
   Recebe o formulário da LP e encaminha para o webhook do CRM.
   CRM_WEBHOOK_URL deve ser configurada nas variáveis de ambiente do Azure. */

const { validarLead } = require('../shared/lead-validation');

const CAMPOS = ['nome', 'zap'];
const FAIXAS = [
  'Menos de R$ 20 mil',
  'De R$ 20 mil a menos de R$ 40 mil',
  'De R$ 40 mil a menos de R$ 60 mil',
  'De R$ 60 mil a menos de R$ 80 mil',
  'De R$ 80 mil a R$ 100 mil',
  'Acima de R$ 100 mil'
];
const PRAZOS = [
  'O mais breve possível',
  'Nos próximos 3 meses',
  'Entre 3 e 6 meses',
  'Entre 6 e 12 meses',
  'Daqui a mais de 1 ano'
];
const MODALIDADES_CAMPANHA = ['Presencial em BH', 'Online'];
const DISPOSICOES_CAMPANHA = ['Sim', 'Não', 'Talvez'];
const PRAZOS_CAMPANHA = ['Imediatamente', '2 a 4 semanas', '4 a 10 semanas', 'Acima de 10 semanas'];
const ATRIBUTOS_CAMPANHA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'wbraid', 'gbraid', 'msclkid', 'ttclid', 'oppref'];

module.exports = async function (context, req) {
  const responder = (status, corpo) => {
    context.res = { status, body: corpo, headers: { 'Content-Type': 'application/json' } };
  };
  const dados = req.body || {};
  const ausentes = CAMPOS.filter(c => typeof dados[c] !== 'string' || !dados[c].trim());
  if (ausentes.length) return responder(400, { erro: 'Preencha todos os campos obrigatórios.' });
  const erros = validarLead(dados);
  if (erros.nome || erros.zap) return responder(400, { erro: erros.nome || erros.zap });
  if (dados.investimento && !FAIXAS.includes(dados.investimento) || dados.prazo && !PRAZOS.includes(dados.prazo)) {
    return responder(400, { erro: 'Opção inválida.' });
  }
  const campanhaPosEmagrecimento = dados.campanha === 'pos-emagrecimento';
  if (campanhaPosEmagrecimento) {
    if (typeof dados.cidade !== 'string' || !dados.cidade.trim() || !dados.modalidade || !dados.disposicaoConsulta || !dados.prazoConsulta) {
      return responder(400, { erro: 'Preencha todos os campos obrigatórios.' });
    }
    if (!MODALIDADES_CAMPANHA.includes(dados.modalidade) || !DISPOSICOES_CAMPANHA.includes(dados.disposicaoConsulta) || !PRAZOS_CAMPANHA.includes(dados.prazoConsulta)) {
      return responder(400, { erro: 'Opção inválida.' });
    }
  }

  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) {
    context.log.error('leads: CRM_WEBHOOK_URL ausente na configuração do Azure.');
    return responder(503, { erro: 'Integração não configurada.' });
  }

  const nome = dados.nome.trim().slice(0, 120);
  const whatsapp = dados.zap.trim().slice(0, 40);
  const telefone = whatsapp.replace(/\D/g, '');
  const cidade = typeof dados.cidade === 'string' ? dados.cidade.trim().slice(0, 120) : undefined;
  const respostasCampanha = campanhaPosEmagrecimento ? {
    modalidadeConsulta: dados.modalidade,
    disposicaoValorConsulta: dados.disposicaoConsulta,
    prazoConsulta: dados.prazoConsulta
  } : undefined;
  const atribuicaoRecebida = campanhaPosEmagrecimento && dados.atribuicao && typeof dados.atribuicao === 'object' && !Array.isArray(dados.atribuicao) ? dados.atribuicao : {};
  const atribuicao = Object.fromEntries(ATRIBUTOS_CAMPANHA.flatMap((chave) => {
    const valor = atribuicaoRecebida[chave];
    return typeof valor === 'string' && valor.trim() ? [[chave, valor.trim().slice(0, 256)]] : [];
  }));
  const lead = {
    dadosLead: {
      leadName: nome,
      leadPhone: telefone.length === 10 || telefone.length === 11 ? '55' + telefone : telefone,
      leadCity: cidade,
      leadSource: campanhaPosEmagrecimento ? 'campanha-pos-emagrecimento-fvg' : 'site-felipe-villaca',
      leadNotes: [
        dados.proc && `Procedimento: ${dados.proc}`,
        dados.investimento && `Investimento: ${dados.investimento}`,
        dados.prazo && `Prazo: ${dados.prazo}`,
        cidade && `Cidade/estado: ${cidade}`,
        campanhaPosEmagrecimento && `Campanha: Pós-emagrecimento`,
        campanhaPosEmagrecimento && `Modalidade da consulta: ${dados.modalidade}`,
        campanhaPosEmagrecimento && `Disposta a pagar R$950,00 pela consulta: ${dados.disposicaoConsulta}`,
        campanhaPosEmagrecimento && `Quando pretende fazer a consulta: ${dados.prazoConsulta}`,
        campanhaPosEmagrecimento && atribuicao.utm_source && `UTM source: ${atribuicao.utm_source}`,
        campanhaPosEmagrecimento && atribuicao.utm_medium && `UTM medium: ${atribuicao.utm_medium}`,
        campanhaPosEmagrecimento && atribuicao.utm_campaign && `UTM campaign: ${atribuicao.utm_campaign}`
      ].filter(Boolean).join(' | ')
    },
    dadosEmpresaLead: { nomeEmpresa: 'FVG Cirurgia Plástica' },
    assets: {
      origem: campanhaPosEmagrecimento ? 'campanha-pos-emagrecimento-fvg' : 'site-felipe-villaca',
      pagina: typeof dados.pagina === 'string' ? dados.pagina.slice(0, 160) : undefined,
      recebidoEm: new Date().toISOString(),
      ...(respostasCampanha ? { respostasCampanha } : {}),
      ...(Object.keys(atribuicao).length ? { atribuicao } : {})
    }
  };

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!resposta.ok) {
      context.log.error('leads: CRM respondeu ' + resposta.status);
      return responder(502, { erro: 'Falha ao registrar o lead.' });
    }
    return responder(201, { recebido: true });
  } catch (erro) {
    context.log.error('leads: erro de rede - ' + erro.message);
    return responder(502, { erro: 'Falha ao registrar o lead.' });
  }
};
