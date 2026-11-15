import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}catch {/* Required in CI. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','phase3c.css','mobile-ux.css',
  'service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const KEY='disaster-management:v1';

test('mobile Settings/scroll shortcuts and original records survive offline reload', {timeout:120000},async t=>{
  if(!chromium){if(process.env.REQUIRE_BROWSER==='1')throw new Error('Playwright required in CI');return t.skip('Playwright unavailable');}
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
    const opts={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))opts.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(opts);
  }catch(err){
    if(process.env.REQUIRE_BROWSER!=='1'&&/socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))return t.skip('Local Chromium unavailable');
    throw err;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const original={version:1,page:'watch',tourStep:0,tourDone:true,
    profile:{home:'Previously saved home'},checks:{water:true},contacts:[{name:'Existing friend',phone:'+819011112222'}],
    incident:{active:false,step:1,done:{},contacted:[],note:''},departure:{wallet:false,pass:false,phone:false,keys:false},
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    logs:[{date:'Previously',title:'Earlier observation',note:'Keep this'}],rules:[]};
  await page.addInitScript(({key,entry})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(entry));},{key:KEY,entry:original});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const snapshot=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  for(const width of [320,375,412]){
    await page.setViewportSize({width,height:844});
    const buttons=page.locator('.bottom-nav [data-action="go"]');
    assert.equal(await buttons.count(),6,'all six mobile destinations at '+width);
    for(const destination of ['watch','readiness','incident','night','log','settings']){
      const button=page.locator('.bottom-nav [data-page="'+destination+'"]');
      assert.ok(await button.isVisible(),destination+' visible at '+width);
      assert.ok((await button.boundingBox()).height>=44,'touch area at '+width);
    }
    const dimensions=await page.evaluate(()=>({visible:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
    assert.ok(dimensions.content<=dimensions.visible+1,'no horizontal overflow '+width+': '+JSON.stringify(dimensions));
  }
  await page.setViewportSize({width:375,height:844});
  await page.locator('.bottom-nav [data-page="settings"]').click();
  assert.match(await page.locator('h1').first().innerText(),/Clarity and control/);
  const jump=page.getByRole('navigation',{name:'Jump to Settings section'});
  assert.ok(await jump.isVisible());
  await jump.getByRole('link',{name:'Contacts'}).click();
  // Global CSS uses smooth scrolling; wait for the final anchor position.
  await page.waitForFunction(()=>{
    const top=document.getElementById('p1c-contacts')?.getBoundingClientRect().top;
    return top>=100&&top<=200;
  },null,{timeout:10000});
  const contactPosition=await page.locator('#p1c-contacts').evaluate(element=>element.getBoundingClientRect().top);
  assert.ok(contactPosition>=100&&contactPosition<=200,'contacts appear below sticky shortcuts: '+contactPosition);
  assert.ok(await jump.isVisible(),'sticky shortcuts stay visible while scrolled');
  await page.getByRole('button',{name:'Back to top of this page'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Back to top of this page'}).click();
  await page.waitForFunction(()=>window.scrollY<40,null,{timeout:10000});
  await jump.getByRole('link',{name:'Backups'}).click();
  assert.ok(await page.locator('#p1c-data').isVisible());
  await jump.getByRole('link',{name:'Contacts'}).click();
  await page.locator('#contact-name').fill('Test contact');
  await page.locator('#contact-phone').fill('+819033334444');
  await page.getByRole('button',{name:'Add contact'}).click();
  const saved=await snapshot();
  assert.equal(saved.version,1);
  assert.equal(saved.contacts[0].name,'Existing friend');
  assert.equal(saved.contacts[1].name,'Test contact');
  assert.equal(saved.logs[0].note,'Keep this');
  assert.equal(saved.profile.home,'Previously saved home');
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){
    await page.evaluate(async()=>navigator.serviceWorker.ready);
    await page.reload({waitUntil:'domcontentloaded'});
  }
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:20000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  assert.equal(await page.locator('.bottom-nav [data-page="settings"]').count(),1);
  assert.equal((await snapshot()).contacts.length,2);
  assert.equal((await snapshot()).logs[0].title,'Earlier observation');
  assert.ok((await page.evaluate(()=>caches.keys())).includes('disaster-management-app-v13'));
  assert.deepEqual(errors,[]);
  if(process.env.DMA_SCREENSHOT_DIR){
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,'mobile-settings-375.png'),fullPage:true});
  }
});
