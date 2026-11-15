import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const css=readFileSync(join(root,'phase2b.css'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';
const jstDate=offset=>new Date(Date.now()+9*3600000+offset*86400000).toISOString().slice(0,10);

function sampleLegacy() {
  return {version:1,page:'readiness',tourDone:true,tourStep:0,
    profile:{home:'Original home',office:'Office',shelter:'School',safePlace:'Library',station:'Station',shelterSource:'City shelter list',placeChecks:{}},
    checks:{water:true,cash:true,food:true,contacts:true},
    contacts:[{name:'Sibling',phone:'+819012345678',role:'backup'}],
    incident:{active:true,step:3,done:{2:[0]},contacted:[0],note:'Earlier incident'},
    departure:{wallet:true,pass:false,phone:false,keys:false},strandedStep:1,
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    logs:[{date:'Earlier',title:'My log',note:'Personal history'}],rules:[{title:'Keep',trigger:'Before leaving',date:'Earlier'}]};
}

function harness(record) {
  const storage=new Map(record===undefined?[]:[[KEY,typeof record==='string'?record:JSON.stringify(record)]]);
  const events=new Map(),inputs=new Map(),app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  let agree=true;
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    addEventListener:(name,cb)=>events.set(name,cb)};
  vm.runInNewContext(js,{document,window:{addEventListener(){},scrollTo(){},location:{}},navigator:{onLine:false},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    Date,Intl,Blob,URL,clearTimeout(){},setTimeout:()=>1,confirm:()=>agree,
    location:{hostname:'example.org',protocol:'http:'}},{filename:'app.js'});
  const click=(action,dataset={})=>events.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});
  const fields=(id,{quantity='',target='',expiry='',reviewDue='',note='',unit}={})=>{
    for(const [key,value] of Object.entries({quantity,target,expiry,reviewDue,note}))inputs.set('inventory-'+key+'-'+id,{value:String(value)});
    if(unit!==undefined)inputs.set('inventory-unit-'+id,{value:unit});
  };
  return {app,toast,storage,click,fields,record:()=>JSON.parse(storage.get(KEY)),field:(id,value)=>inputs.set(id,{value}),setConfirm:v=>{agree=v;}};
}

