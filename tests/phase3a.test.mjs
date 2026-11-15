import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase3a.css'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';
const oldRecord={version:1,page:'incident',tourStep:0,tourDone:true,
  profile:{home:'Saved home (not current)',office:'Office',shelter:'Municipal site',safePlace:'',station:'Station',shelterSource:'Municipality'},
  checks:{water:true},contacts:[{name:'Family',phone:'+819011112222',role:'primary'}],
  incident:{active:true,step:1,done:{2:[0]},contacted:[],note:'Important private note'},
  departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  scenario:false,logs:[{date:'Old',title:'Old log',note:'Preserve'}],rules:[]};

function harness(raw=JSON.stringify(oldRecord),allowConfirm=true){
  const storage=new Map([[KEY,raw]]),events=new Map(),calls={battery:0,location:0};
  const app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:null,addEventListener:(type,callback)=>events.set(type,callback)};
  const navigator={onLine:false,getBattery(){calls.battery++;throw new Error('Battery API must not be used.');},
    geolocation:{getCurrentPosition(){calls.location++;throw new Error('Location must not be requested.');}}};
  vm.runInNewContext(js,{document,navigator,window:{addEventListener(){},scrollTo(){}},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    location:{protocol:'http:',hostname:'example.invalid'},Date,Intl,Blob,URL,
    setTimeout:()=>1,clearTimeout(){},confirm:()=>allowConfirm},{filename:'app.js'});
  const click=(action,dataset={})=>events.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});
  return {app,storage,calls,click,record:()=>JSON.parse(storage.get(KEY))};
}

test('Current-location call script never silently substitutes the saved home address',()=>{
  const h=harness();
  assert.match(h.app.innerHTML,/今いる場所は［現在地を確認］/);
  assert.match(h.app.innerHTML,/Saved home address \(NOT assumed to be your current position\)/);
  assert.match(h.app.innerHTML,/tel:119/);
  assert.match(h.app.innerHTML,/tel:110/);
  assert.match(h.app.innerHTML,/if it does not open, dial manually/);
  assert.match(h.app.innerHTML,/Current hazards and routes are not monitored/);
  assert.equal(h.calls.location,0);assert.equal(h.calls.battery,0);
});

test('Can’t and Skip are stored as unfinished step outcomes; exiting shows Resume and retains old records',()=>{
  const h=harness(),original=h.record();
  h.click('incident-step-cant');
  assert.equal(h.record().incident.stepOutcomes['1'],'cant');
  assert.match(h.app.innerHTML,/Cannot do this step right now/);
  assert.match(h.app.innerHTML,/<details class="p3a-help" open>/);
  h.click('incident-step-skip');
  assert.equal(h.record().incident.step,2);
  assert.equal(h.record().incident.stepOutcomes['1'],'skip');
  h.click('incident-mode');
  assert.match(h.app.innerHTML,/Help if I can't do this item/);
  h.click('incident-item-outcome',{index:'1',result:'cant'});
  assert.equal(h.record().incident.outcomes['2']['1'],'cant');
  h.click('go',{page:'watch'});
  assert.equal(h.record().incident.paused,true);
  assert.match(h.app.innerHTML,/Resume earthquake guide · step 2 of 7/);
  const reopened=harness(h.storage.get(KEY));
  assert.match(reopened.app.innerHTML,/Resume guide/);
  reopened.click('go',{page:'incident'});
  assert.equal(reopened.record().incident.paused,false);
  assert.equal(reopened.record().incident.outcomes['2']['1'],'cant');
  assert.deepEqual(reopened.record().incident.done['2'],[0]);
  assert.equal(reopened.record().contacts[0].name,original.contacts[0].name);
  assert.equal(reopened.record().profile.home,original.profile.home);
  assert.equal(reopened.record().logs[0].note,original.logs[0].note);
  reopened.click('incident-step',{step:'1'});
  reopened.click('incident-step-clear');
  assert.equal(reopened.record().incident.stepOutcomes['1'],undefined);
});

test('Cannot inadvertently skip urgent call prompt when confirmation is refused',()=>{
  const h=harness(JSON.stringify(oldRecord),false);
  h.click('incident-step-skip');
  assert.equal(h.record().incident.step,1);
  assert.equal(h.record().incident.stepOutcomes?.['1'],undefined);
});

test('Simplified display is manual, persistent, and does not claim battery or hazard measurements',()=>{
  const h=harness();h.click('incident-low-power');
  assert.equal(h.record().incident.lowPower,true);
  assert.match(h.app.innerHTML,/p3a-simple/);
  assert.match(h.app.innerHTML,/does not change device battery settings/);
  h.click('incident-step',{step:'4'});
  assert.match(h.app.innerHTML,/Tsunami status: UNKNOWN/);
  assert.match(h.app.innerHTML,/without waiting for an alert/);
  assert.equal(h.calls.battery,0);assert.equal(h.calls.location,0);
  const reload=harness(h.storage.get(KEY));
  assert.match(reload.app.innerHTML,/p3a-simple/);
  reload.click('incident-low-power');assert.equal(reload.record().incident.lowPower,false);
});

test('171 availability is unknown offline; prompt does not claim recorded or delivered messages',()=>{
  const h=harness();h.click('incident-step',{step:'3'});
  assert.match(h.app.innerHTML,/href="tel:171"/);
  assert.match(h.app.innerHTML,/not an always-on service/);
  assert.match(h.app.innerHTML,/Availability is <strong>unknown in this offline app/);
  assert.match(h.app.innerHTML,/saigai\/news\//);
  assert.match(h.app.innerHTML,/the app cannot call or verify a recording/i);
  assert.doesNotMatch(h.app.innerHTML,/message delivered successfully|sent to all/);
});

test('Review log retains step-level omissions instead of silently treating them as completed',()=>{
  const h=harness();h.click('incident-step-cant');
  h.click('incident-step',{step:'7'});h.click('incident-step-skip');
  h.click('finish-incident');
  assert.equal(h.record().logs[0].title,'Incident guide reviewed');
  assert.match(h.record().logs[0].note,/1 whole steps could not be done and 1 whole steps were skipped/);
  assert.match(h.record().logs[0].note,/Unfinished items are not complete/);
  assert.equal(h.record().incident.active,false);
  assert.equal(h.record().incident.step,1);
});

test('Phase 3A is a cache-owned, offline asset with unchanged v1 storage key',()=>{
  assert.match(html,/href="\.\/phase3a\.css"/);
  assert.match(css,/\.p3a-help/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(sw,/disaster-management-app-v13/);
  assert.match(sw,/\.\/phase3a\.css/);
  assert.match(sw,/OWNED_CACHE/);
  assert.match(js,/const KEY = 'disaster-management:v1'/);
  assert.match(js,/INCIDENT_GUIDANCE_REVIEW = '2026-11-15'/);
});
