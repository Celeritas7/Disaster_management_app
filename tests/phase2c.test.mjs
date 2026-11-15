import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const script=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase2c.css'),'utf8');
const worker=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';
const SLOT='disaster-management:preimport:v1';

function legacyRecord() {
  return {version:1,page:'settings',tourStep:0,tourDone:true,
    profile:{home:'Secret Home Tokyo',office:'Work',shelter:'Municipality gym',safePlace:'My meeting point',station:'Station',shelterSource:'City'},
    checks:{water:true,cash:true,food:true},
    readiness:{items:{water:{quantity:9,target:9,unit:'L',expiry:'2027-03-10',reviewDue:'2027-02-10',reviewedAt:'2026-11-15'}},
      custom:[{id:'custom-1',title:'Prescription glasses',checked:true,quantity:1,target:1,unit:'items'}],nextCustomId:2,embassy:{status:'not-applicable'}},
    contacts:[{name:'Sensitive Person',phone:'+819011112222',role:'primary'}],
    incident:{active:true,step:3,done:{2:[0]},contacted:[0],note:'Private incident note'},
    departure:{wallet:true,pass:true,phone:false,keys:false},strandedStep:0,
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'Private note',costHistory:[600]},
    scenario:false,logs:[{date:'Earlier',title:'Private log',note:'Keep log'}],rules:[{title:'Reminder',trigger:'Manually',date:'Earlier'}]};
}

function harness(initial=legacyRecord(),apis={}) {
  const storage=new Map(initial===null?[]:[[KEY,typeof initial==='string'?initial:JSON.stringify(initial)]]);
  const events=new Map(),inputs=new Map(),downloads=[],urls=new Map();
  const app={innerHTML:'',contains:()=>true,querySelectorAll:()=>[],querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  let allow=true,failSnapshot=false;
  let urlIndex=0;
  const TestURL=class extends URL {
    static createObjectURL(blob){const url='blob:test'+(++urlIndex);urls.set(url,blob);return url;}
    static revokeObjectURL(){}
  };
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    addEventListener:(type,fn)=>events.set(type,fn),
    createElement:()=>({click(){downloads.push({filename:this.download,blob:urls.get(this.href)});}})};
  const navigator={onLine:false,...apis.navigator};
  const localStorage={getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>{if(failSnapshot&&key===SLOT)throw new Error('QuotaExceededError');storage.set(key,value);},
    removeItem:key=>storage.delete(key)};
  vm.runInNewContext(script,{document,navigator,localStorage,crypto:webcrypto,TextEncoder,TextDecoder,Blob,
    URL:TestURL,btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary'),
    Date,Intl,setTimeout:()=>1,clearTimeout(){},confirm:()=>allow,
    window:{addEventListener(){},scrollTo(){}},Notification:{permission:'default'},
    location:{protocol:'http:',hostname:'example.org'}},{filename:'app.js'});
  const click=(action,dataset={})=>events.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});
  const file=async(content,{name='incoming.json',id='import-json'}={})=>{
    const text=typeof content==='string'?content:JSON.stringify(content);
    const target={id,files:[{name,size:Buffer.byteLength(text),text:async()=>text}],value:'selected'};
    await events.get('change')({target});
  };
  return {storage,app,toast,downloads,navigator,click,file,field:(id,value)=>inputs.set(id,{value}),
    record:()=>JSON.parse(storage.get(KEY)),setConfirm:value=>{allow=value;},failSnapshots:value=>{failSnapshot=value;}};
}
async function waitUntil(predicate,delay=7000){
  const start=Date.now();
  while(!predicate()){
    if(Date.now()-start>delay)throw new Error('Timed out waiting for async UI update');
    await new Promise(resolve=>setTimeout(resolve,15));
  }
}

