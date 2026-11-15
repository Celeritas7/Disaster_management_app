import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(join(root,name),'utf8');
const app=read('app.js'),css=read('mobile-ux.css'),html=read('index.html'),sw=read('service-worker.js');

test('mobile navigation preserves all five existing destinations and adds direct Settings',()=>{
  for(const name of ['watch','readiness','incident','night','log','settings'])
    assert.match(app,new RegExp("\\['"+name+"','(?:Watch|Ready|Incident|Night|Log|Settings)'"));
  assert.match(app,/class="bottom-nav"/);
  assert.match(css,/\.bottom-nav button \{[\s\S]*?flex: 1 1 0;[\s\S]*?min-width: 0;/);
  assert.match(css,/min-height: 48px/);
});

test('Settings shortcuts target actual contacts, backups, places and offline sections',()=>{
  for(const id of ['contacts','data','places','offline','privacy','sources','thresholds'])
    assert.match(app,new RegExp("\\['"+id+"','"));
  assert.match(app,/id="p1c-contacts"/);
  assert.match(app,/id="p1c-places"/);
  assert.ok(app.indexOf('${contactsForm}${placesForm}')>0,'contacts appear before long places form');
  assert.match(css,/\.p1c-setting-jumps \{[\s\S]*?position: sticky/);
  assert.match(css,/overflow-x: auto/);
});

test('back-to-top is passive until scroll and leaves emergency dialer untouched',()=>{
  assert.match(app,/data-action="scroll-top" aria-label="Back to top of this page" hidden/);
  assert.match(app,/topButton\.hidden=window\.scrollY<360/);
  assert.match(app,/addEventListener\('scroll',updateScrollTopVisibility,\{passive:true\}\)/);
  assert.match(css,/\.mobile-scroll-top\[hidden\] \{ display: none !important; \}/);
  assert.match(app,/href="tel:119"/);
  assert.match(app,/href="tel:110"/);
  assert.match(app,/disaster-management:v1/);
});

test('new style is shipped in updated offline cache without adding a network integration',()=>{
  assert.match(html,/href="\.\/mobile-ux\.css"/);
  assert.match(sw,/disaster-management-app-v13/);
  assert.match(sw,/\.\/mobile-ux\.css/);
  assert.match(sw,/OWNED_CACHE = \/\^disaster-management-app-v/);
  assert.doesNotMatch(css,/https?:\/\//);
});

test('browser fixtures serve every offline shell file so service worker installation can finish',()=>{
  const shell=sw.match(/const SHELL = \[([^\]]+)\];/);
  assert.ok(shell,'offline shell list is present');
  const assets=[...shell[1].matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]).filter(name=>name);
  for(const fixture of ['tests/phase3c-browser.test.mjs','tests/mobile-ux-browser.test.mjs']){
    const source=read(fixture);
    for(const asset of assets.filter(name=>name!=='index.html'))
      assert.ok(source.includes("'"+asset+"'"),fixture+' must serve '+asset);
  }
});
