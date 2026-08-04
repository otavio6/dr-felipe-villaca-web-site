/* Conversor de Markdown -> HTML, subconjunto fechado.
   Nao usa dependencia de proposito: o projeto tem zero, e o painel gera a
   marcacao com botoes, entao a sintaxe que chega aqui e conhecida e limitada.
   Suporta: ## e ###, **negrito**, *italico*, [link](url), listas, citacao,
   imagem e paragrafo. Qualquer outra coisa vira texto escapado. */

const escapar = s => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// So aceita http(s) e caminho interno. Bloqueia javascript: e afins.
const urlSegura = u => {
  const t = u.trim();
  return /^(https?:\/\/|\/|#)/i.test(t) ? escapar(t) : '#';
};

function inline(txt) {
  let h = escapar(txt);
  h = h.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) => `<img src="${urlSegura(src)}" alt="${alt}" loading="lazy">`);
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt2, href) => {
    const u = urlSegura(href);
    const externo = /^https?:\/\//i.test(u) && !u.includes('drfelipevillaca.com.br');
    return `<a href="${u}"${externo ? ' target="_blank" rel="noopener"' : ''}>${txt2}</a>`;
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return h;
}

export function markdownParaHtml(md) {
  const linhas = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let buffer = [];      // paragrafo em construcao
  let lista = null;     // 'ul' | 'ol'

  const fecharParagrafo = () => {
    if (buffer.length) { out.push(`<p>${inline(buffer.join(' '))}</p>`); buffer = []; }
  };
  const fecharLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  const fecharTudo = () => { fecharParagrafo(); fecharLista(); };

  for (const linha of linhas) {
    const l = linha.trim();

    if (!l) { fecharTudo(); continue; }

    let m;
    if ((m = l.match(/^###\s+(.*)$/))) { fecharTudo(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = l.match(/^##\s+(.*)$/)))  { fecharTudo(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = l.match(/^>\s?(.*)$/)))   { fecharTudo(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }

    if ((m = l.match(/^[-*]\s+(.*)$/))) {
      fecharParagrafo();
      if (lista !== 'ul') { fecharLista(); out.push('<ul>'); lista = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = l.match(/^\d+\.\s+(.*)$/))) {
      fecharParagrafo();
      if (lista !== 'ol') { fecharLista(); out.push('<ol>'); lista = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }

    fecharLista();
    buffer.push(l);
  }
  fecharTudo();
  return out.join('\n');
}

/* Frontmatter simples: chave: valor, delimitado por --- no topo.
   Sem YAML de verdade - o painel escreve, entao o formato e controlado. */
export function lerFrontmatter(texto) {
  const t = String(texto).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, corpo: t };
  const meta = {};
  for (const linha of m[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i < 0) continue;
    const chave = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    meta[chave] = valor;
  }
  return { meta, corpo: m[2] };
}

export function gerarSlug(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const escaparHtml = escapar;
