import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* Browser install is CI-required, local optional. */}

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css',
  'service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const KEY='disaster-management:v1',SLOT='disaster-management:preimport:v1';
const initial={version:1,page:'settings',tourDone:true,tourStep:0,
  profile:{home:'My private home',office:'Office',shelter:'Community gym',shelterSource:'Municipality',safePlace:'Library',station:'Station'},
  checks:{water:true,cash:true,food:true},
  readiness:{items:{water:{quantity:9,target:9,unit:'L',expiry:'2027-04-15',reviewedAt:'2026-11-15'}},
    custom:[{id:'custom-2',title:'Prescription glasses',checked:true,quantity:1,target:1}],nextCustomId:3,embassy:{status:'registered'}},
  contacts:[{name:'Emergency sibling',phone:'+819012345678',role:'primary'}],
  incident:{active:false,step:1,done:{},contacted:[],note:'Sensitive note'},
  departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  logs:[{date:'Earlier',title:'Old log',note:'My private log'}],rules:[{title:'Old rule',trigger:'Manual',date:'Earlier'}]};

test('Phase 2C: explicit browser permissions, preview/undo, encrypted import and real offline mobile UI',{timeout:180000},async t=>{
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
  try {
    const options={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))options.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(options);
  } catch(err) {
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))return t.skip('Local Chromium unavailable; required in CI.');
    throw err;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,acceptDownloads:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[],externalRequests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url='http://127.0.0.1:'+server.address().port+prefix;
  page.on('request',request=>{if(!request.url().startsWith(url))externalRequests.push(request.url());});
  const screenshot=async name=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const noOverflow=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:844});
      const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(dimensions.scroll<=dimensions.client+1,'Horizontal overflow at '+width+': '+JSON.stringify(dimensions));
    }
    await page.setViewportSize({width:375,height:844});
  };

  await page.addInitScript(({key,record})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(record));
    window.__phase2cCalls={location:0,persist:0};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){
      window.__phase2cCalls.location++;success({coords:{latitude:35.7,longitude:139.7}});
    }}});
    Object.defineProperty(navigator,'storage',{configurable:true,value:{persisted:async()=>false,persist:async()=>{
      window.__phase2cCalls.persist++;return true;
    }}});
  },{key:KEY,record:initial});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__phase2cCalls),{location:0,persist:0});
  assert.match(await page.locator('#p1c-privacy').innerText(),/No account, cloud synchronization or background tracking is connected/);
  assert.match(await page.locator('#p1c-data').innerText(),/Not connected/);
  await screenshot('privacy-and-backups-375.png');await noOverflow();

  await page.getByRole('button',{name:'Check browser status'}).click();
  await page.locator('[data-permission-status="location"]').waitFor();
  assert.equal(await page.evaluate(()=>window.__phase2cCalls.location),0,'Checking status must not prompt geolocation');
  await page.getByRole('button',{name:'Test location once'}).click();
  await page.getByText(/Available now; coordinates discarded/).waitFor();
  assert.equal(await page.evaluate(()=>window.__phase2cCalls.location),1);
  assert.doesNotMatch(await page.evaluate(()=>localStorage.getItem('disaster-management:v1')),/139\.7|35\.7/);
  await page.getByRole('button',{name:'Request protected storage'}).click();
  await page.getByText('Persistent storage granted').waitFor();
  assert.equal(await page.evaluate(()=>window.__phase2cCalls.persist),1);

  const originalRaw=await page.evaluate(key=>localStorage.getItem(key),KEY);
  const replacement={...initial,profile:{...initial.profile,home:'Imported home'},contacts:[{name:'Imported friend',phone:'+819022223333',role:'backup'}]};
  await page.locator('#import-json').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
  await page.getByRole('heading',{name:'Review before replacing records'}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),originalRaw);
  await screenshot('restore-preview-375.png');await noOverflow();
  await page.getByRole('button',{name:'Cancel'}).click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),originalRaw);
  await page.locator('#import-json').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replacement))});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Replace records with this backup'}).click();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profile.home,KEY),'Imported home');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SLOT),originalRaw);
  await page.getByRole('button',{name:'Review previous local copy'}).click();
  await page.getByRole('heading',{name:'Review before replacing records'}).waitFor();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Replace records with this backup'}).click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),originalRaw);

  const password='a private passphrase with spaces 2026';
  await page.locator('#p2c-export-password').fill(password);
  await page.locator('#p2c-export-confirm').fill(password);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export encrypted backup'}).click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'disaster-management-encrypted-backup.json');
  const encryptedText=readFileSync(await download.path(),'utf8');
  const envelope=JSON.parse(encryptedText);
  assert.equal(envelope.format,'disaster-management-encrypted');
  assert.equal(envelope.kdf.iterations,600000);
  assert.doesNotMatch(encryptedText,/My private home|Emergency sibling|Sensitive note/);

  await page.evaluate(key=>{const record=JSON.parse(localStorage.getItem(key));record.profile.home='Changed after export';localStorage.setItem(key,JSON.stringify(record));},KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#import-json').setInputFiles({name:'protected.json',mimeType:'application/json',buffer:Buffer.from(encryptedText)});
  await page.getByRole('heading',{name:'Unlock encrypted backup'}).waitFor();
  await page.locator('#p2c-unlock-password').fill('wrong password 123');
  await page.getByRole('button',{name:'Unlock and preview'}).click();
  await page.getByRole('status').filter({hasText:'Wrong password'}).waitFor();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profile.home,KEY),'Changed after export');
  await page.locator('#p2c-unlock-password').fill(password);
  await page.getByRole('button',{name:'Unlock and preview'}).click();
  await page.getByRole('heading',{name:'Review before replacing records'}).waitFor({timeout:20000});
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profile.home,KEY),'Changed after export');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Replace records with this backup'}).click();
  const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(restored.profile.home,'My private home');
  assert.equal(restored.readiness.items.water.quantity,9);
  assert.equal(restored.readiness.custom[0].title,'Prescription glasses');
  assert.equal(restored.contacts[0].name,'Emergency sibling');
  await screenshot('encrypted-import-done-375.png');await noOverflow();

  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  const offline=await page.evaluate(async()=>({caches:await caches.keys(),record:JSON.parse(localStorage.getItem('disaster-management:v1'))}));
  assert.ok(offline.caches.includes('disaster-management-app-v10'));
  assert.equal(offline.record.readiness.custom[0].title,'Prescription glasses');
  assert.equal(offline.record.logs[0].note,'My private log');
  await screenshot('phase2c-offline-375.png');await noOverflow();
  assert.deepEqual(externalRequests,[]);
  assert.deepEqual(errors,[]);
});