test('Pre-2B version-1 records and their exact original checks survive, without invented quantity or review timestamps',()=>{
  const old=sampleLegacy(),h=harness(old);
  assert.match(h.app.innerHTML,/14 core preparation checks/);
  assert.match(h.app.innerHTML,/Target \/ amount unknown/);
  assert.match(h.app.innerHTML,/System verified: none/);
  assert.equal((h.app.innerHTML.match(/class="p2b-inventory-item/g)||[]).length,14);
  assert.match(h.app.innerHTML,/2 \/ 14 counted · 4 marked by you/);
  h.click('go',{page:'watch'});
  const saved=h.record();
  assert.equal(saved.version,1);
  for(const id of ['water','cash','food','contacts'])assert.equal(saved.checks[id],true);
  for(const id of ['firstAid','sanitation','clothing','whistle'])assert.equal(saved.checks[id],false);
  assert.equal(saved.readiness.items.water.quantity,null);
  assert.equal(saved.readiness.items.water.target,null);
  assert.equal(saved.readiness.items.water.reviewedAt,'');
  assert.equal(saved.profile.home,old.profile.home);
  assert.equal(saved.contacts[0].phone,old.contacts[0].phone);
  assert.equal(saved.incident.note,old.incident.note);
  assert.equal(saved.departure.wallet,true);
  assert.equal(saved.logs[0].note,old.logs[0].note);
  assert.equal(saved.rules[0].trigger,old.rules[0].trigger);
});

test('Water target and quantity gaps, changed details, expiry and overdue review never count as ready',()=>{
  const h=harness();h.click('go',{page:'readiness'});
  h.click('toggle-check',{id:'water'});
  assert.equal(h.record().checks.water,true);
  assert.match(h.app.innerHTML,/Target \/ amount unknown/);
  h.fields('water',{quantity:'8',target:'9',expiry:jstDate(30),reviewDue:jstDate(10)});
  h.click('save-inventory-detail',{id:'water'});
  assert.equal(h.record().checks.water,true);
  assert.equal(h.record().readiness.items.water.needsReview,true);
  assert.match(h.app.innerHTML,/Below your target/);
  h.click('confirm-inventory',{id:'water'});
  assert.match(h.app.innerHTML,/Below your target/);
  h.fields('water',{quantity:'9',target:'9',expiry:jstDate(30),reviewDue:jstDate(10)});
  h.click('save-inventory-detail',{id:'water'});
  assert.match(h.app.innerHTML,/Recheck after editing/);
  h.click('confirm-inventory',{id:'water'});
  assert.match(h.app.innerHTML,/1 \/ 14 counted · 1 marked by you/);
  assert.equal(h.record().readiness.items.water.reviewedAt,jstDate(0));
  h.fields('water',{quantity:'9',target:'9',expiry:jstDate(-1),reviewDue:jstDate(10)});
  h.click('save-inventory-detail',{id:'water'});
  assert.match(h.app.innerHTML,/Expired · user-entered/);
  assert.match(h.app.innerHTML,/0 \/ 14 counted · 1 marked by you/);
  h.fields('water',{quantity:'9',target:'9',expiry:jstDate(30),reviewDue:jstDate(-1)});
  h.click('save-inventory-detail',{id:'water'});
  assert.match(h.app.innerHTML,/Review overdue/);
  h.fields('water',{quantity:'9',target:'9',expiry:jstDate(30),reviewDue:jstDate(10)});
  h.click('save-inventory-detail',{id:'water'});
  h.click('confirm-inventory',{id:'water'});
  assert.match(h.app.innerHTML,/1 \/ 14 counted · 1 marked by you/);
});

test('Invalid inventory amounts and dates do not overwrite the saved metadata',()=>{
  const h=harness();h.click('go',{page:'readiness'});
  h.fields('cash',{quantity:'5000',target:'10000'});h.click('save-inventory-detail',{id:'cash'});
  const expected=h.record().readiness.items.cash;
  for(const quantity of ['-1','NaN','1e20','1000000001','12.345']){
    h.fields('cash',{quantity,target:'10000'});
    h.click('save-inventory-detail',{id:'cash'});
    assert.deepEqual(h.record().readiness.items.cash,expected);
  }
  h.fields('cash',{quantity:'10000',target:'10000',expiry:'2026-02-31'});
  h.click('save-inventory-detail',{id:'cash'});
  assert.deepEqual(h.record().readiness.items.cash,expected);
  h.click('toggle-check',{id:'cash'});
  assert.match(h.app.innerHTML,/Below your target/);
});

test('Custom extras are configurable, persist in v1 backups, and never alter the 14-core score',()=>{
  const h=harness();h.click('go',{page:'readiness'});
  h.field('custom-inventory-title','Prescription glasses');h.field('custom-inventory-note','Carry a spare pair');
  h.click('add-custom-inventory');
  let r=h.record();assert.equal(r.readiness.custom.length,1);
  const id=r.readiness.custom[0].id;
  assert.equal(r.readiness.custom[0].note,'Carry a spare pair');
  h.fields(id,{quantity:'1',target:'1',expiry:jstDate(30),unit:'items'});
  h.click('save-inventory-detail',{id});h.click('toggle-check',{id});
  r=h.record();assert.equal(r.readiness.custom[0].checked,true);
  assert.equal(r.readiness.custom[0].quantity,1);
  assert.match(h.app.innerHTML,/0 \/ 14 counted · 0 marked by you/);
  const reopened=harness(r);
  assert.match(reopened.app.innerHTML,/Prescription glasses/);
  assert.equal(reopened.record().readiness.custom[0].checked,true);
  reopened.setConfirm(false);reopened.click('remove-custom-inventory',{id});
  assert.equal(reopened.record().readiness.custom.length,1);
  reopened.setConfirm(true);reopened.click('remove-custom-inventory',{id});
  assert.equal(reopened.record().readiness.custom.length,0);
});

test('Embassy registration is explicitly optional, self-reported and excluded from the score',()=>{
  const h=harness();h.click('go',{page:'readiness'});
  assert.match(h.app.innerHTML,/Not checked \/ unknown/);
  h.field('embassy-status','registered');h.click('save-embassy-status');
  assert.equal(h.record().readiness.embassy.status,'registered');
  assert.equal(h.record().readiness.embassy.updatedAt,jstDate(0));
  assert.match(h.app.innerHTML,/0 \/ 14 counted · 0 marked by you/);
  const reopened=harness(h.record());
  assert.equal(reopened.record().readiness.embassy.status,'registered');
  reopened.field('embassy-status','not-applicable');reopened.click('save-embassy-status');
  assert.equal(reopened.record().readiness.embassy.status,'not-applicable');
});

test('Untrusted custom text is escaped, malformed item metadata is normalized, and future schema stays quarantined',()=>{
  const record=sampleLegacy();
  record.readiness={items:{water:{quantity:-99,target:'false',expiry:'2026-02-31',reviewedAt:'someday'}},
    custom:[{id:'custom-4',title:'<img src=x onerror=alert(1)>',checked:true,quantity:Infinity,expiry:'tomorrow'}],
    nextCustomId:1,embassy:{status:'system-verified',updatedAt:'invalid'}};
  const h=harness(record);
  assert.equal(h.record().readiness.items.water.quantity,-99); // Loading itself must not rewrite storage.
  assert.match(h.app.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(h.app.innerHTML,/<img src=x onerror=/);
  h.click('go',{page:'watch'});
  const saved=h.record();
  assert.equal(saved.readiness.items.water.quantity,null);
  assert.equal(saved.readiness.items.water.expiry,'');
  assert.equal(saved.readiness.custom[0].quantity,null);
  assert.equal(saved.readiness.custom[0].expiry,'');
  assert.equal(saved.readiness.nextCustomId,5);
  assert.equal(saved.readiness.embassy.status,'unknown');
  const future={...record,version:17};
  const raw=JSON.stringify(future),blocked=harness(raw);
  blocked.click('go',{page:'readiness'});
  assert.equal(blocked.storage.get(KEY),raw);
});

test('Phase 2B style remains in the latest owned shell without changing the storage key',()=>{
  assert.match(css,/\.p2b-inventory-item/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(html,/href="\.\/phase2b\.css"/);
  assert.match(sw,/disaster-management-app-v11/);
  assert.match(sw,/\.\/phase2b\.css/);
  assert.match(js,/disaster-management:v1/);
  assert.doesNotMatch(js,/localStorage\.clear\(/);
});
