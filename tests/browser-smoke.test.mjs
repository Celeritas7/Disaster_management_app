import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try { ({chromium}=createRequire(import.meta.url)('playwright')); }
catch { /* Playwright is optional for this static, dependency-free web app. */ }
// GitHub Pages serves the repo root; DMA_TEST_ROOT supports a local staging copy.
const root = process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/Disaster_management_app/';
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const allowed = new Set(['index.html','app.js','service-worker.js','styles.css','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);
let swRevision = 'v3';

test('a real Chromium install preserves other apps and local data across offline and worker upgrades', {timeout:90000}, async t => {
  if (!chromium) {
    if (process.env.REQUIRE_BROWSER === '1') throw new Error('Required Playwright dependency is missing.');
    return t.skip('Install optional Playwright and Chromium to run browser integration checks.');
  }
  const server = createServer((req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const name = pathname === prefix ? 'index.html' : pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
    if (!allowed.has(name)) {res.writeHead(404);res.end('Not found');return;}
    try {
      let body = readFileSync(join(root,name));
      if(name === 'service-worker.js' && swRevision === 'v4')
        body = Buffer.from(body.toString('utf8').replace("disaster-management-app-v3'", "disaster-management-app-v4'"));
      const ext = name === 'manifest.webmanifest' ? '.webmanifest' : name.slice(name.lastIndexOf('.'));
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(body);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  let browser;
  try {
    const options = {headless:true,args:['--no-sandbox']};
    if (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium'))
      options.executablePath = '/usr/bin/chromium';
    browser = await chromium.launch(options);
  } catch (err) {
    if (process.env.REQUIRE_BROWSER !== '1' && /socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(err)))
      return t.skip('Chromium is unavailable or blocked in this environment; run the browser test in a configured runner.');
    throw err;
  }
  t.after(()=>browser.close());
  const context = await browser.newContext({viewport:{width:1200,height:800},acceptDownloads:true});
  t.after(()=>context.close());
  const page = await context.newPage();
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;

  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:15000});
  await page.getByRole('button',{name:'Settings & contacts'}).click();
  await page.locator('#home-address').fill('Saitama safe home');
  await page.getByRole('button',{name:'Save these places'}).click();
  await page.locator('#contact-name').fill('Emergency test contact');
  await page.locator('#contact-phone').fill('+819011112222');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  let old = await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(old.profile.home,'Saitama safe home');
  assert.equal(old.contacts[0].name,'Emergency test contact');

  // Same-origin PWAs share CacheStorage even when they have separate paths.
  await page.evaluate(async()=>{
    const other=await caches.open('kg-chart-offline-v1');
    await other.put(location.origin+'/KG_chart_new/index.html',new Response('other app'));
  });

  // A revised worker must update its shell without disturbing an active form.
  await page.locator('#home-address').fill('text not yet saved');
  swRevision = 'v4';
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
  await page.getByRole('button',{name:'Reload to update'}).waitFor({timeout:15000});
  assert.equal(await page.locator('#home-address').inputValue(),'text not yet saved');
  // Worker activation/cache cleanup can finish after the controller event.
  await page.waitForFunction(async()=>{
    const names=await caches.keys();
    return names.includes('disaster-management-app-v4') && !names.includes('disaster-management-app-v3');
  },null,{timeout:8000});
  let keys = await page.evaluate(()=>caches.keys());
  assert.ok(keys.includes('kg-chart-offline-v1'));
  assert.ok(keys.includes('disaster-management-app-v4'));
  // An in-flight old worker can briefly reopen its own old cache; the wait
  // above verifies that the new worker did clean it during activation.

  await page.getByRole('button',{name:'Reload to update'}).click();
  await page.getByRole('button',{name:'Settings & contacts'}).click();
  assert.equal(await page.locator('#home-address').inputValue(),'Saitama safe home');
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByRole('button',{name:'Settings & contacts'}).click();
  assert.equal(await page.locator('#home-address').inputValue(),'Saitama safe home');
  assert.equal(await page.locator('.contact-name').first().innerText(),'Emergency test contact');

  // A future/unknown storage version must be exportable but never overwritten.
  const quarantined = await page.evaluate(()=>{
    const key='disaster-management:v1';
    const data=JSON.parse(localStorage.getItem(key));data.version=999;
    const raw=JSON.stringify(data);localStorage.setItem(key,raw);return raw;
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.getByText('Saved records need recovery').waitFor();
  await page.getByRole('button',{name:'Review readiness'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('disaster-management:v1')),quarantined);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download original records'}).click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'disaster-management-original-backup.json');

  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-recovery-json').setInputFiles({
    name:'compatible-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))
  });
  await page.getByRole('button',{name:'Settings & contacts'}).click();
  assert.equal(await page.locator('#home-address').inputValue(),'Saitama safe home');
  assert.ok(!(await page.locator('body').innerText()).includes('Saved records need recovery'));
  keys=await page.evaluate(()=>caches.keys());
  assert.ok(keys.includes('kg-chart-offline-v1'));
});
