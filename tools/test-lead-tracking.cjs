const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const helper = fs.readFileSync('assets/js/lead-tracking.js', 'utf8');
function env(blocked = false, hostname = 'example.com') {
  const values = new Map(), timers = [], events = [], nav = [];
  const c = { console, URLSearchParams, Date, Math, JSON, Number, Object,
    location: { hostname, protocol: 'https:', pathname: '/test', search: '', href: 'https://example.com/test', assign: p => nav.push(p) },
    sessionStorage: { getItem(k) { if (blocked) throw Error(); return values.get(k) || null; }, setItem(k,v) { if (blocked) throw Error(); values.set(k,v); }, removeItem(k) { if (blocked) throw Error(); values.delete(k); } },
    setTimeout: f => timers.push(f), dataLayer: events };
  c.window = c; vm.createContext(c); vm.runInContext(helper,c);
  return {c, values, timers, events, nav};
}
const mappings = {home:'/', lp:'/lp', campanha:'/campanha-excessodepele', 'campanha-eua':'/campanha'};
for (const [key,path] of Object.entries(mappings)) {
  const e = env(); e.c.FVGLeadTracking.confirmed(key);
  assert.equal(e.events.length,0); assert.deepEqual(e.nav,['/obrigado?origem=' + key]);
  assert.equal(e.c.FVGLeadTracking.consume().path,path);
  assert.equal(e.events[0].origem,key); assert.equal(e.events[0].pagina,path);
  assert.deepEqual(Object.keys(e.events[0]).sort(),['campanha','event','event_id','origem','pagina']);
  assert.equal(e.c.FVGLeadTracking.consume(),null); assert.equal(e.events.length,1);
  e.c.FVGLeadTracking.confirmed('home'); e.c.FVGLeadTracking.consume();
  assert.equal(e.events.length,2); assert.notEqual(e.events[0].event_id,e.events[1].event_id);
}
assert.equal(env().c.FVGLeadTracking.consume(),null);
{
 const e=env();e.values.set('fvg-lead-receipt-v1','{bad json');
 assert.equal(e.c.FVGLeadTracking.consume(),null);assert.equal(e.values.size,0);
 const blocked=env(true);blocked.c.dataLayer={push(){throw Error('tracking blocked')}};
 assert.doesNotThrow(()=>blocked.c.FVGLeadTracking.confirmed('home'));
 blocked.timers.forEach(f=>f());assert.equal(blocked.nav.length,1);
}
for (const change of [r=>r.createdAt-=1800001,r=>r.createdAt+=60000,r=>r.source='__proto__',r=>r.source=['home'],r=>r.createdAt=String(r.createdAt),r=>r.id='bad',r=>r.version=2,r=>r.nome='private']) {
  const e=env(); e.c.FVGLeadTracking.confirmed('home'); const [k,v]=[...e.values][0]; const r=JSON.parse(v); change(r); e.values.set(k,JSON.stringify(r));
  assert.equal(e.c.FVGLeadTracking.consume(),null); assert.equal(e.values.size,0); assert.equal(e.events.length,0);
}
for (const callback of [true,false]) {
 const e=env(true); e.c.FVGLeadTracking.confirmed('lp'); assert.equal(e.events.length,1); assert.equal(e.nav.length,0);
 if(callback) e.events[0].eventCallback(); e.timers.forEach(f=>f()); assert.deepEqual(e.nav,['/obrigado?origem=lp']);
}
for (const [key,path] of Object.entries(mappings)) {
 const e=env(true); e.c.FVGLeadTracking.confirmed(key); e.timers.forEach(f=>f());
 const thankyou=env(true); thankyou.c.location.search=new URL('https://example.com'+e.nav[0]).search;
 assert.equal(thankyou.c.FVGLeadTracking.presentation().path,path); assert.equal(thankyou.events.length,0);
 const valid=env(); valid.c.FVGLeadTracking.confirmed(key); valid.c.location.search='?origem=invalid';
 assert.equal(valid.c.FVGLeadTracking.presentation().path,path); assert.equal(valid.events.length,1);
}
for(const query of ['?origem=__proto__','?origem=https://evil.test','?origem=constructor','']) {
 const e=env(); e.c.location.search=query; assert.equal(e.c.FVGLeadTracking.presentation(),null); assert.equal(e.events.length,0);
}
const labels = {home:'Página inicial',lp:'Página de avaliação',campanha:'Campanha pós-emagrecimento','campanha-eua':'Consulta online nos EUA'};
const thankYouInline = [...fs.readFileSync('obrigado.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
function initializeThankYou(e) {
 const nodes = {'source-label':{textContent:''},'return-link':{href:'/'}};
 e.c.document = Object.assign(e.c.document || {}, {getElementById:id=>nodes[id]});
 vm.runInContext(thankYouInline,e.c);
 return nodes;
}
for (const [key,path] of Object.entries(mappings)) {
 const preview=env(false,'localhost'); preview.c.FVGLeadTracking.confirmed(key);
 assert.equal(preview.events.length,0); assert.equal(preview.values.size,0);
 assert.equal(preview.nav[0],'/obrigado.html?preview=local&origem='+key);
 preview.c.location.search=new URL('https://example.com'+preview.nav[0]).search;
 const previewNodes=initializeThankYou(preview);
 assert.equal(previewNodes['source-label'].textContent,'Origem: '+labels[key]);
 assert.equal(previewNodes['return-link'].href,path); assert.equal(preview.events.length,0);
 for (const missingHelper of [false,true]) {
  const e=env();e.c.FVGLeadTracking.confirmed(key);
  // A valid receipt overrides a conflicting, valid query source.
  e.c.location.search='?origem='+(missingHelper?key:key==='home'?'lp':'home');
  if(missingHelper) e.c.FVGLeadTracking = undefined;
  const nodes=initializeThankYou(e);
  assert.equal(nodes['source-label'].textContent,'Origem: '+labels[key]);
  assert.equal(nodes['return-link'].href,path);
  assert.equal(e.events.length,missingHelper?0:1);
  e.c.location.search='?origem='+key;
  const refreshed=initializeThankYou(e);
  assert.equal(refreshed['source-label'].textContent,'Origem: '+labels[key]);
  assert.equal(refreshed['return-link'].href,path);
  assert.equal(e.events.length,missingHelper?0:1);
 }
 const blocked=env(true);blocked.c.location.search='?origem='+key;
 const nodes=initializeThankYou(blocked);
 assert.equal(nodes['source-label'].textContent,'Origem: '+labels[key]);
 assert.equal(nodes['return-link'].href,path);assert.equal(blocked.events.length,0);
}
for (const missingHelper of [false,true]) for(const query of ['', '?origem=__proto__','?origem=https://evil.test','?origem=constructor']) {
 const e=env(); e.c.location.search=query;if(missingHelper)e.c.FVGLeadTracking = undefined;
 const nodes=initializeThankYou(e);
 assert.equal(nodes['source-label'].textContent,'');assert.equal(nodes['return-link'].href,'/');assert.equal(e.events.length,0);
}
// Execute each actual submit callback, preserving its validation/payload/error code.
async function formTest(file,key,ok,received,blocked=false,invalid=false) {
 const html=fs.readFileSync(file,'utf8'); const e=env(blocked); let listener;
 const button={textContent:'Enviar',innerHTML:'Enviar'}, status={textContent:''};
 const data={nome:invalid?'x':'Maria Silva',zap:file==='eua.html'?'12125551234':'31987654321',cidade:'Cidade',modalidade:'Online'};
 const form={elements:{nome:{value:data.nome},zap:{value:data.zap}},reportValidity:()=>!invalid,querySelector:()=>button,addEventListener:(_,fn)=>listener=fn};
 Object.assign(e.c,{alert:()=>{},formStatus:status,submitButton:button,campaignForm:form,leadForm:form,campaignLocation:null,usLocation:null,
 document:{getElementById:id=>id==='leadForm'?form:{value:'Estado'}},
 FormData:class {entries(){return Object.entries(data)}get(k){return data[k]}},fetch:async(url,opts)=>{assert.equal(url,'/api/leads'); if(ok==='network') throw Error('network'); const payload=JSON.parse(opts.body); assert.ok(payload.nome); if(file==='lp.html')assert.equal(payload.pagina,'/test');return {ok,json:async()=>({recebido:received})};}});
 const marker=file==='index.html'||file==='lp.html'?"document.getElementById('leadForm').addEventListener('submit'":file==='campanha.html'?"campaignForm.addEventListener('submit'":"leadForm.addEventListener('submit'";
 const start=html.indexOf(marker);
 const closing=file==='index.html'?'\n});':file==='campanha.html'?'\n      });':'\n    });';
 assert.ok(start>=0, 'submit handler must exist');
 const end=html.indexOf(closing,start)+closing.length;
 vm.runInContext(html.slice(start,end),e.c);
 await listener({preventDefault(){},currentTarget:form});
 if(invalid){assert.equal(e.nav.length,0);assert.equal(e.events.length,0);assert.equal(e.values.size,0);return e;}
 if(ok===true&&received===true){if(blocked){assert.equal(e.events.length,1);e.timers.forEach(f=>f());assert.equal(e.nav.length,1);}else{assert.equal(e.nav.length,1);assert.equal(e.c.FVGLeadTracking.consume().path,mappings[key]);assert.equal(e.events.length,1);}}else{assert.equal(e.nav.length,0);assert.equal(e.values.size,0);assert.equal(e.events.length,0);assert.equal(button.disabled,false);
 // Retry the same handler after rejection, without a session-wide suppression flag.
 e.c.fetch=async()=>({ok:true,json:async()=>({recebido:true})});
 await listener({preventDefault(){},currentTarget:form});
 assert.equal(e.c.FVGLeadTracking.consume().path,mappings[key]); assert.equal(e.events.length,1);
 }
 return e;
}
// Execute helper and analytics together after an earlier WhatsApp conversion.
for (const [key,path] of Object.entries(mappings)) {
 const e=env(); const listeners={},calls=[];
 Object.assign(e.c,{localStorage:{getItem:()=>null},document:{cookie:'',addEventListener:(name,fn)=>listeners[name]=fn},fetch:(url,options)=>{assert.equal(url,'/api/conversao');calls.push(JSON.parse(options.body));return Promise.resolve();}});
 vm.runInContext(fs.readFileSync('assets/js/analytics.js','utf8'),e.c);
 const wa={closest:()=>null,classList:{contains:()=>false}};
 listeners.click({target:{closest:()=>wa}});listeners.click({target:{closest:()=>wa}});
 assert.equal(calls.length,1);
 e.c.FVGLeadTracking.confirmed(key);
 e.c.location.pathname='/obrigado';e.c.location.search='?origem='+key;
 const nodes=initializeThankYou(e);
 const events=e.events.filter(x=>x.event==='submit_lead');
 assert.equal(events.length,1);assert.equal(calls.length,2);
 assert.equal(calls[1].id,events[0].event_id);assert.equal(calls[1].pagina,events[0].pagina);
 assert.equal(calls[1].pagina,path);assert.equal(nodes['return-link'].href,path);
 assert.equal(e.c.FVGLeadTracking.consume(),null);
 initializeThankYou(e);
 assert.equal(calls.length,2);assert.equal(e.events.filter(x=>x.event==='submit_lead').length,1);
 assert.equal(listeners.submit,undefined);
}
(async()=>{
 for(const [file,key] of [['index.html','home'],['lp.html','lp'],['campanha.html','campanha'],['eua.html','campanha-eua']]) {
  await formTest(file,key,true,true); await formTest(file,key,false,true); await formTest(file,key,true,false); await formTest(file,key,true,'true'); await formTest(file,key,'network',false); await formTest(file,key,true,true,true); await formTest(file,key,true,true,false,true);
 }
 // All inline scripts must remain syntactically valid.
 for(const file of ['index.html','lp.html','campanha.html','eua.html','obrigado.html']) {
  const html=fs.readFileSync(file,'utf8');
  const helperIndex=html.indexOf('<script src="/assets/js/lead-tracking.js"');
  if(file!=='obrigado.html') {
   assert.ok(helperIndex>html.indexOf('<head>')&&helperIndex<html.indexOf('</head>'));
   assert.match(html.slice(helperIndex,html.indexOf('>',helperIndex)+1), /\bdefer\b/);
  }
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) if(!/type="application\/ld\+json"/.test(m[1])) new vm.Script(m[2]);
 }
 console.log('PASS: receipt matrix, all four actual form handlers, CRM rejection, payload privacy and inline syntax');
})().catch(e=>{console.error(e);process.exitCode=1});
