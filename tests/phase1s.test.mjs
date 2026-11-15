import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// GitHub Pages serves the repo root; DMA_TEST_ROOT supports a local staging copy.
const SOURCE_ROOT = process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_SOURCE = readFileSync(join(SOURCE_ROOT, 'service-worker.js'), 'utf8');
const APP_SOURCE = readFileSync(join(SOURCE_ROOT, 'app.js'), 'utf8');
const CURRENT_CACHE = SW_SOURCE.match(/const CACHE = '([^']+)'/)?.[1];
const SCOPE = 'https://celeritas7.github.io/Disaster_management_app/';
const KEY = 'disaster-management:v1';

function serviceWorkerHarness() {
  const listeners = new Map();
  const cacheNames = new Map();
  const deleted = [];
  const preloaded = [];
  let claims = 0;
  let skipWaits = 0;
  let network = async () => { throw new Error('offline'); };

  const normalizeUrl = request => typeof request === 'string' ? request : request.url;
  const getCache = name => {
    if (!cacheNames.has(name)) {
      const entries = new Map();
      cacheNames.set(name, {
        entries,
        async match(request, options = {}) {
          const url = new URL(normalizeUrl(request));
          if (options.ignoreSearch) url.search = '';
          return entries.get(url.href)?.clone();
        },
        async put(request, response) {
          const url = new URL(normalizeUrl(request));
          entries.set(url.href, response.clone());
        },
        async addAll(requests) {
          for (const request of requests) {
            preloaded.push({url: request.url, cache: request.cache});
            entries.set(request.url, new Response('preloaded: ' + request.url));
          }
        }
      });
    }
    return cacheNames.get(name);
  };
  const caches = {
    open: async name => getCache(name),
    keys: async () => [...cacheNames.keys()],
    delete: async name => { deleted.push(name); return cacheNames.delete(name); }
  };
  const self = {
    registration: {scope: SCOPE},
    location: new URL(SCOPE),
    clients: {claim: async () => { claims++; }},
    skipWaiting: async () => { skipWaits++; },
    addEventListener: (name, handler) => listeners.set(name, handler)
  };
  vm.runInNewContext(SW_SOURCE, {self, caches, URL, Request, Response, Set, Promise, fetch: request => network(request)}, {filename: 'service-worker.js'});

  async function lifecycle(name) {
    let promise;
    listeners.get(name)({waitUntil: value => { promise = Promise.resolve(value); }});
    await promise;
  }
  async function fetchURL(url, options = {}) {
    const request = new Request(url, options);
    let promise;
    const waits = [];
    listeners.get('fetch')({request, respondWith: value => {promise=Promise.resolve(value);}, waitUntil: value => waits.push(Promise.resolve(value))});
    if (!promise) return {handled: false, waits};
    const response = await promise;
    await Promise.all(waits);
    return {handled: true, response, waits};
  }
  return {getCache,cacheNames,deleted,preloaded,lifecycle,fetchURL,setNetwork:fn=>{network=fn;},get claims(){return claims;},get skipWaits(){return skipWaits;}};
}

function sampleRecord() {
  return {version:1,page:'settings',tourStep:1,tourDone:true,
    profile:{home:'Saved Home 住所',office:'Office',shelter:'School',safePlace:'Home'},
    checks:{water:true},contacts:[{name:'Trusted Friend',phone:'+819012345678'}],
    incident:{active:false,step:1,done:{},contacted:[],note:''},
    departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    scenario:false,logs:[{date:'14 Nov',title:'Old entry',note:'Retain me'}],
    rules:[{title:'Keep the plan',trigger:'Before leaving',date:'14 Nov'}]};
}