test('No geolocation, notification or storage permission is requested on first load; status checks remain prompt-free',async()=>{
  let geolocationCalls=0,statusCalls=0,storageRequests=0;
  const h=harness(legacyRecord(),{navigator:{
    geolocation:{getCurrentPosition(success){geolocationCalls++;success({coords:{latitude:35,longitude:139}});}},
    permissions:{query:async({name})=>{assert.equal(name,'geolocation');statusCalls++;return {state:'prompt'};}},
    storage:{persisted:async()=>false,persist:async()=>{storageRequests++;return false;}}
  }});
  assert.equal(geolocationCalls,0);assert.equal(statusCalls,0);assert.equal(storageRequests,0);
  assert.match(h.app.innerHTML,/Permission and privacy controls/);
  assert.match(h.app.innerHTML,/No account, cloud synchronization or background tracking is connected/);
  const original=h.storage.get(KEY);
  h.click('check-browser-permissions');
  await waitUntil(()=>statusCalls===1);
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(geolocationCalls,0);assert.equal(storageRequests,0);
  h.click('go',{page:'settings'});
  assert.match(h.app.innerHTML,/>prompt<\/span>/);
  assert.match(h.app.innerHTML,/Best-effort storage/);
  h.click('test-location-once');
  assert.equal(geolocationCalls,1);
  h.click('go',{page:'settings'});
  assert.match(h.app.innerHTML,/One-time location test: Available now; coordinates discarded/);
  h.click('request-persistent-storage');await waitUntil(()=>storageRequests===1);
  await new Promise(resolve=>setTimeout(resolve,20));
  h.click('go',{page:'settings'});
  assert.match(h.app.innerHTML,/Not granted \(best-effort\)/);
  assert.equal(h.record().profile.home,'Secret Home Tokyo');
  assert.ok(!h.storage.get(KEY).includes('"latitude"'));
  assert.equal(JSON.parse(original).profile.home,h.record().profile.home);
});

test('Geolocation denial and unsupported browser storage have honest manual fallbacks',()=>{
  const h=harness(legacyRecord(),{navigator:{geolocation:{getCurrentPosition(_ok,error){error({code:1});}}}});
  h.click('test-location-once');h.click('request-persistent-storage');
  h.click('go',{page:'settings'});
  assert.match(h.app.innerHTML,/Denied; manual entry still works/);
  assert.match(h.app.innerHTML,/Not supported/);
  assert.match(h.app.innerHTML,/Bluetooth \/ geofences/);
  assert.match(h.app.innerHTML,/No integration, authorization or revocation yet/);
});

test('Plain v1 imports preview before replacing; cancel retains bytes, and previous snapshot can undo the replacement',async()=>{
  const old=legacyRecord(),raw=JSON.stringify(old),h=harness(raw);
  const incoming=legacyRecord();incoming.profile.home='Different location';incoming.contacts[0].name='New contact';incoming.logs.unshift({date:'New',title:'Extra log',note:'New note'});
  await h.file(incoming);
  assert.match(h.app.innerHTML,/Review before replacing records/);
  assert.match(h.app.innerHTML,/1 contacts · 2 log entries/);
  assert.equal(h.storage.get(KEY),raw);
  h.click('cancel-import');assert.equal(h.storage.get(KEY),raw);
  await h.file(incoming);
  h.setConfirm(false);h.click('apply-import');assert.equal(h.storage.get(KEY),raw);
  h.setConfirm(true);h.click('apply-import');
  assert.equal(h.record().profile.home,'Different location');
  assert.equal(h.record().readiness.custom[0].title,'Prescription glasses');
  assert.equal(h.record().logs.length,2);
  assert.equal(h.storage.get(SLOT),raw,'previous raw bytes must be saved exactly');
  assert.match(h.app.innerHTML,/Review previous local copy/);
  h.click('preview-previous');assert.match(h.app.innerHTML,/Secret Home Tokyo|1 contacts · 1 log entries/);
  h.click('apply-import');
  assert.equal(h.storage.get(KEY),raw,'undo restores the exact original local bytes');
  assert.equal(h.record().contacts[0].name,'Sensitive Person');
  assert.equal(JSON.parse(h.storage.get(SLOT)).profile.home,'Different location');
});

test('Snapshot quota failure and future-version import never overwrite the live record',async()=>{
  const raw=JSON.stringify(legacyRecord()),h=harness(raw);
  await h.file(JSON.stringify({...legacyRecord(),version:999}));
  assert.equal(h.storage.get(KEY),raw);
  assert.match(h.toast.textContent,/Unsupported backup version or format/);
  const incoming=legacyRecord();incoming.profile.home='New';
  await h.file(incoming);h.failSnapshots(true);h.click('apply-import');
  assert.equal(h.storage.get(KEY),raw);
  assert.equal(h.storage.get(SLOT),undefined);
  assert.match(h.toast.textContent,/Could not save the recovery copy/);
  h.failSnapshots(false);h.click('apply-import');assert.equal(h.record().profile.home,'New');
});

test('Unsupported original bytes can be explicitly recovered from the pre-import slot without silent migration',async()=>{
  const future=JSON.stringify({...legacyRecord(),version:27}),h=harness(future),compatible=legacyRecord();
  await h.file(compatible,{id:'import-recovery-json'});
  assert.equal(h.storage.get(KEY),future);
  h.click('apply-import');assert.equal(h.storage.get(SLOT),future);
  h.click('preview-previous');assert.match(h.app.innerHTML,/cannot be read by this version/);
  h.click('apply-import');
  assert.equal(h.storage.get(KEY),future);
  assert.match(h.app.innerHTML,/Saved records need recovery/);
  assert.ok(h.record().version===27);
});

