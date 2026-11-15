import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));} catch {/* CI requires Playwright. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css',
  'service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const KEY='disaster-management:v1';
const legacy={version:1,page:'watch',tourStep:0,tourDone:true,
  profile:{home:'Saved home; may be elsewhere',office:'Office',shelter:'Community gym',safePlace:'',station:'Station',shelterSource:'City'},
  checks:{water:true},contacts:[{name:'Family',phone:'+819011112222',role:'primary'}],
  incident:{active:false,step:1,done:{2:[0]},contacted:[],note:'Original private note'},
  departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  logs:[{date:'Before',title:'Old log',note:'Keep me'}],rules:[]};

test('Phase 3A: mobile help, missed-step resume, phone fallback, simplified/offline screen and legacy records', {timeout:140000},async t=>{
  if(!chromium){if(process.env.REQUIRE_BROWSER==='1')throw new Error('Playwright required in CI.');return t.skip('Playwright unavailable.');}
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
  try {
    const opts={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))opts.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(opts);
  } catch(err) {
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))return t.skip('Local Chromium unavailable.');
    throw err;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const screenshot=async name=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const checkWidths=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:844});
      const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,used:document.documentElement.scrollWidth}));
      assert.ok(size.used<=size.width+1,'Overflow at '+width+': '+JSON.stringify(size));
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.addInitScript(({key,record})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(record));
  },{key:KEY,record:legacy});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.mobile-top [data-page="incident"]').click();
  await page.getByRole('heading',{name:'Are you hurt?'}).waitFor();
  assert.equal(await page.locator('a.p1b-call-primary').getAttribute('href'),'tel:119');
  assert.equal(await page.locator('a.p1b-call-secondary').getAttribute('href'),'tel:110');
  assert.match(await page.locator('.p1b-phone-script').innerText(),/actual location|ACTUAL location/i);
  assert.match(await page.locator('.p1b-phone-script').innerText(),/NOT assumed to be your current position/);
  await page.getByText('Help with this step · 困ったときは').click();
  assert.match(await page.locator('.p3a-help').innerText(),/public phone/);
  await screenshot('emergency-help-375.png');await checkWidths();

  await page.getByRole('button',{name:'Can’t do this step'}).click();
  await page.getByText(/Cannot do this step right now/).waitFor();
  assert.equal(await page.locator('.p3a-help').getAttribute('open'),'');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Skip step for now'}).click();
  await page.getByRole('heading',{name:'Make the area safe'}).waitFor();
  await page.getByRole('button',{name:'One at a time'}).click();
  await page.getByText('ITEM 1 OF 4').waitFor();
  await page.locator('.p3a-item-help summary').click();
  assert.match(await page.locator('.p3a-item-help').innerText(),/broken glass/);
  await page.locator('[data-action="incident-item-outcome"][data-result="cant"]').click();
  await page.getByText('ITEM 2 OF 4').waitFor();
  await page.getByRole('button',{name:'Use simpler display'}).click();
  assert.equal(await page.locator('.p1b-incident.p3a-simple').count(),1);
  await screenshot('simple-item-375.png');await checkWidths();

  await page.getByRole('button',{name:'Leave guide (progress saved)'}).click();
  await page.getByRole('button',{name:'Resume guide'}).waitFor();
  await screenshot('resume-watch-375.png');
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(before.incident.paused,true);
  assert.equal(before.incident.stepOutcomes['1'],'skip');
  assert.equal(before.incident.outcomes['2']['0'],'cant');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Resume guide'}).click();
  await page.getByText('ITEM 2 OF 4').waitFor();
  assert.equal(await page.locator('.p1b-incident.p3a-simple').count(),1);
  await page.locator('[data-action="incident-step"][data-step="3"]').click();
  assert.equal(await page.locator('a[href="tel:171"]').count(),1);
  assert.match(await page.getByText(/not an always-on service/).innerText(),/not an always-on service/);
  await page.locator('[data-action="incident-step"][data-step="4"]').click();
  assert.match(await page.locator('.incident-step-card').innerText(),/Tsunami status: UNKNOWN/);
  await screenshot('tsunami-unknown-375.png');await checkWidths();

  await page.evaluate(async()=>navigator.serviceWorker.ready);
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByRole('heading',{name:'Stay or evacuate?'}).waitFor();
  assert.equal(await page.locator('a[href="tel:119"]').count()>0,true);
  const after=await page.evaluate(async()=>({caches:await caches.keys(),record:JSON.parse(localStorage.getItem('disaster-management:v1'))}));
  assert.ok(after.caches.includes('disaster-management-app-v12'));
  assert.equal(after.record.incident.stepOutcomes['1'],'skip');
  assert.equal(after.record.incident.oneStep,true);
  assert.equal(after.record.contacts[0].name,'Family');
  assert.equal(after.record.logs[0].note,'Keep me');
  assert.equal(after.record.profile.home,'Saved home; may be elsewhere');
  await screenshot('offline-resume-375.png');await checkWidths();
  assert.deepEqual(errors,[]);
});
