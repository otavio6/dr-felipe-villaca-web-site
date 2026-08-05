/* POST /api/upload
   Recebe a imagem de capa em base64 (JSON) e grava em assets/blog/.

   Por que base64 e nao multipart: ler multipart numa Function exigiria uma
   biblioteca so para isso. O projeto nao tem dependencia nenhuma e o limite de
   requisicao do Azure e 30 MB, entao base64 de uma capa de ate 5 MB cabe sobrando. */

const { gravarArquivo, explicarFalhaGitHub } = require('../shared/github');
const { exigirEditor, autorDoCommit } = require('../shared/auth');

const PASTA = 'assets/blog';
const LIMITE_BYTES = 5 * 1024 * 1024;
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const slugSeguro = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Confere a assinatura do arquivo, nao so o tipo declarado: o navegador pode
// mandar qualquer content-type, e o que vale e o conteudo de verdade.
function extensaoReal(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

module.exports = async function (context, req) {
  const acesso = exigirEditor(req);
  const responder = (status, corpo) => {
    context.res = { status, body: corpo, headers: { 'Content-Type': 'application/json' } };
  };
  if (!acesso.ok) return responder(acesso.status, { erro: acesso.erro });

  const { dadosBase64, tipo, slug } = req.body || {};
  if (!dadosBase64) return responder(400, { erro: 'Nenhuma imagem recebida.' });
  if (tipo && !TIPOS[tipo]) return responder(400, { erro: 'Formato não aceito. Use JPG, PNG ou WEBP.' });

  let buf;
  try {
    buf = Buffer.from(String(dadosBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  } catch {
    return responder(400, { erro: 'Imagem corrompida.' });
  }
  if (!buf.length) return responder(400, { erro: 'Imagem vazia.' });
  if (buf.length > LIMITE_BYTES) {
    return responder(413, { erro: `Imagem de ${(buf.length / 1048576).toFixed(1)} MB. O limite é 5 MB.` });
  }

  const ext = extensaoReal(buf);
  if (!ext) return responder(400, { erro: 'O arquivo não é uma imagem JPG, PNG ou WEBP válida.' });

  // Carimbo de tempo evita que duas capas com o mesmo nome se sobrescrevam.
  const nome = `${slugSeguro(slug) || 'capa'}-${Date.now().toString(36)}.${ext}`;
  const caminho = `${PASTA}/${nome}`;

  try {
    await gravarArquivo(
      caminho,
      buf.toString('base64'),
      `blog: adiciona imagem ${nome} (via painel, por ${acesso.usuario.userDetails || 'painel'})`,
      autorDoCommit(acesso.usuario),
    );
    return responder(200, { caminho: `/${caminho}`, bytes: buf.length });
  } catch (e) {
    context.log.error('upload falhou:', e.message);
    return responder(e.configIncompleta ? 503 : 500, {
      erro: explicarFalhaGitHub(e, 'gravar a imagem'),
    });
  }
};