function appHarness(initialRaw, {controlled = false, swEnabled = controlled} = {}) {
  const storage = new Map(initialRaw === undefined ? [] : [[KEY, initialRaw]]);
  const listeners = new Map();
  const downloads = [];
  const app = {innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast = {textContent:'',classList:{add(){},remove(){}}};
  let allowErase = true;
  let reloads = 0;
  const workerListeners = new Map();
  const serviceWorker = swEnabled ? {
    controller: controlled ? {} : null,
    ready: Promise.resolve(),
    addEventListener: (name,cb) => workerListeners.set(name,cb),
    register: async () => ({})
  } : undefined;
  const workspace = {querySelector:()=>null,insertAdjacentHTML:(_where,html)=>{workspace.inserted = html;}};
  app.querySelector = () => workspace;
  const TestURL = class extends URL {
    static createObjectURL(blob) { downloads.push({blob});return 'blob:test'; }
    static revokeObjectURL() {}
  };
  const document = {
    title:'',
    getElementById: id => id === 'app' ? app : id === 'toast' ? toast : id === 'update-notice' ? {remove(){}} : null,
    addEventListener: (name, cb) => listeners.set(name,cb),
    createElement: () => ({click(){downloads[downloads.length-1].fileName=this.download;}})
  };
  const navigator = {onLine:true};
  if (serviceWorker) navigator.serviceWorker=serviceWorker;
  const context = {document,navigator,window:{addEventListener(){},scrollTo(){},location:{reload(){reloads++;}}},
    localStorage:{getItem:name=>storage.has(name)?storage.get(name):null,setItem:(name,value)=>storage.set(name,value),removeItem:name=>storage.delete(name)},
    URL:TestURL,Blob,Date,Intl,setTimeout:()=>1,clearTimeout:()=>{},
    confirm:()=>allowErase,location:{protocol:swEnabled?'https:':'http:',hostname:swEnabled?'celeritas7.github.io':'localhost'}};
  vm.runInNewContext(APP_SOURCE,context,{filename:'app.js'});
  const click = (name, dataset = {}) => {
    const button = {dataset:{action:name,...dataset}};
    listeners.get('click')({target:{closest:()=>button},preventDefault(){}});
  };
  const importRecord = async (record,id='import-json') => {
    const raw = typeof record === 'string' ? record : JSON.stringify(record);
    const target = {id,files:[{size:raw.length,text:async()=>raw}],value:'selected'};
    await listeners.get('change')({target});
    // Phase 2C stages a non-destructive preview; replacing records is a
    // separate, explicitly confirmed action.
    if(app.innerHTML.includes('id="p2c-import-preview"'))click('apply-import');
  };
  return {storage,app,toast,downloads,click,importRecord,workspace,workerListeners,serviceWorker,setConfirm(value){allowErase=value;},get reloads(){return reloads;}};
}

test('service worker install reloads all app-shell files from the network', async () => {
  const worker = serviceWorkerHarness();
  await worker.lifecycle('install');
  assert.equal(worker.preloaded.length,17);
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase1c.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase2a.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase2b.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase2c.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase3a.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase3b.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'phase3c.css'));
  assert.ok(worker.preloaded.some(item=>item.url===SCOPE+'mobile-ux.css'));
  assert.ok(worker.preloaded.every(item => item.url.startsWith(SCOPE) && item.cache === 'reload'));
  assert.equal(worker.skipWaits,1);
});

test('activation removes only old Disaster Management versioned caches', async () => {
  const worker = serviceWorkerHarness();
  for (const name of ['disaster-management-app-v4','disaster-management-app-v5','disaster-management-app-v6','disaster-management-app-v7',CURRENT_CACHE,'disaster-management-app-images','kg-chart-v1','otherapp-static-v4']) worker.getCache(name);
  await worker.lifecycle('activate');
  assert.deepEqual(worker.deleted,['disaster-management-app-v4','disaster-management-app-v5','disaster-management-app-v6','disaster-management-app-v7']);
  assert.deepEqual([...worker.cacheNames.keys()],[CURRENT_CACHE,'disaster-management-app-images','kg-chart-v1','otherapp-static-v4']);
  assert.equal(worker.claims,1);
});

test('an app shell request opens only this app cache and works offline', async () => {
  const worker = serviceWorkerHarness();
  await worker.getCache(CURRENT_CACHE).put(SCOPE+'app.js',new Response('local app code'));
  const result=await worker.fetchURL(SCOPE+'app.js?cachebust=123');
  assert.equal(result.handled,true);
  assert.equal(await result.response.text(),'local app code');
});

test('sibling GitHub Pages files and unrelated requests are never intercepted', async () => {
  const worker = serviceWorkerHarness();
  for (const [url,options] of [
    ['https://celeritas7.github.io/KG_chart_new/index.html',{}],
    ['https://example.org/Disaster_management_app/app.js',{}],
    [SCOPE+'private-backup.json',{}],
    [SCOPE+'app.js',{method:'POST'}]
  ]) {
    const result=await worker.fetchURL(url,options);
    assert.equal(result.handled,false,url);
  }
});

test('an unrelated cache cannot supply or poison a missing app shell response', async () => {
  const worker = serviceWorkerHarness();
  await worker.getCache('otherapp-static-v4').put(SCOPE+'app.js',new Response('WRONG APP'));
  worker.setNetwork(async()=>new Response('fetched own app'));
  const result=await worker.fetchURL(SCOPE+'app.js');
  assert.equal(await result.response.text(),'fetched own app');
  const owned=await worker.getCache(CURRENT_CACHE).match(SCOPE+'app.js');
  assert.equal(await owned.text(),'fetched own app');
});

