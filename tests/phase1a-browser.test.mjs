import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

let chromium;
try {({chromium}=createRequire(import.meta.url)('playwright'));}
catch {/* Browser runner installs this in GitHub Actions. */}
const root=process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const shell=new Set(['index.html','app.js','styles.css','phase1b.css','phase1c.css','phase2a.css','phase2b.css','phase2c.css','phase3a.css','phase3b.css','service-worker.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']);

test('Phase 1A Watch, setup and Readiness work at 320–412px without misleading live data', {timeout:90000}, async t=>{
  if(!chromium){
    if(process.env.REQUIRE_BROWSER==='1')throw new Error('Required Playwright dependency is missing.');
    return t.skip('Playwright is unavailable locally.');
  }
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!shell.has(path)){res.writeHead(404);res.end();return;}
    try {res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(join(root,path)));}
    catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  let browser;
  try {
    const opts={headless:true,args:['--no-sandbox']};
    if(!existsSync(chromium.executablePath())&&existsSync('/usr/bin/chromium'))opts.executablePath='/usr/bin/chromium';
    browser=await chromium.launch(opts);
  }catch(error){
    if(process.env.REQUIRE_BROWSER!=='1' && /socket\(\) failed: Operation not permitted|process_singleton_posix|Executable doesn't exist/i.test(String(error)))
      return t.skip('Chromium cannot run in this sandbox.');
    throw error;
  }
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:412,height:892},deviceScaleFactor:1});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const photo=async(name)=>{
    if(!process.env.DMA_SCREENSHOT_DIR)return;
    mkdirSync(process.env.DMA_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:join(process.env.DMA_SCREENSHOT_DIR,name),fullPage:true});
  };
  const noOverflow=async(width)=>{
    await page.setViewportSize({width,height:892});
    const dimensions=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.view+1,`horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
  };

  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByText('Nothing to preview yet.').waitFor();
  await photo('watch-quiet-412.png');
  for(const width of [375,320,412])await noOverflow(width);
  await page.getByRole('button',{name:'Show example prediction'}).click();
  await page.getByText('DEMO · NO FORECAST').waitFor();
  await photo('watch-demo-412.png');
  await page.getByRole('button',{name:'List',exact:true}).click();
  await page.getByText('DEMO only · Heavy rain commute scenario, not a real prediction.').waitFor();
  await page.getByRole('button',{name:'Cards',exact:true}).click();
  await page.getByText('DEMO · NOT LIVE').waitFor();
  await page.getByRole('button',{name:'Dismiss example'}).click();
  await page.getByText('STATUS UNKNOWN').waitFor();
  await page.getByRole('button',{name:'Radar',exact:true}).click();
  await page.getByText('Nothing to preview yet.').waitFor();

  await page.getByRole('button',{name:'Start setup'}).click();
  await page.getByRole('heading',{name:'A quiet watcher for a loud country.'}).waitFor();
  await photo('onboarding-412.png');
  await page.getByRole('button',{name:'Skip this step'}).click();
  await page.getByRole('heading',{name:'Make your emergency kit visible.'}).waitFor();
  await page.getByRole('button',{name:'Back'}).click();
  await page.getByRole('heading',{name:'A quiet watcher for a loud country.'}).waitFor();
  await page.getByRole('button',{name:'Exit tour'}).click();

  await page.getByRole('button',{name:'Ready',exact:true}).click();
  await page.getByText('14 readiness gaps').waitFor();
  await photo('readiness-412.png');
  await page.getByRole('button',{name:'Mark checked by me: Shelf-stable food'}).first().click();
  await page.getByText('13 readiness gaps').waitFor();
  const checked=await page.evaluate(()=>JSON.parse(localStorage.getItem('disaster-management:v1')));
  assert.equal(checked.checks.food,true);
  assert.equal(checked.version,1);
  for(const width of [375,320,412])await noOverflow(width);
  assert.deepEqual(errors,[]);
});
