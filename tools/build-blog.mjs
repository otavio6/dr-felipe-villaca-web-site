/* Gerador do blog: content/blog/*.md  ->  /blog/ e /blog/<slug>/
   Roda no CI antes do deploy. Post com data no futuro NAO e gerado - e assim que
   o agendamento funciona num site estatico: o arquivo simplesmente ainda nao existe.
   Um workflow agendado reexecuta este script de hora em hora e o post entra sozinho. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownParaHtml, lerFrontmatter, gerarSlug, escaparHtml } from './markdown.mjs';

// fileURLToPath e a forma correta em Windows: montar o caminho a partir da URL
// na mao gera "/C:/..." e o script roda apontando para lugar nenhum.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_CONTEUDO = path.join(RAIZ, 'content', 'blog');
const DIR_SAIDA = path.join(RAIZ, 'blog');
const SITE = 'https://drfelipevillaca.com.br';
const WHATSAPP = 'https://wa.me/5531997714488?text=' + encodeURIComponent(
  'Olá, vim pelo site e gostaria de agendar uma consulta com o Dr. Felipe Villaça. Como funciona?');

const agora = new Date();

/* ---------- estilo compartilhado, mesma identidade do site ---------- */
const CSS = `
:root{--black:#0B0B0C;--graphite:#141416;--ink:#1A1A1C;--cream:#FBF9F4;--white:#fff;
--gold:#B79B69;--gold-soft:#D6C39A;--gold-deep:#8C7347;--muted:#6E675C;
--line:rgba(183,155,105,.28);--serif:'Cormorant',Georgia,serif;--sans:'Montserrat',Helvetica,Arial,sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--sans);background:var(--cream);color:var(--ink);line-height:1.75;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{width:min(760px,90%);margin:0 auto}
.wrap-l{width:min(1180px,92%);margin:0 auto}
header.topo{background:var(--black);padding:1rem 0;position:sticky;top:0;z-index:50}
header.topo .wrap-l{display:flex;align-items:center;justify-content:space-between;gap:1rem}
header.topo a.marca{font-family:var(--serif);font-size:1.25rem;color:var(--gold-soft);text-decoration:none;letter-spacing:.02em}
header.topo a.voltar{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:var(--gold-soft);text-decoration:none}
main{padding:clamp(2.5rem,6vw,4.5rem) 0 4rem}
.eyebrow{display:inline-flex;align-items:center;gap:.6rem;font-size:.7rem;letter-spacing:.28em;text-transform:uppercase;font-weight:600;color:var(--gold-deep);margin-bottom:1rem}
.eyebrow::before{content:"";width:34px;height:1px;background:var(--gold)}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(2rem,5vw,3rem);line-height:1.15;margin-bottom:.8rem}
.meta{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep);font-weight:600;margin-bottom:2rem}
/* Limita a capa: foto em retrato ocupava a tela toda antes do texto comecar */
.capa{border-radius:2px;margin:0 0 2.4rem;border:1px solid rgba(110,103,92,.14);width:100%;max-height:min(58vh,480px);object-fit:cover}
article h2{font-family:var(--serif);font-weight:600;font-size:1.7rem;margin:2.4rem 0 .8rem;line-height:1.25}
article h3{font-family:var(--serif);font-weight:600;font-size:1.3rem;margin:1.8rem 0 .6rem}
article p{margin-bottom:1.15rem;font-size:1rem;color:#3A3733}
article ul,article ol{margin:0 0 1.15rem 1.3rem}
article li{margin-bottom:.5rem;color:#3A3733}
article blockquote{border-left:2px solid var(--gold);padding:.4rem 0 .4rem 1.3rem;margin:1.8rem 0;font-family:var(--serif);font-size:1.25rem;font-style:italic;color:var(--gold-deep)}
article img{border-radius:2px;margin:1.8rem 0}
article a{color:var(--gold-deep);text-decoration:underline}
.fim{margin-top:3rem;padding-top:2rem;border-top:1px solid rgba(110,103,92,.18);display:flex;flex-wrap:wrap;gap:.9rem}
.btn{display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;padding:.95rem 1.8rem;border:1px solid transparent;border-radius:2px;text-decoration:none;transition:all .3s}
.btn-gold{background:var(--gold);color:#14100A}.btn-gold:hover{background:var(--gold-soft)}
.btn-ghost{border-color:var(--line);color:var(--gold-deep)}.btn-ghost:hover{border-color:var(--gold);background:rgba(183,155,105,.07)}
.lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.6rem;margin-top:2.5rem}
.card{background:var(--white);border:1px solid rgba(110,103,92,.14);border-radius:2px;overflow:hidden;text-decoration:none;display:flex;flex-direction:column;transition:transform .3s,box-shadow .3s}
.card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -26px rgba(20,16,5,.4)}
.card .thumb{aspect-ratio:16/10;object-fit:cover;width:100%;background:#EDE7DA}
.card .corpo{padding:1.3rem;display:flex;flex-direction:column;gap:.55rem;flex:1}
.card .data{font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep);font-weight:600}
.card h2{font-family:var(--serif);font-size:1.3rem;font-weight:600;line-height:1.25}
.card p{font-size:.88rem;color:var(--muted);flex:1}
.vazio{padding:3rem 0;color:var(--muted)}
footer.rodape{border-top:1px solid rgba(110,103,92,.18);padding:2rem 0;font-size:.78rem;color:var(--muted);text-align:center}
footer.rodape a{color:var(--gold-deep)}
`;

const FONTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">`;

/* Consentimento antes do GTM, igual ao index.html e ao lp.html. Sem isso as
   paginas do blog ficariam sem medicao, criando um buraco justamente no conteudo
   que atrai visita organica. */
const CONSENTIMENTO_E_GTM = `
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
try{if(localStorage.getItem('fv-consent')==='granted')gtag('consent','update',{analytics_storage:'granted'})}catch(e){}
window.__fvConsentInit=true;
</script>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PGQZNSJS');</script>
<!-- End Google Tag Manager -->`;

const NOSCRIPT_GTM = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PGQZNSJS" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

const layout = ({ titulo, descricao, canonical, og, jsonld, conteudo }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
${CONSENTIMENTO_E_GTM}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#0B0B0C">
<title>${escaparHtml(titulo)}</title>
<meta name="description" content="${escaparHtml(descricao)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
${og}
${FONTES}
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>` : ''}
<script src="/assets/js/analytics.js" charset="utf-8" defer></script>
</head>
<body>
${NOSCRIPT_GTM}
<header class="topo"><div class="wrap-l">
  <a class="marca" href="/">Dr. Felipe Villaça</a>
  <a class="voltar" href="/#contato">Agendar consulta</a>
</div></header>
${conteudo}
<footer class="rodape"><div class="wrap">
  Dr. Felipe Villaça Guimarães — CRM-MG 48463 · RQE 32245 · Belo Horizonte, MG<br>
  <a href="/">Voltar ao site</a> · <a href="/blog/">Todos os artigos</a> · <a href="/privacidade">Privacidade</a>
</div></footer>
</body>
</html>`;

const dataBR = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/* ---------- leitura dos posts ---------- */
function lerPosts() {
  if (!fs.existsSync(DIR_CONTEUDO)) return [];
  return fs.readdirSync(DIR_CONTEUDO)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .map(arquivo => {
      const bruto = fs.readFileSync(path.join(DIR_CONTEUDO, arquivo), 'utf8');
      const { meta, corpo } = lerFrontmatter(bruto);
      const slug = meta.slug ? gerarSlug(meta.slug) : gerarSlug(arquivo.replace(/\.md$/, ''));
      const data = new Date(meta.data || 0);
      return {
        arquivo, slug, meta, corpo,
        titulo: meta.titulo || '(sem título)',
        resumo: meta.resumo || '',
        capa: meta.capa || '',
        capaAlt: meta.capaAlt || meta.titulo || '',
        instagram: meta.instagram || '',
        data,
        valida: !isNaN(data.getTime()) && !!meta.data,
      };
    });
}

/* ---------- geração ---------- */
function paginaPost(p) {
  const url = `${SITE}/blog/${p.slug}/`;
  const desc = p.resumo || p.titulo;
  const imagem = p.capa ? (p.capa.startsWith('http') ? p.capa : SITE + p.capa) : `${SITE}/assets/social/og-cover.jpg`;

  const og = [
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="Dr. Felipe Villaça — Cirurgia Plástica">',
    '<meta property="og:locale" content="pt_BR">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${escaparHtml(p.titulo)}">`,
    `<meta property="og:description" content="${escaparHtml(desc)}">`,
    `<meta property="og:image" content="${imagem}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escaparHtml(p.titulo)}">`,
    `<meta name="twitter:description" content="${escaparHtml(desc)}">`,
    `<meta name="twitter:image" content="${imagem}">`,
  ].join('\n');

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.titulo,
    description: desc,
    image: imagem,
    datePublished: p.data.toISOString(),
    dateModified: p.data.toISOString(),
    inLanguage: 'pt-BR',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: 'Dr. Felipe Villaça Guimarães', url: SITE + '/' },
    publisher: { '@id': SITE + '/#physician' },
  };

  const corpoHtml = markdownParaHtml(p.corpo);
  const capaHtml = p.capa
    ? `<img class="capa" src="${escaparHtml(p.capa)}" alt="${escaparHtml(p.capaAlt)}" width="1200" height="750">` : '';
  const insta = p.instagram
    ? `<a class="btn btn-ghost" href="${escaparHtml(p.instagram)}" target="_blank" rel="noopener">Ver no Instagram</a>` : '';

  const conteudo = `<main><div class="wrap">
  <span class="eyebrow">Blog</span>
  <h1>${escaparHtml(p.titulo)}</h1>
  <p class="meta">${dataBR(p.data)}</p>
  ${capaHtml}
  <article>${corpoHtml}</article>
  <div class="fim">
    <a class="btn btn-gold" href="${WHATSAPP}" target="_blank" rel="noopener">Agendar consulta</a>
    ${insta}
  </div>
</div></main>`;

  return layout({ titulo: `${p.titulo} — Dr. Felipe Villaça`, descricao: desc, canonical: url, og, jsonld, conteudo });
}

