import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* GitHub Actions installs Chromium with Playwright. */}
const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const prefix='/Disaster_management_app/';
const files=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};

test('Phase 2A places, contact priority, phone confirmation, old data and offline mobile interaction', {timeout:180000},async t=>{
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
  const context=await browser.newContext({viewport:{width:375,height:844},deviceScaleFactor:1});
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
      const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(size.scroll<=size.client+1,'horizontal overflow at '+width+': '+JSON.stringify(size));
    }
    await page.setViewportSize({width:375,height:844});
  };
  const settings=async()=>{
    await page.locator('.bottom-nav [data-page="readiness"]').click();
    await page.locator('#main-content [data-action="go"][data-page="settings"]').click();
    await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  };
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await settings();
  assert.equal(await page.locator('.p2a-place-field').count(),5);
  assert.match(await page.locator('.p2a-contacts-form').innerText(),/No contacts saved/);
  await screenshot('places-original-375.png');
  await noOverflow();

  await page.locator('#home-address').fill('Tokyo home');
  await page.locator('#office-address').fill('Office');
  await page.locator('#safe-place').fill('Library');
  await page.locator('#preferred-station').fill('Minami-Urawa Station');
  await page.locator('#shelter-name').fill('Municipal school');
  await page.locator('#shelter-source').fill('Municipality official shelter list');
  await page.locator('#place-verify-home').check();
  await page.locator('#place-verify-station').check();
  await page.locator('#place-verify-shelter').check();
  await page.getByRole('button',{name:'Save these places'}).click();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(saved.profile.station,'Minami-Urawa Station');
  assert.ok(saved.profile.placeChecks.shelter.checkedAt);
  assert.equal(saved.profile.placeChecks.office,undefined);
  await screenshot('places-checked-375.png');

  // Changing the source must clear its existing self-attestation.
  await page.locator('#shelter-source').fill('New notice; review again');
  assert.equal(await page.locator('#place-verify-shelter').isChecked(),false);
  await page.getByRole('button',{name:'Save these places'}).click();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(saved.profile.placeChecks.shelter,undefined);
  await page.locator('#place-verify-shelter').check();
  await page.getByRole('button',{name:'Save these places'}).click();

  const add=async(name,phone,role)=>{
    await page.locator('#contact-name').fill(name);
    await page.locator('#contact-phone').fill(phone);
    await page.locator('#contact-role').selectOption(role);
    await page.getByRole('button',{name:'Add contact'}).click();
  };
  await add('Brother','+819011112222','primary');
  await add('Neighbour','090-4444-5555','backup');
  await add('Colleague','+819077778888','work');
  assert.deepEqual(await page.locator('.p2a-contact-card strong').allInnerTexts(),['Brother','Neighbour','Colleague']);
  await page.locator('[data-action="contact-up"][data-index="2"]').click();
  assert.deepEqual(await page.locator('.p2a-contact-card strong').allInnerTexts(),['Brother','Colleague','Neighbour']);
  await page.locator('[data-action="contact-edit"][data-index="1"]').click();
  await page.locator('#contact-name').fill('Colleague updated');
  await page.locator('#contact-phone').fill('+819077770000');
  await page.getByRole('button',{name:'Save contact changes'}).click();
  assert.equal(await page.locator('.p2a-contact-card strong').nth(1).innerText(),'Colleague updated');
  await page.locator('[data-contact-role="1"]').selectOption('other');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')))).contacts[1].role,'other');
  await screenshot('contacts-priority-375.png');
  await noOverflow();

  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-action="remove-contact"][data-index="2"]').click();
  assert.equal(await page.locator('.p2a-contact-card').count(),3);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-action="remove-contact"][data-index="2"]').click();
  assert.equal(await page.locator('.p2a-contact-card').count(),2);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Clarity and control.'}).waitFor();
  assert.equal(await page.locator('#preferred-station').inputValue(),'Minami-Urawa Station');
  assert.equal(await page.locator('.p2a-contact-card').count(),2);

  await page.locator('.bottom-nav [data-page="incident"]').click();
  await page.locator('[data-action="incident-step"][data-step="3"]').click();
  assert.match(await page.locator('.contact-row').first().innerText(),/Primary contact/);
  assert.match(await page.locator('.contact-row').nth(1).innerText(),/Colleague updated/);
  let requested=false;
  page.once('dialog',async dialog=>{requested=true;assert.match(dialog.message(),/Open a new SMS draft/);await dialog.dismiss();});
  await page.locator('[data-action="sms-contact"][data-index="0"]').click();
  assert.equal(requested,true);
  assert.match(page.url(),/Disaster_management_app/);
  await screenshot('incident-contact-order-375.png');
  await noOverflow();

  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:18000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('.contact-row').first().waitFor();
  const offline=await page.evaluate(async()=>{
    let blocked=false;
    try{await fetch('./not-available-offline.txt',{cache:'no-store'});}catch{blocked=true;}
    return {blocked,caches:await caches.keys(),record:JSON.parse(localStorage.getItem('disaster-management:v1'))};
  });
  assert.equal(offline.blocked,true);
  assert.ok(offline.caches.includes('disaster-management-app-v9'));
  assert.equal(offline.record.profile.station,'Minami-Urawa Station');
  assert.equal(offline.record.contacts.length,2);
  assert.deepEqual(errors,[]);
});
