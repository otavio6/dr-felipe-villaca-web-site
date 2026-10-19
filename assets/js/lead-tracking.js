/* Confirmed CRM receipts. No form answers or visitor data belong here. */
(function () {
  'use strict';
  var KEY = 'fvg-lead-receipt-v1';
  var sources = {
    home: { label: 'Página inicial', path: '/', campaign: 'institucional' },
    lp: { label: 'Página de avaliação', path: '/lp', campaign: 'institucional' },
    campanha: { label: 'Campanha pós-emagrecimento', path: '/campanha-excessodepele', campaign: 'pos-emagrecimento' },
    'campanha-eua': { label: 'Consulta online nos EUA', path: '/campanha', campaign: 'consulta-eua' }
  };
  function source(key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(sources, key) ? sources[key] : null; }
  function local() { return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
  function id() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function valid(r) {
    return r && Object.keys(r).sort().join(',') === 'createdAt,id,source,version' &&
      r.version === 1 && source(r.source) && typeof r.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.id) &&
      Number.isFinite(r.createdAt) && Date.now() >= r.createdAt && Date.now() - r.createdAt <= 1800000;
  }
  function emit(r, callback) {
    var s = source(r.source);
    try {
      if (typeof window.fvgConfirmedLead === 'function') window.fvgConfirmedLead(r.id, s.path);
    } catch (e) {}
    try {
      var event = { event: 'submit_lead', event_id: r.id, origem: r.source, pagina: s.path, campanha: s.campaign };
      if (callback) { event.eventCallback = callback; event.eventTimeout = 1500; }
      (window.dataLayer = window.dataLayer || []).push(event);
    } catch (e) {}
  }
  function confirmed(key) {
    if (!source(key)) return;
    var destination = '/obrigado?origem=' + encodeURIComponent(key);
    if (local()) { location.assign('/obrigado.html?preview=local&origem=' + encodeURIComponent(key)); return; }
    var r = { version: 1, id: id(), source: key, createdAt: Date.now() };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(r));
    } catch (e) {
      try { sessionStorage.removeItem(KEY); } catch (ignored) {}
      var navigated = false;
      function next() { if (!navigated) { navigated = true; location.assign(destination); } }
      setTimeout(next, 1500);
      emit(r, next);
      return;
    }
    location.assign(destination);
  }
  function consume() {
    var r;
    try {
      var raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      r = JSON.parse(raw);
    } catch (e) { return null; }
    if (local() || !valid(r)) return null;
    emit(r);
    return source(r.source);
  }
  function presentation() {
    var receiptSource = consume();
    if (receiptSource) return receiptSource;
    try { return source(new URLSearchParams(location.search).get('origem')); } catch (e) { return null; }
  }
  window.FVGLeadTracking = { confirmed: confirmed, consume: consume, presentation: presentation };
})();
