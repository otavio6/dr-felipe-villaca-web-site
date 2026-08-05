/* GET /api/posts-admin
   Lista todos os artigos, inclusive os agendados, para o painel.
   O site publico so enxerga os ja publicados - quem filtra por data e o gerador. */

const { listarPasta, lerArquivo, explicarFalhaGitHub } = require('../shared/github');
const { exigirEditor } = require('../shared/auth');

const PASTA = 'content/blog';
const TETO = 200; // trava de seguranca: evita estourar os 45s do Azure se a pasta crescer demais

function lerFrontmatter(texto) {
  const t = String(texto).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, corpo: t };
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i < 0) continue;
    let v = linha.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[linha.slice(0, i).trim()] = v;
  }
  return { meta, corpo: m[2] };
}

module.exports = async function (context, req) {
  const acesso = exigirEditor(req);
  if (!acesso.ok) {
    context.res = { status: acesso.status, body: { erro: acesso.erro }, headers: { 'Content-Type': 'application/json' } };
    return;
  }

  try {
    const entradas = await listarPasta(PASTA);
    if (!entradas || !Array.isArray(entradas)) {
      context.res = { status: 200, body: [], headers: { 'Content-Type': 'application/json' } };
      return;
    }

    const arquivos = entradas
      .filter(e => e.type === 'file' && e.name.endsWith('.md') && !e.name.startsWith('_'))
      .slice(0, TETO);

    const posts = (await Promise.all(arquivos.map(async e => {
      const arq = await lerArquivo(`${PASTA}/${e.name}`);
      if (!arq) return null;
      const { meta, corpo } = lerFrontmatter(arq.texto);
      return {
        slug: e.name.replace(/\.md$/, ''),
        titulo: meta.titulo || '',
        resumo: meta.resumo || '',
        data: meta.data || '',
        capa: meta.capa || '',
        instagram: meta.instagram || '',
        corpo: corpo.trim(),
      };
    }))).filter(Boolean);

    posts.sort((a, b) => new Date(b.data) - new Date(a.data));
    context.res = { status: 200, body: posts, headers: { 'Content-Type': 'application/json' } };
  } catch (e) {
    context.log.error('posts-admin falhou:', e.message);
    context.res = {
      status: e.configIncompleta ? 503 : 500,
      body: { erro: explicarFalhaGitHub(e, 'ler os artigos') },
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
