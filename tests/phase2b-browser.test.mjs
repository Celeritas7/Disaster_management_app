import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* Browser dependency is installed in CI; local skip only if optional. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css','service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const todayJST=days=>new Date(Date.now()+9*3600000+days*86400000).toISOString().slice(0,10);

test('Phase 2B inventory, legacy checks, real mobile controls, backup and offline restore', {timeout:180000},async t=>{
  if(!chromium){if(process.env.REQUIRE_BROWSER==='1')throw new Error('Playwright unavailable.');return t.skip('Playwright unavailable locally.');}
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    const name=path===prefix?'index.html':path.startsWith(prefix)?path.slice(prefix.length):'';
    if(!files.has(name)){res.writeHead(404);res.end('Not found');return;}
    try{res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(join(root,name)));}
    catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  let browser;
  try{
    const options={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))options.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(options);
  }catch(err){
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))return t.skip('Local Chromium unavailable.');
    throw err;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,acceptDownloads:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const screenshot=async name=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const noOverflow=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:844});
      const box=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(box.scroll<=box.client+1,'Horizontal overflow at '+width+': '+JSON.stringify(box));
    }
    await page.setViewportSize({width:375,height:844});
  };
  // An actual Phase 2A v1 record: old flags, no inventory metadata.
  const old={version:1,page:'readiness',tourDone:true,tourStep:0,profile:{home:'Saitama home',office:'Office',safePlace:'Library',station:'Station',shelter:'School',shelterSource:'Municipality'},
    checks:{water:true,cash:true,food:true,contacts:true},contacts:[{name:'Sibling',phone:'+819012345678',role:'backup'}],
    incident:{active:false,step:1,done:{},contacted:[],note:'Old note'},departure:{wallet:false,pass:false,phone:false,keys:false},
    strandedStep:0,night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    logs:[{date:'Earlier',title:'Old log',note:'Keep me'}],rules:[{title:'Old rule',trigger:'Before leaving',date:'Earlier'}]};
  await page.addInitScript(({KEY,value})=>{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(value));},{KEY:'disaster-management:v1',value:old});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'A kit you can actually review.'}).waitFor();
  assert.equal(await page.locator('.subsection .p2b-inventory-item').count(),14);
  assert.match(await page.locator('.p1a-readiness-overview').innerText(),/2 \/ 14 counted · 4 marked by you/);
  assert.match(await page.locator('#readiness-water').innerText(),/Target \/ amount unknown/);
  await screenshot('legacy-core-375.png');await noOverflow();

  const water=page.locator('#details-water');
  await water.locator('summary').click();
  await water.locator('#inventory-quantity-water').fill('9');
  await water.locator('#inventory-target-water').fill('9');
  await water.getByRole('button',{name:'Save details'}).click();
  assert.match(await page.locator('#readiness-water').innerText(),/Recheck after editing/);
  await water.getByRole('button',{name:'I checked this item today'}).click();
  assert.match(await page.locator('.p1a-readiness-overview').innerText(),/3 \/ 14 counted · 4 marked by you/);
  await screenshot('water-target-375.png');

  await water.locator('#inventory-expiry-water').fill(todayJST(-1));
  await water.getByRole('button',{name:'Save details'}).click();
  assert.match(await page.locator('#readiness-water').innerText(),/Expired · user-entered/);
  assert.match(await page.locator('.p1a-readiness-overview').innerText(),/2 \/ 14 counted/);
  await water.locator('#inventory-expiry-water').fill(todayJST(30));
  await water.locator('#inventory-reviewDue-water').fill(todayJST(20));
  await water.getByRole('button',{name:'Save details'}).click();
  await water.getByRole('button',{name:'I checked this item today'}).click();
  assert.match(await page.locator('.p1a-readiness-overview').innerText(),/3 \/ 14 counted/);

  await page.locator('#custom-inventory-title').fill('Prescription glasses');
  await page.locator('#custom-inventory-note').fill('Carry spare glasses');
  await page.getByRole('button',{name:'Add extra item'}).click();
  assert.match(await page.locator('.p2b-custom-section').innerText(),/Prescription glasses/);
  assert.match(await page.locator('.p1a-readiness-overview').innerText(),/3 \/ 14 counted/);
  await page.locator('#embassy-status').selectOption('not-applicable');
  await page.getByRole('button',{name:'Save my status'}).click();
  await screenshot('extra-and-embassy-375.png');await noOverflow();

  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(before.checks.water,true);
  assert.equal(before.checks.cash,true);
  assert.equal(before.readiness.items.water.quantity,9);
  assert.equal(before.readiness.custom[0].title,'Prescription glasses');
  assert.equal(before.readiness.embassy.status,'not-applicable');
  assert.equal(before.contacts[0].name,'Sibling');

  await page.locator('#main-content [data-action="go"][data-page="settings"]').click();
  const backupPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON backup'}).click();
  const downloaded=await backupPromise;
  assert.equal(downloaded.suggestedFilename(),'disaster-management-backup.json');
  // Importing this new nested metadata must preserve it after a separate on-device edit.
  await page.evaluate(()=>{const key='disaster-management:v1',record=JSON.parse(localStorage.getItem(key));record.readiness.custom=[];localStorage.setItem(key,JSON.stringify(record));});
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-json').setInputFiles({name:'phase2b-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});
  await page.getByRole('button',{name:'Replace records with this backup'}).click();
  await page.locator('.bottom-nav [data-page="readiness"]').click();
  assert.match(await page.locator('.p2b-custom-section').innerText(),/Prescription glasses/);

  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByRole('heading',{name:'A kit you can actually review.'}).waitFor();
  const offline=await page.evaluate(async()=>({caches:await caches.keys(),record:JSON.parse(localStorage.getItem('disaster-management:v1'))}));
  assert.ok(offline.caches.includes('disaster-management-app-v12'));
  assert.equal(offline.record.readiness.custom[0].title,'Prescription glasses');
  assert.equal(offline.record.readiness.items.water.quantity,9);
  assert.equal(offline.record.logs[0].note,'Keep me');
  await noOverflow();assert.deepEqual(errors,[]);
});
