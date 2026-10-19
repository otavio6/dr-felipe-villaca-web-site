const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
const root=path.resolve(__dirname,'..'),host='https://fvg.test';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
for(const [url,key,formId] of [['/','home','leadForm'],['/lp','lp','leadForm'],['/campanha-excessodepele','campanha','campaign-form'],['/campanha','campanha-eua','lead-form']]){
const ctx=await browser.newContext();
await ctx.addInitScript(()=>{window.__events=[];const a=[];a.push=function(...items){for(const item of items)if(item.event==='submit_lead')window.__events.push(item);return Array.prototype.push.apply(this,items)};window.dataLayer=a;});
let posts=0;
await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==host)return route.abort();if(u.pathname==='/api/leads'){posts++;return route.fulfill({status:201,contentType:'application/json',body:'{"recebido":true}'});}if(u.pathname==='/api/conversao')return route.fulfill({status:200,body:'{}'});if(u.pathname.endsWith('location-selector.js'))return route.fulfill({body:''});const aliases={'/':'index.html','/lp':'lp.html','/campanha-excessodepele':'campanha.html','/campanha':'eua.html','/obrigado':'obrigado.html'};const file=path.join(root,aliases[u.pathname]||u.pathname);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
const p=await ctx.newPage();await p.goto(host+url);await p.evaluate(id=>{const f=document.getElementById(id);for(const el of f.elements){if(el.name==='nome')el.value='Maria Oliveira';else if(el.name==='zap')el.value=id==='lead-form'?'12125551234':'31987654321';else if(el.tagName==='SELECT')el.selectedIndex=[...el.options].findIndex(o=>o.value&&!o.disabled);else if(el.type==='radio'){if(!f.querySelector('input[name="'+el.name+'"]:checked'))el.checked=true;}else if(el.name==='cidade')el.value='Belo Horizonte';}f.requestSubmit();},formId);
await p.waitForURL('**/obrigado*');assert.equal(posts,1);const events=await p.evaluate(()=>window.__events);assert.equal(events.length,1);assert.equal(events[0].origem,key);assert.equal(await p.locator('#return-link').getAttribute('href'),url);assert.ok(await p.locator('#source-label').textContent());await p.reload();assert.equal((await p.evaluate(()=>window.__events)).length,0);
for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await p.screenshot({path:'/tmp/fvg-thank-you-'+key+'.png'});await ctx.close();console.log('PASS browser '+key+' confirmed source, refresh, responsive');
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