test('Optional encrypted export round-trips privately with a password; wrong password and tampering cannot alter records',async()=>{
  const h=harness(),original=h.storage.get(KEY),secret='my long unique test password 2026';
  h.field('p2c-export-password',secret);h.field('p2c-export-confirm',secret);h.click('export-encrypted');
  await waitUntil(()=>h.downloads.length===1,10000);
  const text=await h.downloads[0].blob.text(),backup=JSON.parse(text);
  assert.equal(h.downloads[0].filename,'disaster-management-encrypted-backup.json');
  assert.equal(backup.format,'disaster-management-encrypted');
  assert.equal(backup.schemaVersion,1);assert.equal(backup.kdf.iterations,600000);
  assert.ok(!text.includes('Secret Home Tokyo')&&!text.includes('Sensitive Person')&&!text.includes('Private incident note'));
  assert.equal(h.storage.get(KEY),original);
  await h.file(backup,{name:'my-encrypted.json'});
  assert.match(h.app.innerHTML,/Unlock encrypted backup/);
  h.field('p2c-unlock-password','a wrong password');h.click('unlock-import');
  await waitUntil(()=>h.toast.textContent.includes('Wrong password'),10000);
  assert.equal(h.storage.get(KEY),original);
  h.field('p2c-unlock-password',secret);h.click('unlock-import');
  await waitUntil(()=>h.app.innerHTML.includes('Review before replacing records'),10000);
  assert.equal(h.storage.get(KEY),original);
  h.click('apply-import');
  assert.equal(h.record().profile.home,'Secret Home Tokyo');
  assert.equal(h.record().readiness.items.water.quantity,9);
  assert.equal(h.record().incident.note,'Private incident note');
  const cipher=backup.cipher.ciphertext;
  const altered={...backup,cipher:{...backup.cipher,ciphertext:(cipher[0]==='A'?'B':'A')+cipher.slice(1)}};
  await h.file(altered);
  h.field('p2c-unlock-password',secret);h.click('unlock-import');
  await waitUntil(()=>h.toast.textContent.includes('Wrong password or damaged'),10000);
  assert.equal(h.record().profile.home,'Secret Home Tokyo');
});

test('Encrypted backup requires matching strong password; damaged metadata is rejected before changing stored data',async()=>{
  const h=harness(),original=h.storage.get(KEY);
  h.field('p2c-export-password','short');h.field('p2c-export-confirm','short');h.click('export-encrypted');
  await waitUntil(()=>h.toast.textContent.includes('between 12 and 256'));
  assert.equal(h.downloads.length,0);
  h.field('p2c-export-password','long enough password');h.field('p2c-export-confirm','different password');h.click('export-encrypted');
  await waitUntil(()=>h.toast.textContent.includes('do not match'));
  assert.equal(h.downloads.length,0);
  await h.file({format:'disaster-management-encrypted',formatVersion:17,schemaVersion:1}, {name:'<img onerror=alert(1)>.json'});
  assert.equal(h.storage.get(KEY),original);
  assert.match(h.toast.textContent,/Unsupported encrypted backup/);
  const tooLarge='x'.repeat(2_000_001);
  await h.file(tooLarge);
  assert.match(h.toast.textContent,/smaller than 2 MB/);
  assert.equal(h.storage.get(KEY),original);
});

test('Erasing clears only this app’s record and one-slot recovery, never sibling-app keys',async()=>{
  const h=harness();h.storage.set(SLOT,'previous');h.storage.set('kg-chart:v1','must remain');
  h.setConfirm(false);h.click('erase');assert.equal(h.storage.get(SLOT),'previous');
  h.setConfirm(true);h.click('erase');
  assert.equal(h.storage.get(SLOT),undefined);
  assert.equal(h.storage.get('kg-chart:v1'),'must remain');
  assert.equal(h.record().contacts.length,0);
});

test('PWA caches Phase 2C styling with the latest owned shell, preserving v1 storage key and original JSON export',()=>{
  assert.match(html,/href="\.\/phase2c\.css"/);
  assert.match(css,/\.p2c-preview/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(worker,/disaster-management-app-v11/);
  assert.match(worker,/\.\/phase2c\.css/);
  assert.match(script,/const KEY = 'disaster-management:v1'/);
  assert.doesNotMatch(script,/localStorage\.clear\(/);
  const h=harness();h.click('export');
  assert.equal(h.downloads[0].filename,'disaster-management-backup.json');
});
