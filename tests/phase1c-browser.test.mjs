import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* GitHub Actions installs Playwright. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css','service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

test('Phase 1C Night Out, after-action, log, settings, mobile layout and offline persistence', {timeout:180000},async t=>{
  if(!chromium){
    if(process.env.REQUIRE_BROWSER==='1')throw new Error('Required Playwright dependency missing.');
    return t.skip('Playwright not installed.');
  }
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    const filename=path===prefix?'index.html':path.startsWith(prefix)?path.slice(prefix.length):'';
    if(!files.has(filename)){res.writeHead(404);res.end('Not found');return;}
    try{res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(join(root,filename)));}
    catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  let browser;
  try{
    const options={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))options.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(options);
  }catch(error){
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(error)))
      return t.skip('Local Chromium cannot launch.');
    throw error;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:412,height:892},deviceScaleFactor:1});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url=`http://127.0.0.1:${server.address().port}${prefix}`;
  const picture=async name=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const noOverflow=async()=>{
    for(const width of [320,375,412,768]){
      await page.setViewportSize({width,height:892});
      const box=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(box.scroll<=box.client+1,`horizontal overflow at ${width}: ${JSON.stringify(box)}`);
    }
    await page.setViewportSize({width:412,height:892});
  };

  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.bottom-nav [data-page="night"]').click();
  await page.getByRole('heading',{name:'Nothing planned tonight.'}).waitFor();
  assert.equal(await page.locator('.p1c-night').count(),1);
  await picture('night-idle-412.png');
  await noOverflow();

  await page.locator('[data-action="night-pre"]').click();
  await page.getByRole('heading',{name:'Decide before the first drink.'}).waitFor();
  await picture('night-pre-412.png');
  await noOverflow();
  await page.locator('#night-limit').fill('1');
  await page.getByRole('button',{name:'Increase drink limit'}).click();
  assert.equal(await page.locator('#night-limit').inputValue(),'2');
  await page.locator('#night-budget').fill('2400');
  await page.locator('#night-leave').fill('00:15');
  await page.locator('#night-mode').selectOption('taxi');
  await page.locator('[data-action="night-start"]').click();
  await page.getByRole('heading',{name:'Stay with your plan.'}).waitFor();
  await picture('night-live-counters-412.png');
  await noOverflow();
  await page.locator('[data-action="night-layout"][data-layout="timer"]').click();
  await page.locator('[data-p1c-countdown]').waitFor();
  const timer=await page.locator('[data-p1c-countdown]').innerText();
  assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(timer)||timer==='Chosen leave time passed',timer);
  const savedTarget=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')).night.leaveAt);
  assert.ok(Number.isSafeInteger(savedTarget));
  await picture('night-live-timer-412.png');
  await noOverflow();

  await page.locator('#drink-cost').fill('750');
  await page.locator('[data-action="night-plus"]').click();
  assert.match(await page.locator('.p1c-timer-sub').innerText(),/¥750/);
  await page.locator('[data-action="night-undo"]').click();
  assert.match(await page.locator('.p1c-timer-sub').innerText(),/¥0/);
  await page.locator('[data-action="night-drunk"]').click();
  await page.getByRole('heading',{name:'Any of these signs? Call 119.'}).waitFor();
  assert.equal(await page.locator('a.p1c-urgent-dial').getAttribute('href'),'tel:119');
  assert.equal(await page.locator('.p1c-red-flags > div').count(),4);
  await picture('night-urgent-412.png');
  await noOverflow();
  await page.locator('[data-action="night-live"]').click();
  await page.locator('[data-action="night-after"]').click();
  await page.getByRole('heading',{name:'Close the loop.'}).waitFor();
  await page.locator('#night-note').fill('Went home according to my own plan.');
  await picture('night-after-412.png');
  await noOverflow();
  await page.locator('[data-action="night-log"]').click();
  await page.getByRole('heading',{name:'A record you control.'}).waitFor();
  await page.getByText('Recorded manually').waitFor();
  await picture('log-recorded-412.png');
  await noOverflow();

  await page.locator('[data-action="go"][data-page="reflection"]').first().click();
  await page.getByRole('heading',{name:'One decision, one useful rule.'}).waitFor();
  await page.locator('#reflection-event').fill('I waited too long before leaving.');
  await page.locator('[data-action="reflection-choice"][data-index="2"]').click();
  assert.equal(await page.locator('#reflection-point').inputValue(),'I ignored a time or spending limit I had chosen.');
  await page.locator('#reflection-rule').fill('Leave when my chosen time arrives.');
  await page.locator('#reflection-trigger').fill('Before going out');
  await picture('after-action-412.png');
  await noOverflow();
  await page.locator('[data-action="save-reflection"]').click();
  await page.getByText('Saved locally · Does not trigger reminders').waitFor();
  await picture('log-rules-412.png');

  await page.locator('.bottom-nav [data-page="readiness"]').click();
  // On mobile the desktop sidebar is intentionally hidden. Navigate through
  // the visible Readiness shortcut instead of selecting its hidden counterpart.
  await page.locator('#main-content [data-action="go"][data-page="settings"]').click();
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  for(const name of ['sources','privacy','thresholds','offline','details','data'])assert.equal(await page.locator('#p1c-'+name).count(),1);
  await picture('settings-412.png');
  await noOverflow();
  await page.locator('#home-address').fill('My saved home');
  await page.locator('[data-action="save-profile"]').click();
  await page.locator('#contact-name').fill('Family');
  await page.locator('#contact-phone').fill('+819000000000');
  await page.locator('[data-action="add-contact"]').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  assert.equal(await page.locator('#home-address').inputValue(),'My saved home');
  assert.equal(await page.locator('.p1c-setting-contact').count(),1);
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(record.profile.home,'My saved home');
  assert.equal(record.logs[0].kind,'reflection');
  assert.equal(record.logs[1].kind,'night');
  assert.equal(record.night.phase,'idle');

  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:18000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  const check=await page.evaluate(async()=>{
    let blocked=false;
    try {await fetch('./unavailable-network-probe.txt',{cache:'no-store'});} catch {blocked=true;}
    return {blocked,caches:await caches.keys(),profile:JSON.parse(localStorage.getItem('disaster-management:v1')).profile};
  });
  assert.equal(check.blocked,true);
  assert.ok(check.caches.includes('disaster-management-app-v12'));
  assert.equal(check.profile.home,'My saved home');
  assert.deepEqual(errors,[]);
});
