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

/* O 404 so pode ser tratado como "nao existe" na LEITURA.
   Numa gravacao ele significa outra coisa: repositorio ou branch errado, ou token
   sem enxergar o repo. Devolver null nesse caso fazia o handler responder "Salvo"
   sem ter gravado nada - o mesmo falso sucesso que ja tinha sido corrigido no
   painel, escondido uma camada abaixo. Por isso o 404 so e tolerado onde e pedido. */
async function gh(caminho, opcoes = {}) {
  conferirConfig();
  const { aceitar404 = false, ...resto } = opcoes;
  const r = await fetch(`${BASE}${caminho}`, {
    ...resto,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'blog-dr-felipe-villaca',
      ...(resto.body ? { 'Content-Type': 'application/json' } : {}),
      ...resto.headers,
    },
  });
  if (r.status === 404 && aceitar404) return null;
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const e = new Error(`GitHub ${r.status}: ${txt.slice(0, 300)}`);
    e.statusGitHub = r.status;
    throw e;
  }
  return r.status === 204 ? true : r.json();
}

/* Traduz a falha do GitHub para quem esta olhando a tela.
   Antes todos os casos viravam "Nao consegui gravar o artigo no repositorio", e o
   motivo real ficava so no context.log, que ninguem le. A editora nao tem como
   agir sobre nenhuma dessas causas, mas quem cuida do site tem - e ela e quem
   manda o print. O texto nao carrega o token nem a resposta crua do GitHub. */
function explicarFalhaGitHub(e, acao = 'gravar') {
  if (e.configIncompleta) return e.message;
  switch (e.statusGitHub) {
    case 401:
      return 'O token de acesso ao repositório é inválido ou expirou. ' +
        'Quem cuida do site precisa renovar o BLOG_GITHUB_TOKEN.';
    case 403:
      return 'O token de acesso não tem permissão de escrita no repositório. ' +
        'Quem cuida do site precisa gerá-lo de novo com "Contents: Read and write".';
    case 404:
      return 'O repositório ou a branch configurados não foram encontrados. ' +
        'Quem cuida do site precisa conferir BLOG_REPO e BLOG_BRANCH.';
    case 409:
    case 422:
      return 'O arquivo mudou no repositório enquanto você editava. ' +
        'Recarregue o painel e tente de novo.';
    default:
      return `Não consegui ${acao} no repositório` +
        (e.statusGitHub ? ` (GitHub respondeu ${e.statusGitHub}).` : '.') +
        ' Tire um print desta tela e mande para quem cuida do site.';
  }
}

const listarPasta = pasta =>
  gh(`/repos/${REPO}/contents/${encodeURI(pasta)}?ref=${encodeURIComponent(BRANCH)}`, { aceitar404: true });

async function lerArquivo(caminho) {
  const j = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`, { aceitar404: true });
  if (!j || !j.content) return null;
  return { texto: Buffer.from(j.content, 'base64').toString('utf8'), sha: j.sha };
}

async function gravarArquivo(caminho, conteudoBase64, mensagem, autor) {
  // Aqui o 404 e esperado e legitimo: e assim que se sabe que o arquivo e novo.
  const existente = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`, { aceitar404: true });
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
  const existente = await gh(`/repos/${REPO}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(BRANCH)}`, { aceitar404: true });
  if (!existente || !existente.sha) return null;
  return gh(`/repos/${REPO}/contents/${encodeURI(caminho)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: mensagem, sha: existente.sha, branch: BRANCH,
      ...(autor ? { author: autor, committer: autor } : {}),
    }),
  });
}

module.exports = { gh, listarPasta, lerArquivo, gravarArquivo, apagarArquivo, explicarFalhaGitHub, REPO, BRANCH };
