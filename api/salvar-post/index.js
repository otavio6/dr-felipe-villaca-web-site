/* POST /api/salvar-post
   Grava (ou apaga) o .md do artigo no repositorio. O commit dispara o deploy, que
   roda o gerador e publica a pagina. Cada save vira um commit - e dai que sai o
   historico de versoes que a editora pediu, com data, autor e o que mudou. */

const { gravarArquivo, apagarArquivo, explicarFalhaGitHub } = require('../shared/github');
const { exigirEditor, autorDoCommit } = require('../shared/auth');

const PASTA = 'content/blog';

const slugSeguro = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Frontmatter e "chave: valor" por linha. Valor com quebra de linha destruiria o
// formato, entao os campos de uma linha sao achatados antes de gravar.
const umaLinha = s => String(s || '').replace(/\r?\n/g, ' ').trim();

function montarMarkdown(d) {
  const campos = [
    `titulo: ${umaLinha(d.titulo)}`,
    `data: ${d.data}`,
    d.resumo ? `resumo: ${umaLinha(d.resumo)}` : null,
    d.capa ? `capa: ${umaLinha(d.capa)}` : null,
    d.capaAlt ? `capaAlt: ${umaLinha(d.capaAlt)}` : null,
    d.instagram ? `instagram: ${umaLinha(d.instagram)}` : null,
  ].filter(Boolean);
  return `---\n${campos.join('\n')}\n---\n\n${String(d.corpo || '').trim()}\n`;
}

module.exports = async function (context, req) {
  const acesso = exigirEditor(req);
  if (!acesso.ok) {
    context.res = { status: acesso.status, body: { erro: acesso.erro }, headers: { 'Content-Type': 'application/json' } };
    return;
  }

  const responder = (status, corpo) => {
    context.res = { status, body: corpo, headers: { 'Content-Type': 'application/json' } };
  };

  const d = req.body || {};
  const slug = slugSeguro(d.slug || d.titulo);
  if (!slug) return responder(400, { erro: 'Artigo sem título ou identificador válido.' });

  const caminho = `${PASTA}/${slug}.md`;
  const autor = autorDoCommit(acesso.usuario);
  const quem = acesso.usuario.userDetails || 'painel';

  try {
    if (d.excluir) {
      await apagarArquivo(caminho, `blog: remove "${umaLinha(d.titulo) || slug}" (via painel, por ${quem})`, autor);
      return responder(200, { ok: true, removido: slug });
    }

    if (!umaLinha(d.titulo)) return responder(400, { erro: 'O título é obrigatório.' });
    if (!d.data || isNaN(new Date(d.data).getTime())) {
      return responder(400, { erro: 'Data de publicação ausente ou inválida.' });
    }

    const md = montarMarkdown(d);
    const agendado = new Date(d.data) > new Date();
    const acao = agendado ? 'agenda' : 'publica';
    await gravarArquivo(
      caminho,
      Buffer.from(md, 'utf8').toString('base64'),
      `blog: ${acao} "${umaLinha(d.titulo)}" (via painel, por ${quem})`,
      autor,
    );
    return responder(200, { ok: true, slug, agendado });
  } catch (e) {
    context.log.error('salvar-post falhou:', e.message);
    return responder(e.configIncompleta ? 503 : 500, {
      erro: explicarFalhaGitHub(e, 'gravar o artigo'),
    });
  }
};
