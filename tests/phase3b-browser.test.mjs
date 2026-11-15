import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}catch {/* Chromium mandatory in CI. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css',
  'service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const KEY='disaster-management:v1';
const legacy={version:1,page:'watch',tourStep:0,tourDone:true,
  profile:{home:'Historic home — NOT CURRENT',safePlace:'Old safe place',office:'Old office',shelter:'Old shelter'},
  checks:{water:true,contacts:true},contacts:[{name:'Primary',phone:'+819011112222',role:'primary'},{name:'Backup',phone:'+819033334444',role:'backup'}],
  incident:{active:false,step:1,done:{2:[0]},contacted:[0],note:'Prior note'},
  departure:{wallet:true,pass:false,phone:false,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  logs:[{date:'Old',title:'Earlier log',note:'Preserve me'}],rules:[{title:'Earlier rule',trigger:'Manual',date:'Old'}]};

test('Phase 3B: bilingual previews, priority SMS, interrupted drafts, old v1 and offline', {timeout:150000},async t=>{
  if(!chromium){if(process.env.REQUIRE_BROWSER==='1')throw new Error('Playwright required in CI.');return t.skip('Playwright unavailable.');}
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    const name=path===prefix?'index.html':path.startsWith(prefix)?path.slice(prefix.length):'';
    if(!files.has(name)){res.writeHead(404);res.end('Not found');return;}
    try {res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(join(root,name)));}
    catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  let browser;
  try{
    const opts={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))opts.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(opts);
  }catch(err){
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))return t.skip('Local Chromium unavailable.');
    throw err;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const screenshot=async filename=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,filename),fullPage:true});
  };
  const noOverflow=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:844});
      const metrics=await page.evaluate(()=>({visible:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      assert.ok(metrics.content<=metrics.visible+1,'Horizontal overflow at '+width+': '+JSON.stringify(metrics));
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.addInitScript(({key,record})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(record));
  },{key:KEY,record:legacy});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.mobile-top [data-page="incident"]').click();
  await page.locator('[data-action="incident-step"][data-step="3"]').click();
  await page.getByRole('heading',{name:'Emergency messages · 緊急連絡'}).waitFor();
  assert.match(await page.locator('#p3b-message-preview').innerText(),/Please let me know if you are safe/);
  assert.match(await page.locator('#p3b-message-preview').innerText(),/無事かどうか教えてください/);
  assert.doesNotMatch(await page.locator('#p3b-message-preview').innerText(),/Historic home|Old safe place/);
  assert.match(await page.locator('.p3b-recipient').first().innerText(),/Reached ✓ \(manual\)/);
  await screenshot('neutral-queue-375.png');await noOverflow();

  await page.locator('[data-communication-template="safe"]').check();
  await page.locator('#sms-current-location').fill('Current station exit confirmed by me');
  await page.locator('[data-communication-language="ja"]').check();
  assert.match(await page.locator('#p3b-message-preview').innerText(),/今は無事です/);
  assert.match(await page.locator('#p3b-message-preview').innerText(),/Current station exit confirmed by me/);
  assert.doesNotMatch(await page.locator('#p3b-message-preview').innerText(),/Historic home/);
  await page.locator('[data-communication-language="both"]').check();

  const ids=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).contacts.map(c=>c.id),KEY);
  await page.locator('[data-action="communication-select"][data-id="'+ids[1]+'"]').click();
  await page.locator('[data-action="communication-select"][data-id="'+ids[0]+'"]').click();
  assert.match(await page.locator('.p3b-queue').innerText(),/Next by priority: Primary/);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-action="communication-next"]').click();
  let record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(record.incident.communication.pendingId,'');
  assert.equal(record.incident.communication.entries[ids[0]].status,'unsent');

  // Native sms: is an OS handoff, so browser automation checks the persisted
  // state after a manually accepted request; it cannot verify an SMS app.
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="communication-next"]').click();
  record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(record.incident.communication.pendingId,ids[0]);
  assert.equal(record.incident.communication.entries[ids[0]].status,'unsent');
  assert.match(await page.locator('.p3b-pending').innerText(),/outcome NOT verified/);
  await screenshot('draft-request-pending-375.png');await noOverflow();

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.p3b-pending').waitFor();
  assert.match(await page.locator('.p3b-pending').innerText(),/Draft requested for Primary/);
  await page.locator('[data-action="communication-confirm-open"]').click();
  assert.match(await page.locator('.p3b-recipient').first().innerText(),/Draft opened · user-reported/);
  record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(record.incident.communication.entries[ids[0]].status,'draft-opened');
  assert.equal(record.logs[0].note,'Preserve me');
  await screenshot('draft-opened-375.png');

  // Simulate an interrupted second SMS request from persisted v1 state,
  // without assuming any browser/OS handoff succeeded.
  await page.evaluate(({key,id})=>{
    const record=JSON.parse(localStorage.getItem(key));
    record.incident.communication.pendingId=id;
    record.incident.communication.entries[id]={name:'Backup',phone:'+819033334444',status:'unsent',requestedAt:new Date().toISOString(),openedAt:'',confirmedAt:'',skipped:false};
    localStorage.setItem(key,JSON.stringify(record));
  },{key:KEY,id:ids[1]});
  await page.reload({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('.p3b-pending').innerText(),/Backup/);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.p3b-pending [data-action="communication-confirm-sent"]').click();
  record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(record.incident.communication.entries[ids[1]].status,'user-confirmed-sent');
  assert.match(await page.locator('.p3b-recipient').nth(1).innerText(),/delivery UNKNOWN/);
  assert.equal(record.logs[0].title,'SMS send reported by user');
  assert.match(record.logs[0].note,/Delivery and receipt remain unknown/);
  await screenshot('sent-reported-375.png');await noOverflow();

  await page.evaluate(async()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('#p3b-message-preview').waitFor();
  assert.match(await page.locator('.p3b-recipient').nth(1).innerText(),/delivery UNKNOWN/);
  const after=await page.evaluate(async()=>({caches:await caches.keys(),record:JSON.parse(localStorage.getItem('disaster-management:v1'))}));
  assert.ok(after.caches.includes('disaster-management-app-v12'));
  assert.equal(after.record.version,1);
  assert.equal(after.record.profile.home,'Historic home — NOT CURRENT');
  assert.equal(after.record.logs.at(-1).note,'Preserve me');
  assert.equal(after.record.incident.done['2'][0],0);
  assert.equal(after.record.incident.communication.entries[ids[0]].status,'draft-opened');
  await screenshot('offline-sms-375.png');await noOverflow();
  assert.deepEqual(errors,[]);
});
