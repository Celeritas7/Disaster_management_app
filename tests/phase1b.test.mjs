import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase1b.css'),'utf8');
const worker=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';

function harness(raw) {
  const storage=new Map(raw===undefined?[]:[[KEY,raw]]),listeners=new Map();
  const app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:null,
    addEventListener:(name,fn)=>listeners.set(name,fn)};
  const context={document,window:{addEventListener(){},scrollTo(){},location:{reload(){}}},
    localStorage:{getItem:id=>storage.get(id)??null,setItem:(id,v)=>storage.set(id,v),removeItem:id=>storage.delete(id)},
    navigator:{onLine:false},location:{protocol:'http:',hostname:'localhost'},
    Date,Intl,URL,Blob,setTimeout:()=>1,clearTimeout:()=>{},confirm:()=>true};
  vm.runInNewContext(js,context,{filename:'app.js'});
  return {app,storage,record:()=>JSON.parse(storage.get(KEY)),click(action,dataset={}){
    listeners.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});
  }};
}

test('Departure preview is explicitly manual; confirmation and fallback are separate actions',()=>{
  const h=harness();h.click('go',{page:'departure'});
  assert.match(h.app.innerHTML,/in-app lock-screen-style preview/);
  assert.match(h.app.innerHTML,/No geofence, Bluetooth tag or automatic departure detection/);
  assert.match(h.app.innerHTML,/All with me · Save/);
  assert.match(h.app.innerHTML,/Something’s missing/);
  assert.match(h.app.innerHTML,/4 not confirmed/);
  h.click('departure-toggle',{id:'wallet'});
  assert.match(h.app.innerHTML,/3 not confirmed/);
  h.click('departure-missing');
  assert.equal(h.record().page,'stranded');
  assert.equal(h.record().departure.wallet,true);
  h.click('go',{page:'departure'});
  h.click('departure-all');
  assert.equal(h.record().page,'watch');
  assert.equal(h.record().logs[0].title,'Departure check confirmed');
  assert.equal(h.record().departure.wallet,false);
});

test('Stranded shows exactly one primary next action; unknown facts never become invented estimates',()=>{
  const h=harness();h.click('go',{page:'stranded'});
  assert.match(h.app.innerHTML,/NEXT ACTION · 1 OF 5/);
  assert.match(h.app.innerHTML,/Distance<\/span><strong>Unknown/);
  assert.match(h.app.innerHTML,/Walk<\/span><strong>Not calculated/);
  assert.match(h.app.innerHTML,/Cost<\/span><strong>Unverified/);
  assert.doesNotMatch(h.app.innerHTML,/400 m from|last seen|Akatsuki connection is active/);
  h.click('stranded-next');
  assert.match(h.app.innerHTML,/NEXT ACTION · 2 OF 5/);
  assert.equal(h.record().strandedStep,1);
  h.click('stranded-resolved');
  assert.equal(h.record().logs[0].title,'Stranded issue resolved');
});

test('Incident keeps real phone links and visibly distinguishes offline guide from monitoring',()=>{
  const h=harness();h.click('go',{page:'incident'});
  assert.match(h.app.innerHTML,/href="tel:119"/);
  assert.match(h.app.innerHTML,/href="tel:110"/);
  assert.match(h.app.innerHTML,/open the dialer/);
  assert.match(h.app.innerHTML,/Current hazards and routes are not monitored/);
  assert.match(h.app.innerHTML,/Guide navigation; earlier steps are not necessarily completed/);
  assert.doesNotMatch(h.app.innerHTML,/Tsunami.*no warning|battery \d+%|cached map tile/);
});

test('One-item mode saves Done / Can’t / Skip without treating skipped tasks as complete',()=>{
  const h=harness();h.click('go',{page:'incident'});h.click('incident-next');
  h.click('incident-mode');
  assert.match(h.app.innerHTML,/ITEM 1 OF 4/);
  h.click('incident-item-outcome',{index:'0',result:'done'});
  h.click('incident-item-outcome',{index:'1',result:'cant'});
  h.click('incident-item-outcome',{index:'2',result:'skip'});
  const saved=h.record();
  assert.deepEqual(saved.incident.done['2'],[0]);
  assert.equal(saved.incident.outcomes['2']['1'],'cant');
  assert.equal(saved.incident.outcomes['2']['2'],'skip');
  assert.equal(saved.incident.cursor['2'],3);
  assert.equal(saved.incident.oneStep,true);
  const reopened=harness(h.storage.get(KEY));
  assert.match(reopened.app.innerHTML,/ITEM 4 OF 4/);
  assert.match(reopened.app.innerHTML,/1 not confirmed done|3 not confirmed done/);
  reopened.click('incident-item-outcome',{index:'3',result:'done'});
  assert.match(reopened.app.innerHTML,/Checklist reviewed/);
  assert.match(reopened.app.innerHTML,/2 done, 1 can’t do, 1 skipped/);
  reopened.click('incident-item-restart');
  reopened.click('incident-item-outcome',{index:'0',result:'skip'});
  assert.deepEqual(reopened.record().incident.done['2'],[3]);
  assert.equal(reopened.record().incident.outcomes['2']['0'],'skip');
  reopened.click('incident-mode');
  assert.match(reopened.app.innerHTML,/Skipped/);
  reopened.click('incident-toggle',{index:'1'});
  assert.ok(reopened.record().incident.done['2'].includes(1));
  assert.equal(reopened.record().incident.outcomes['2']['1'],undefined);
});

test('Old v1 records are accepted without losing profile, contacts, logs or checklist state',()=>{
  const old={version:1,page:'incident',tourStep:0,tourDone:true,
    profile:{home:'Saved',office:'Office',shelter:'Shelter',safePlace:'Safe'},checks:{water:true},
    contacts:[{name:'Family',phone:'+819000000000'}],
    incident:{active:true,step:2,done:{2:[0]},contacted:[],note:'Saved note'},
    departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    scenario:false,logs:[{date:'Yesterday',title:'Old log',note:'Keep'}],rules:[]};
  const h=harness(JSON.stringify(old));
  assert.match(h.app.innerHTML,/Make the area safe/);
  h.click('incident-mode');
  const saved=h.record();
  assert.equal(saved.version,1);
  assert.equal(saved.profile.home,'Saved');
  assert.equal(saved.contacts[0].name,'Family');
  assert.equal(saved.logs[0].note,'Keep');
  assert.deepEqual(saved.incident.done['2'],[0]);
  assert.equal(saved.incident.oneStep,true);
});

test('Incident log is a review, not a claim that skipped tasks or SMS were completed',()=>{
  const h=harness();h.click('go',{page:'incident'});
  h.click('incident-step',{step:'2'});h.click('incident-mode');
  h.click('incident-item-outcome',{index:'0',result:'cant'});
  h.click('incident-step',{step:'7'});h.click('finish-incident');
  assert.equal(h.record().logs[0].title,'Incident guide reviewed');
  assert.match(h.record().logs[0].note,/1 can’t do, 0 skipped/);
  assert.match(h.record().logs[0].note,/Unfinished items are not complete/);
  assert.equal(h.record().incident.step,1);
});

test('Phase 1B CSS and shell files are cached together for offline use',()=>{
  assert.match(html,/href="\.\/phase1b\.css"/);
  assert.match(css,/\.p1b-incident/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(worker,/disaster-management-app-v5/);
  assert.match(worker,/\.\/phase1b\.css/);
});
