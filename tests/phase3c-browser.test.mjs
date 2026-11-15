import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}catch {/* Required by CI. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css','mobile-ux.css',
  'service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const KEY='disaster-management:v1';
// CI generates its own harmless bitmap; no personal photo reaches the runner.
const oldV1={version:1,page:'incident',tourStep:0,tourDone:true,
  profile:{home:'Old HOME, NOT current',office:'Old workplace',shelter:'Old shelter',safePlace:'Old meeting place'},
  checks:{water:true,contacts:false},contacts:[{name:'Primary',phone:'+819011112222'}],
  incident:{active:true,step:7,done:{2:[0]},contacted:[0],note:'Keep prior incident note'},
  departure:{wallet:true,pass:false,phone:true,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  logs:[{date:'Old',title:'Historical event',note:'Preserved prior history'}],rules:[{title:'Prior rule',trigger:'Manual',date:'Old'}]};

test('Phase 3C: local photo evidence, v1 backup, offline rehearsal and no inferred emergency actions', {timeout:160000},async t=>{
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
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[],externalRequests=[];
  page.on('pageerror',err=>errors.push(String(err)));
  page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:')&&!req.url().startsWith('data:')&&!req.url().startsWith('blob:'))externalRequests.push(req.url());});
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const record=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  const shot=async filename=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,filename),fullPage:true});
  };
  const noOverflow=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:844});
      const dimensions=await page.evaluate(()=>({visible:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      assert.ok(dimensions.content<=dimensions.visible+1,'Horizontal overflow at '+width+': '+JSON.stringify(dimensions));
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.addInitScript(({key,entry})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(entry));},{key:KEY,entry:oldV1});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Private follow-up evidence'}).waitFor();
  assert.match(await page.locator('.p3c-evidence-warning').innerText(),/not an official damage assessment/);
  assert.equal((await record()).version,1);
  await shot('step7-empty-375.png');await noOverflow();

  await page.locator('#p3c-evidence-note').fill('My observed damage AFTER reaching a safe place');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#p3c-evidence-note').inputValue(),'My observed damage AFTER reaching a safe place');
  const png=Buffer.from(await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f40';ctx.fillRect(0,0,10,10);
    return canvas.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.locator('#p3c-photo-file').setInputFiles({name:'secret-coordinates.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).evidence?.draft?.photos?.length===1,KEY);
  const draft=await record();
  assert.match(draft.evidence.draft.photos[0].image,/^data:image\/jpeg;base64,/);
  assert.ok(draft.evidence.draft.photos[0].width<=960);
  assert.doesNotMatch(JSON.stringify(draft),/secret-coordinates\.png|EXIF|GPS/);
  assert.equal(draft.logs[0].note,'Preserved prior history');
  await shot('photo-draft-375.png');await noOverflow();
  await page.locator('[data-action="evidence-save"]').click();
  assert.equal((await record()).evidence.entries.length,1);
  assert.equal((await record()).evidence.draft.photos.length,0);
  await page.locator('[data-action="finish-incident"]').click();
  const afterGuide=await record();
  assert.equal(afterGuide.incident.active,false);
  assert.equal(afterGuide.evidence.entries.length,1);
  assert.equal(afterGuide.checks.water,true);
  assert.equal(afterGuide.contacts[0].name,'Primary');
  assert.equal(afterGuide.logs.at(-1).note,'Preserved prior history');
  await page.getByRole('heading',{name:'Saved observations'}).waitFor();
  await shot('saved-evidence-log-375.png');await noOverflow();

  // The existing v1 JSON export must carry actual compressed photos.
  // Settings is in the sidebar (hidden visually on narrow phones), but still
  // reachable through the app's own navigation event. No native device action.
  await page.evaluate(()=>document.querySelector('button[data-action="go"][data-page="settings"]')?.click());
  await page.locator('#p1c-data').waitFor();
  const downloadEvent=page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const download=await downloadEvent;
  const exported=readFileSync(await download.path(),'utf8');
  assert.equal(JSON.parse(exported).evidence.entries.length,1);
  assert.equal(JSON.parse(exported).evidence.entries[0].photos.length,1);

  await page.locator('.bottom-nav [data-page="log"]').click();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-action="evidence-delete"]').click();
  assert.equal((await record()).evidence.entries.length,1);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="evidence-delete"]').click();
  assert.equal((await record()).evidence.entries.length,0);
  await page.evaluate(()=>document.querySelector('button[data-action="go"][data-page="settings"]')?.click());
  await page.locator('#import-json').setInputFiles({name:'old-v1-with-photo.json',mimeType:'application/json',buffer:Buffer.from(exported)});
  assert.match(await page.locator('#p2c-import-preview').innerText(),/1 evidence records \+ 1 photos/);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="apply-import"]').click();
  assert.equal((await record()).evidence.entries.length,1);
  assert.equal((await record()).evidence.entries[0].photos.length,1);

  // Rehearsal: offline cold reload after install; unrelated app cache survives.
  await page.evaluate(async()=>{const other=await caches.open('kg-chart-offline-v1');await other.put(location.origin+'/KG_chart_new/index.html',new Response('other app'));});
  await page.evaluate(async()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  const caches=await page.evaluate(()=>caches.keys());
  assert.ok(caches.includes('disaster-management-app-v13'));
  assert.ok(caches.includes('kg-chart-offline-v1'));
  await page.evaluate(()=>document.querySelector('button[data-action="go"][data-page="log"]')?.click());
  assert.match(await page.locator('.p3c-records').innerText(),/Self-reported observation/);
  assert.equal((await record()).evidence.entries[0].photos.length,1);
  await shot('offline-evidence-375.png');await noOverflow();

  // Scenario matrix is a browser rehearsal, never an actual emergency call.
  await page.evaluate(key=>{
    const r=JSON.parse(localStorage.getItem(key));
    r.contacts=[];r.incident={active:true,step:3,done:{2:[0]},contacted:[],note:'Interrupted with no contacts'};
    r.page='incident';localStorage.setItem(key,JSON.stringify(r));
  },KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('.p3b-communication').innerText(),/No contacts saved/);
  assert.doesNotMatch(await page.locator('#p3b-message-preview').innerText(),/Old HOME|Old meeting/);
  await page.locator('[data-action="incident-step"][data-step="4"]').click();
  assert.match(await page.locator('.incident-step-card').first().innerText(),/Tsunami status: UNKNOWN/);
  assert.match(await page.locator('.incident-step-card').first().innerText(),/Serious structural damage/);
  await page.locator('[data-action="go"][data-page="watch"]').last().click();
  await page.reload({waitUntil:'domcontentloaded'});
  assert.match(await page.locator('.p3a-resume').innerText(),/Resume earthquake guide/);
  await page.locator('.p3a-resume [data-page="incident"]').click();
  await page.locator('[data-action="incident-step"][data-step="1"]').click();
  assert.equal(await page.locator('.p1b-call-primary').getAttribute('href'),'tel:119');
  assert.equal(await page.locator('.p1b-call-secondary').getAttribute('href'),'tel:110');
  assert.match(await page.locator('.p1b-phone-script').innerText(),/NOT assumed to be your current position/);
  assert.equal((await record()).evidence.entries.length,1);
  assert.deepEqual(errors,[]);
  assert.deepEqual(externalRequests,[]);
});