function paginaLista(posts) {
  const url = `${SITE}/blog/`;
  const og = [
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url}">`,
    '<meta property="og:title" content="Blog — Dr. Felipe Villaça">',
    `<meta property="og:image" content="${SITE}/assets/social/og-cover.jpg">`,
  ].join('\n');

  const cards = posts.map(p => `
    <a class="card" href="/blog/${p.slug}/">
      ${p.capa ? `<img class="thumb" src="${escaparHtml(p.capa)}" alt="${escaparHtml(p.capaAlt)}" loading="lazy">` : ''}
      <div class="corpo">
        <span class="data">${dataBR(p.data)}</span>
        <h2>${escaparHtml(p.titulo)}</h2>
        <p>${escaparHtml(p.resumo)}</p>
      </div>
    </a>`).join('');

  const conteudo = `<main><div class="wrap-l">
  <span class="eyebrow">Blog</span>
  <h1>Informação antes da decisão</h1>
  <p class="meta">Conteúdo educativo sobre contorno corporal</p>
  ${posts.length ? `<div class="lista">${cards}</div>`
    : '<p class="vazio">Nenhum artigo publicado ainda.</p>'}
</div></main>`;

  return layout({
    titulo: 'Blog — Dr. Felipe Villaça | Cirurgia Plástica em Belo Horizonte',
    descricao: 'Artigos do Dr. Felipe Villaça sobre contorno corporal, técnicas cirúrgicas e recuperação.',
    canonical: url, og, jsonld: null, conteudo,
  });
}

/* ---------- cards do blog na home ----------
   A home tinha tres cards escritos a mao, todos marcados "Em breve" e sem link:
   nasceram antes do blog existir e nunca foram ligados a ele. Agora os tres mais
   recentes sao injetados aqui a cada build, entre os marcadores do index.html.

   A escrita e no index.html da pasta de deploy, nao no repositorio: o arquivo
   versionado guarda os marcadores, e o gerador so preenche a copia que vai para o
   Azure. E o mesmo caminho ja usado pelo sitemap.xml.

   O card reaproveita o markup .media-card, que era da secao "Na Midia" removida no
   mesmo commit. E o formato com foto, que ja existia e o cliente aprovou, e evita
   inventar CSS novo. */
