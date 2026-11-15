import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* GitHub Actions installs the browser test dependency. */}
const root=process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

test('Phase 1B screens, recovery, large controls and offline reload work on mobile', {timeout:120000},async t=>{
  if(!chromium){
    if(process.env.REQUIRE_BROWSER==='1')throw new Error('Required Playwright dependency is missing.');
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
    if(process.env.REQUIRE_BROWSER!=='1' && /socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(error)))
      return t.skip('Local Chromium cannot launch.');
    throw error;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:412,height:892},deviceScaleFactor:1});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  const url=`http://127.0.0.1:${server.address().port}${prefix}`;
  const picture=async name=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const noOverflow=async width=>{
    await page.setViewportSize({width,height:892});
    const size=await page.evaluate(()=>({available:document.documentElement.clientWidth,used:document.documentElement.scrollWidth}));
    assert.ok(size.used<=size.available+1,`horizontal overflow at ${width}: ${JSON.stringify(size)}`);
  };

  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Departure check/}).click();
  await page.getByRole('heading',{name:'Leaving? Quick check.'}).waitFor();
  await picture('departure-412.png');
  for(const width of [320,375,412,768])await noOverflow(width);
  await page.setViewportSize({width:412,height:892});
  await page.locator('[data-action="departure-toggle"][data-id="wallet"]').click();
  await page.getByText('3 not confirmed').waitFor();
  await page.getByRole('button',{name:/Something’s missing/}).click();
  await page.getByText('NEXT ACTION · 1 OF 5').waitFor();
  assert.ok((await page.locator('.p1b-stranded-bars button').first().boundingBox()).height>=44);
  await picture('stranded-412.png');
  for(const width of [320,375,412,768])await noOverflow(width);
  await page.setViewportSize({width:412,height:892});
  await page.getByRole('button',{name:/Won’t work · Next/}).click();
  await page.getByText('NEXT ACTION · 2 OF 5').waitFor();

  await page.locator('.mobile-top [data-page="incident"]').click();
  await page.getByRole('heading',{name:'Are you hurt?'}).waitFor();
  assert.ok((await page.locator('.p1b-incident-segment').first().boundingBox()).height>=44);
  assert.equal(await page.locator('a.p1b-call-primary').getAttribute('href'),'tel:119');
  assert.equal(await page.locator('a.p1b-call-secondary').getAttribute('href'),'tel:110');
  await picture('incident-call-412.png');
  for(const width of [320,375,412,768])await noOverflow(width);
  await page.setViewportSize({width:412,height:892});
  await page.locator('[data-action="incident-step"][data-step="2"]').click();
  await page.getByRole('button',{name:'One at a time'}).click();
  await page.getByText('ITEM 1 OF 4').waitFor();
  await picture('incident-one-item-412.png');
  await page.locator('[data-result="done"]').click();
  await page.locator('[data-result="cant"]').click();
  await page.locator('[data-result="skip"]').click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.deepEqual(before.incident.done['2'],[0]);
  assert.equal(before.incident.outcomes['2']['1'],'cant');
  assert.equal(before.incident.outcomes['2']['2'],'skip');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('ITEM 4 OF 4').waitFor();
  await picture('incident-resume-412.png');
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:15000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByText('ITEM 4 OF 4').waitFor();
  const offline=await page.evaluate(async()=>{
    let networkUnavailable=false;
    try{await fetch('./uncached-network-probe.txt',{cache:'no-store'});}
    catch{networkUnavailable=true;}
    return {networkUnavailable,caches:await caches.keys(),progress:JSON.parse(localStorage.getItem('disaster-management:v1')).incident};
  });
  assert.equal(offline.networkUnavailable,true,'uncached network requests must fail while offline');
  assert.ok(offline.caches.some(name=>/^disaster-management-app-v\d+$/.test(name)));
  assert.equal(offline.progress.outcomes['2']['2'],'skip');
  await page.getByRole('button',{name:'Show full checklist'}).click();
  await page.getByText('Can’t', {exact:true}).waitFor();
  await picture('incident-offline-list-412.png');
  assert.deepEqual(errors,[]);
});
