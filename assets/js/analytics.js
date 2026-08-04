/* ===== Consent Mode v2 + eventos para o GTM =====
   Carregado por index.html, lp.html e pelas paginas do blog. Arquivo unico de
   proposito: o site nao tem build nem includes, entao duplicar isso em cada
   pagina garantiria divergencia com o tempo.

   O GA4 NAO e carregado aqui. Toda a medicao e configurada no container do Tag
   Manager (GTM-PGQZNSJS); este arquivo apenas empurra os eventos para o dataLayer
   e cuida do consentimento. Ter GA4 aqui e no GTM contaria cada visita duas vezes.

   LGPD: analytics_storage comeca NEGADO. Enquanto o visitante nao aceita, as tags
   do GTM operam em modo cookieless - e o proprio Consent Mode do Google que trata
   isso, nao um contorno. So apos o aceite vem o 'update'. */

(function () {
  'use strict';

  var STORE = 'fv-consent';      // 'granted' | 'denied'
  var POLITICA = '/privacidade';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  function lido() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  function grava(v) { try { localStorage.setItem(STORE, v); } catch (e) {} }

  /* ---- 1. Consent Mode v2 ----
     Em index.html e lp.html isso ja roda inline no topo do <head>, antes do GTM -
     tem que ser antes, senao o GTM dispara tag sem consentimento. Aqui fica so
     como reserva, para pagina que nao tenha aquele bloco: sem isso as tags
     assumiriam consentimento concedido. Redeclarar o padrao apos um 'update'
     apagaria um aceite ja dado, por isso a checagem. */
  var escolha = lido();
  if (!window.__fvConsentInit) {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500
    });
    if (escolha === 'granted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    window.__fvConsentInit = true;
  }

  /* ---- 2. Eventos ----
     A conversao deste site e um clique que leva o visitante para FORA, para o
     WhatsApp. Sem rastreio explicito so a visita seria registrada, e nenhuma
     conversao.

     Formato de dataLayer.push com a chave "event", que e o que o GTM escuta num
     acionador de Evento Personalizado. NAO usar gtag('event', ...) aqui: aquele
     formato serve ao GA4 direto e o GTM nao o reconhece como acionador. */
  function enviar(nome, dados) {
    dataLayer.push(Object.assign({ event: nome }, dados || {}));
  }

  function origemDoLink(a) {
    if (a.closest('.mobile-bar')) return 'barra-fixa-mobile';
    if (a.classList.contains('wa-float')) return 'botao-flutuante';
    if (a.closest('header')) return 'cabecalho';
    if (a.closest('footer')) return 'rodape';
    var sec = a.closest('section[id]');
    if (sec) return sec.id;
    if (a.closest('.hero-copy') || a.closest('.hero')) return 'hero';
    return 'outro';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (!a) return;
    enviar('click_whatsapp', {
      origem: origemDoLink(a),
      pagina: location.pathname
    });
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('leadForm');
    if (form) {
      form.addEventListener('submit', function () {
        var proc = document.getElementById('proc');
        enviar('submit_lead', {
          procedimento: proc ? proc.value : '(nao informado)',
          pagina: location.pathname
        });
      });
    }

    /* Comparador antes/depois: conta uma vez por card, nao a cada pixel arrastado.
       Exige gesto real antes de contar - no reload o Chrome restaura o valor dos
       input[type=range] e dispara 'input' sozinho, o que inflava a metrica. */
    var usados = {};
    var gesto = false;
    var grid = document.getElementById('resultsGrid');
    if (grid) {
      ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
        grid.addEventListener(ev, function (e) {
          if (e.target.matches('input[type=range]')) gesto = true;
        }, { passive: true });
      });
      grid.addEventListener('input', function (e) {
        if (!gesto) return;
        if (!e.target.matches('input[type=range]')) return;
        var card = e.target.closest('.result-card');
        var cat = card ? card.dataset.cat : 'desconhecido';
        if (usados[cat]) return;
        usados[cat] = 1;
        enviar('usa_comparador', { procedimento: cat });
      });
    }

    var filtros = document.getElementById('filters');
    if (filtros) {
      filtros.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) enviar('filtro_resultados', { categoria: b.dataset.f || '(sem)' });
      });
    }

    if (!escolha) banner();
  });

  /* ---- 3. Banner de consentimento ---- */
  function banner() {
    var css = document.createElement('style');
    css.textContent =
      '.fv-consent{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:640px;margin:0 auto;' +
      'background:#141416;border:1px solid rgba(183,155,105,.28);border-radius:3px;padding:1.15rem 1.25rem;' +
      'box-shadow:0 18px 50px -20px rgba(0,0,0,.7);display:flex;flex-wrap:wrap;gap:.85rem 1.1rem;align-items:center;' +
      'font-family:Montserrat,Helvetica,Arial,sans-serif;animation:fvUp .4s ease}' +
      '@keyframes fvUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
      '.fv-consent p{margin:0;flex:1 1 300px;font-size:.8rem;line-height:1.6;color:#B7B0A2}' +
      '.fv-consent a{color:#D6C39A;text-decoration:underline}' +
      '.fv-consent .acoes{display:flex;gap:.6rem;flex:0 0 auto}' +
      '.fv-consent button{font-family:inherit;font-weight:600;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;' +
      'padding:.7rem 1.15rem;border-radius:2px;cursor:pointer;border:1px solid transparent;transition:all .3s ease}' +
      '.fv-consent .ok{background:#B79B69;color:#14100A}' +
      '.fv-consent .ok:hover{background:#D6C39A}' +
      '.fv-consent .no{background:transparent;color:#D6C39A;border-color:rgba(183,155,105,.4)}' +
      '.fv-consent .no:hover{border-color:#B79B69}' +
      '@media(max-width:560px){.fv-consent{bottom:auto;top:1rem}.fv-consent .acoes{width:100%}.fv-consent button{flex:1}}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.className = 'fv-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Aviso de privacidade');
    box.innerHTML =
      '<p>Usamos cookies para entender como o site é utilizado e melhorar sua experiência. ' +
      'Nenhum dado de saúde é coletado aqui. Veja a <a href="' + POLITICA + '">Política de Privacidade</a>.</p>' +
      '<div class="acoes">' +
      '<button type="button" class="no">Recusar</button>' +
      '<button type="button" class="ok">Aceitar</button>' +
      '</div>';
    document.body.appendChild(box);

    function decide(v) {
      grava(v);
      if (v === 'granted') gtag('consent', 'update', { analytics_storage: 'granted' });
      enviar('consentimento', { escolha: v });
      box.remove();
    }
    box.querySelector('.ok').addEventListener('click', function () { decide('granted'); });
    box.querySelector('.no').addEventListener('click', function () { decide('denied'); });
  }
})();
