const VOGAIS = /[aeiouáéíóúâêôãõàü]/i;
const LETRAS = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

function validarNome(valor) {
  const nome = valor.trim().replace(/\s+/g, ' ');
  const letras = nome.replace(/[^\p{L}]/gu, '');
  const semAcentos = letras.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const palavras = nome.split(' ');

  if (nome.length < 5 || nome.length > 120 || palavras.length < 2 || !LETRAS.test(nome)) {
    return 'Digite seu nome e sobrenome.';
  }
  if (letras.length < 4 || [...letras].filter(letra => VOGAIS.test(letra)).length / letras.length < 0.25 || /[bcdfghjklmnpqrstvwxyz]{4,}/i.test(semAcentos)) {
    return 'Digite um nome válido, sem números ou caracteres aleatórios.';
  }
  return '';
}

function validarTelefone(valor) {
  const telefone = valor.replace(/\D/g, '');
  if (!/^[1-9]\d{9,10}$/.test(telefone) || /^(\d)\1+$/.test(telefone) || '0123456789'.includes(telefone) || '9876543210'.includes(telefone)) {
    return 'Digite um WhatsApp válido com DDD.';
  }
  return '';
}

function validarLead(dados) {
  return { nome: validarNome(String(dados.nome || '')), zap: validarTelefone(String(dados.zap || '')) };
}

module.exports = { validarLead };
