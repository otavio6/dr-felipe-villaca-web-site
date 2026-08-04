/* Acesso ao repositorio via API de conteudo do GitHub.
   O token vem de variavel de ambiente (BLOG_GITHUB_TOKEN) e nunca chega ao navegador:
   estas funcoes rodam no servidor do Azure. */

const REPO = process.env.BLOG_REPO || '';
const BRANCH = process.env.BLOG_BRANCH || 'main';
const TOKEN = process.env.BLOG_GITHUB_TOKEN || '';
const BASE = 'https://api.github.com';

function conferirConfig() {
  const faltando = [];
  if (!REPO) faltando.push('BLOG_REPO');
  if (!TOKEN) faltando.push('BLOG_GITHUB_TOKEN');
  if (faltando.length) {
    const e = new Error('Variaveis de ambiente ausentes: ' + faltando.join(', '));
    e.configIncompleta = true;
    throw e;
  }
}

async function gh(caminho, opcoes = {}) {
  conferirConfig();
  const r = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'blog-dr-felipe-villaca',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...opcoes.headers,
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.status === 204 ? true : r.json();
}

const listarPasta = pasta =>
  gh(`/repos/${REPO}/contents/${encodeURI(pasta)}?ref=${encodeURIComponent(BRANCH)}`);

async function lerArquivo(caminho) {
  const j = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`);
  if (!j || !j.content) return null;
  return { texto: Buffer.from(j.content, 'base64').toString('utf8'), sha: j.sha };
}

async function gravarArquivo(caminho, conteudoBase64, mensagem, autor) {
  const existente = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`);
  return gh(`/repos/${REPO}/contents/${encodeURI(caminho)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: mensagem,
      content: conteudoBase64,
      branch: BRANCH,
      ...(existente && existente.sha ? { sha: existente.sha } : {}),
      ...(autor ? { author: autor, committer: autor } : {}),
    }),
  });
}

async function apagarArquivo(caminho, mensagem, autor) {
  const existente = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`);
  if (!existente || !existente.sha) return null;
  return gh(`/repos/${REPO}/contents/${encodeURI(caminho)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: mensagem, sha: existente.sha, branch: BRANCH,
      ...(autor ? { author: autor, committer: autor } : {}),
    }),
  });
}

module.exports = { gh, listarPasta, lerArquivo, gravarArquivo, apagarArquivo, REPO, BRANCH };