test('existing version-1 contacts, notes and readiness survive normal interaction', () => {
  const app=appHarness(JSON.stringify(sampleRecord()));
  assert.ok(app.app.innerHTML.includes('Trusted Friend'));
  app.click('toggle-check',{id:'cash'});
  const saved=JSON.parse(app.storage.get(KEY));
  assert.equal(saved.checks.water,true);
  assert.equal(saved.checks.cash,true);
  assert.equal(saved.profile.home,'Saved Home 住所');
  assert.equal(saved.contacts[0].name,'Trusted Friend');
  assert.equal(saved.logs[0].note,'Retain me');
  assert.equal(saved.rules[0].title,'Keep the plan');
});

test('future version is quarantined: normal interactions cannot overwrite original data', async () => {
  const raw=JSON.stringify({...sampleRecord(),version:999});
  const app=appHarness(raw);
  assert.ok(app.app.innerHTML.includes('Saved records need recovery'));
  app.click('go',{page:'incident'});
  app.click('toggle-check',{id:'cash'});
  assert.equal(app.storage.get(KEY),raw);
  app.click('export-raw');
  assert.equal(await app.downloads[0].blob.text(),raw);
  assert.equal(app.downloads[0].fileName,'disaster-management-original-backup.json');
});

test('corrupt JSON stays untouched until an explicit confirmed reset', () => {
  const bad='{"version":1,"contacts":[';
  const app=appHarness(bad);
  assert.ok(app.app.innerHTML.includes('Saved records need recovery'));
  app.setConfirm(false);
  app.click('erase');
  assert.equal(app.storage.get(KEY),bad);
  app.setConfirm(true);
  app.click('erase');
  assert.equal(JSON.parse(app.storage.get(KEY)).version,1);
  assert.ok(!app.app.innerHTML.includes('Saved records need recovery'));
});

test('importing a compatible backup recovers unknown-version records safely', async () => {
  const bad=JSON.stringify({...sampleRecord(),version:27});
  const app=appHarness(bad);
  await app.importRecord(sampleRecord(),'import-recovery-json');
  const record=JSON.parse(app.storage.get(KEY));
  assert.equal(record.contacts[0].name,'Trusted Friend');
  assert.equal(record.logs[0].note,'Retain me');
  assert.ok(!app.app.innerHTML.includes('Saved records need recovery'));
});

test('incompatible import never overwrites existing records', async () => {
  const raw=JSON.stringify(sampleRecord());
  const app=appHarness(raw);
  await app.importRecord({...sampleRecord(),version:3});
  assert.equal(app.storage.get(KEY),raw);
  assert.ok(app.toast.textContent.includes('Unsupported backup version'));
});

test('structurally damaged records are quarantined and an ordinary backup retains the old data', async () => {
  const partial=JSON.stringify({...sampleRecord(),contacts:'not an array'});
  const damaged=appHarness(partial);
  damaged.click('toggle-check',{id:'cash'});
  assert.equal(damaged.storage.get(KEY),partial);
  const healthy=appHarness(JSON.stringify(sampleRecord()));
  healthy.click('export');
  const exported=JSON.parse(await healthy.downloads[0].blob.text());
  assert.equal(exported.contacts[0].name,'Trusted Friend');
  assert.equal(exported.logs[0].note,'Retain me');
  assert.equal(exported.profile.home,'Saved Home 住所');
});

test('service worker update notice is inserted without rerendering an open form', async () => {
  const app=appHarness(JSON.stringify(sampleRecord()),{controlled:true});
  const htmlBefore=app.app.innerHTML;
  await Promise.resolve();await Promise.resolve();
  app.workerListeners.get('controllerchange')();
  assert.equal(app.app.innerHTML,htmlBefore);
  assert.ok(app.workspace.inserted.includes('Reload to update'));
  app.click('reload-app');
  assert.equal(app.reloads,1);
});

test('first-time service worker install stays quiet but its next update prompts', () => {
  const app=appHarness(JSON.stringify(sampleRecord()),{controlled:false,swEnabled:true});
  const handler=app.workerListeners.get('controllerchange');
  app.serviceWorker.controller={};
  handler();
  assert.equal(app.workspace.inserted,undefined);
  handler();
  assert.ok(app.workspace.inserted.includes('Reload to update'));
});
