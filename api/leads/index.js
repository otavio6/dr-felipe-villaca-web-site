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

  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) {
    context.log.error('leads: CRM_WEBHOOK_URL ausente na configuração do Azure.');
    return responder(503, { erro: 'Integração não configurada.' });
  }

  const nome = dados.nome.trim().slice(0, 120);
  const whatsapp = dados.zap.trim().slice(0, 40);
  const telefone = whatsapp.replace(/\D/g, '');
  const lead = {
    dadosLead: {
      leadName: nome,
      leadPhone: telefone.length === 10 || telefone.length === 11 ? '55' + telefone : telefone,
      leadCity: typeof dados.cidade === 'string' ? dados.cidade.trim().slice(0, 120) : undefined,
      leadSource: 'site-felipe-villaca',
      leadNotes: [
        dados.proc && `Procedimento: ${dados.proc}`,
        dados.investimento && `Investimento: ${dados.investimento}`,
        dados.prazo && `Prazo: ${dados.prazo}`,
        dados.cidade && `Cidade/estado: ${dados.cidade}`
      ].filter(Boolean).join(' | ')
    },
    dadosEmpresaLead: { nomeEmpresa: 'FVG Cirurgia Plástica' },
    assets: {
      origem: 'site-felipe-villaca',
      pagina: typeof dados.pagina === 'string' ? dados.pagina.slice(0, 160) : undefined,
      recebidoEm: new Date().toISOString()
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
