/* Identidade do usuario logado.
   O Azure injeta x-ms-client-principal (base64 de um JSON) em toda chamada a /api.
   As regras de rota ja barram quem nao tem o papel, mas a propria documentacao
   recomenda a funcao validar de novo - regra de rota nao protege chamada de API
   feita por outro caminho. */

function usuarioDaRequisicao(req) {
  const cabecalho = req.headers['x-ms-client-principal'];
  if (!cabecalho) return null;
  try {
    return JSON.parse(Buffer.from(cabecalho, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function exigirEditor(req) {
  const u = usuarioDaRequisicao(req);
  if (!u) return { ok: false, status: 401, erro: 'Não autenticado.' };
  const papeis = u.userRoles || [];
  if (!papeis.includes('editor') && !papeis.includes('administrator')) {
    return { ok: false, status: 403, erro: 'Sua conta não tem permissão de editor.' };
  }
  return { ok: true, usuario: u };
}

// Usado para assinar o commit com quem de fato editou, em vez de um bot generico.
function autorDoCommit(usuario) {
  const email = (usuario && usuario.userDetails) || '';
  const valido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return {
    name: valido ? email.split('@')[0] : 'painel-blog',
    email: valido ? email : 'painel-blog@drfelipevillaca.com.br',
  };
}

module.exports = { usuarioDaRequisicao, exigirEditor, autorDoCommit };