const CARDS_NA_HOME = 3;

function cardDaHome(p) {
  const capa = p.capa || '/assets/social/og-cover.jpg';
  return `      <article class="media-card reveal">
        <a href="/blog/${p.slug}/">
          <div class="thumb"><img src="${escaparHtml(capa)}" alt="${escaparHtml(p.capaAlt)}" loading="lazy"></div>
          <div class="body">
            <small>${escaparHtml(dataBR(p.data))}</small>
            <h3>${escaparHtml(p.titulo)}</h3>
            <p>${escaparHtml(p.resumo)}</p>
            <span class="link">Ler artigo →</span>
          </div>
        </a>
      </article>`;
}

function atualizarHome(posts) {
  const arq = path.join(RAIZ, 'index.html');
  if (!fs.existsSync(arq)) return;
  const html = fs.readFileSync(arq, 'utf8');
  const ini = '<!-- BLOG:CARDS:INICIO -->';
  const fim = '<!-- BLOG:CARDS:FIM -->';
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) {
    console.log('  AVISO  marcadores BLOG:CARDS ausentes no index.html; home nao atualizada');
    return;
  }

  const recentes = posts.slice(0, CARDS_NA_HOME);
  // Sem artigo publicado, a secao inteira sairia com uma grade vazia. Melhor um
  // convite curto do que tres buracos.
  const miolo = recentes.length
    ? `\n    <div class="media-grid">\n${recentes.map(cardDaHome).join('\n')}\n    </div>\n    `
    : `\n    <p style="text-align:center;color:var(--muted)">Os primeiros artigos estão a caminho.</p>\n    `;

  fs.writeFileSync(arq, html.slice(0, a + ini.length) + miolo + html.slice(b));
  console.log(`  home: ${recentes.length} card(s) de artigo`);
}

/* ---------- sitemap ---------- */
function atualizarSitemap(posts) {
  const arq = path.join(RAIZ, 'sitemap.xml');
  if (!fs.existsSync(arq)) return;
  const hoje = agora.toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>\n    <lastmod>${hoje}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${SITE}/blog/</loc>\n    <lastmod>${hoje}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...posts.map(p => `  <url>\n    <loc>${SITE}/blog/${p.slug}/</loc>\n    <lastmod>${p.data.toISOString().slice(0, 10)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gerado por tools/build-blog.mjs. Nao editar a mao: e sobrescrito a cada build.
     So entram aqui URLs indexaveis - paginas noindex ficam de fora. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  fs.writeFileSync(arq, xml);
}

/* ---------- main ---------- */
const todos = lerPosts();
const invalidos = todos.filter(p => !p.valida);
const validos = todos.filter(p => p.valida);
const publicados = validos.filter(p => p.data <= agora).sort((a, b) => b.data - a.data);
const agendados = validos.filter(p => p.data > agora).sort((a, b) => a.data - b.data);

fs.rmSync(DIR_SAIDA, { recursive: true, force: true });
fs.mkdirSync(DIR_SAIDA, { recursive: true });
fs.writeFileSync(path.join(DIR_SAIDA, 'index.html'), paginaLista(publicados));
for (const p of publicados) {
  const dir = path.join(DIR_SAIDA, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), paginaPost(p));
}
atualizarSitemap(publicados);
atualizarHome(publicados);

console.log(`blog: ${publicados.length} publicado(s), ${agendados.length} agendado(s)`);
for (const p of publicados) console.log(`  publicado  /blog/${p.slug}/  ${p.data.toISOString().slice(0, 16)}`);
for (const p of agendados) console.log(`  agendado   ${p.arquivo}  sai em ${p.data.toISOString().slice(0, 16)}`);
for (const p of invalidos) console.log(`  IGNORADO   ${p.arquivo}  (campo "data" ausente ou invalido)`);
if (invalidos.length) process.exitCode = 0; // nao derruba o deploy por post malformado
