import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase1c.css'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';

function harness(raw) {
  const store=new Map(raw===undefined?[]:[[KEY,raw]]),listeners=new Map(),inputs=new Map();
  const app={innerHTML:'',contains:()=>true,querySelector:()=>null,querySelectorAll:()=>[]};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    addEventListener:(event,fn)=>listeners.set(event,fn)};
  const context={document,navigator:{onLine:false},window:{addEventListener(){},scrollTo(){}},
    localStorage:{getItem:key=>store.get(key)??null,setItem:(key,v)=>store.set(key,v),removeItem:key=>store.delete(key)},
    location:{hostname:'localhost',protocol:'http:'},Date,Intl,Blob,URL,
    setTimeout:()=>1,clearTimeout:()=>{},confirm:()=>true};
  vm.runInNewContext(js,context,{filename:'app.js'});
  return {app,store,record:()=>JSON.parse(store.get(KEY)),field(id,value){inputs.set(id,{value});},
    click(action,dataset={}){listeners.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});}};
}

test('Night Out has five manual states and an honest optional timer target',()=>{
  const h=harness();h.click('go',{page:'night'});
  assert.match(h.app.innerHTML,/Nothing planned tonight/);
  assert.match(h.app.innerHTML,/No night history yet/);
  h.click('night-pre');
  assert.match(h.app.innerHTML,/MY PLAN · EDITABLE/);
  h.field('night-limit','2');h.click('night-limit-adjust',{delta:'-1'});
  // Native +/- changes the visible input, without resetting other draft fields.
  h.field('night-limit','0');h.field('night-budget','2400');h.field('night-leave','00:15');h.field('night-mode','taxi');
  const before=Date.now();h.click('night-start');
  const saved=h.record();
  assert.equal(saved.night.phase,'live');
  assert.equal(saved.night.limit,0);
  assert.equal(saved.night.budget,2400);
  assert.equal(saved.night.mode,'taxi');
  assert.ok(saved.night.leaveAt>before && saved.night.leaveAt<before+86400000);
  assert.match(h.app.innerHTML,/Alcohol-free plan/);
  h.click('night-layout',{layout:'timer'});
  assert.match(h.app.innerHTML,/TIME TO YOUR MANUAL LEAVE TARGET/);
  assert.doesNotMatch(h.app.innerHTML,/44 min|last train 00:02|calendar 19:00|train leaves in/);
  const reopened=harness(h.store.get(KEY));
  assert.equal(reopened.record().night.leaveAt,saved.night.leaveAt);
  reopened.click('night-drunk');
  assert.match(reopened.app.innerHTML,/href="tel:119"/);
  assert.match(reopened.app.innerHTML,/呼びかけに反応しない/);
  assert.match(reopened.app.innerHTML,/意識がもうろうとして嘔吐/);
  reopened.click('night-live');
  assert.equal(reopened.record().night.phase,'live');
  reopened.click('night-after');
  assert.match(reopened.app.innerHTML,/Close the loop/);
  reopened.field('night-note','I chose to go home early.');reopened.click('night-log');
  assert.equal(reopened.record().night.phase,'idle');
  assert.equal(reopened.record().logs[0].kind,'night');
  assert.equal(reopened.record().logs[0].status,'recorded');
  assert.match(reopened.app.innerHTML,/Night out recorded/);
  assert.match(reopened.app.innerHTML,/Recorded manually/);
});

test('Expired manual leave target stays passed and legacy active nights do not fake countdown',()=>{
  const base={version:1,page:'night',tourDone:true,tourStep:0,profile:{home:'',office:'',shelter:'',safePlace:''},checks:{},contacts:[],
    incident:{active:false,step:1,done:{},contacted:[],note:''},departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
    night:{phase:'live',limit:2,budget:4000,leave:'22:00',mode:'train',drinks:1,spent:650,note:'',costHistory:[650]},scenario:false,
    logs:[{date:'Earlier',title:'Existing note',note:'Keep content'}],rules:[{title:'Old rule',trigger:'Before leaving',date:'Earlier'}]};
  const old=harness(JSON.stringify(base));old.click('night-layout',{layout:'timer'});
  assert.match(old.app.innerHTML,/Not available for older plans/);
  old.click('go',{page:'log'});
  assert.match(old.app.innerHTML,/Status not recorded/);
  assert.match(old.app.innerHTML,/Saved locally · Does not trigger reminders/);
  const persisted=old.record();
  assert.equal(persisted.logs[0].note,'Keep content');
  assert.equal(persisted.version,1);
  assert.equal(persisted.rules[0].title,'Old rule');
  base.night.leaveAt=Date.now()-10000;
  const passed=harness(JSON.stringify(base));passed.click('night-layout',{layout:'timer'});
  assert.match(passed.app.innerHTML,/Chosen leave time passed/);
  assert.doesNotMatch(passed.app.innerHTML,/01:00:00/);
});

test('After-action examples are editable and only save on explicit confirmation',()=>{
  const h=harness();h.click('go',{page:'reflection'});
  assert.match(h.app.innerHTML,/ONE NEW RULE/);
  assert.match(h.app.innerHTML,/Suggestions are examples you can edit/);
  h.field('reflection-event','I left the house without supplies.');
  h.field('reflection-point','');h.field('reflection-rule','');h.field('reflection-trigger','');
  h.click('reflection-choice',{index:'0'});
  assert.equal(h.record().rules.length,0);
  h.field('reflection-point','I decided to skip the check.');
  h.field('reflection-rule','Check my bag at the door.');
  h.field('reflection-trigger','Before leaving home');
  h.click('save-reflection');
  const saved=h.record();
  assert.equal(saved.rules[0].title,'Check my bag at the door.');
  assert.equal(saved.rules[0].trigger,'Before leaving home');
  assert.equal(saved.logs[0].kind,'reflection');
  assert.equal(saved.logs[0].status,'saved');
  assert.match(h.app.innerHTML,/Saved locally · Does not trigger reminders/);
  assert.doesNotMatch(h.app.innerHTML,/Fires: 3|automatic rule active/i);
});

test('Settings groups sources, privacy, limits, offline, contacts, and recovery honestly',()=>{
  const h=harness();h.click('go',{page:'settings'});
  for(const id of ['sources','privacy','thresholds','offline','details','data'])assert.match(h.app.innerHTML,new RegExp(`id="p1c-${id}"`));
  assert.match(h.app.innerHTML,/without encryption/);
  assert.match(h.app.innerHTML,/No current official feed or timestamps/);
  assert.match(h.app.innerHTML,/No contacts saved/);
  assert.match(h.app.innerHTML,/Choose backup to preview/);
  assert.doesNotMatch(h.app.innerHTML,/Akatsuki connected|live predictions active|verified safe route/);
  h.field('home-address','東京');h.field('office-address','Office');h.field('shelter-name','School');h.field('safe-place','Meetup');
  h.click('save-profile');
  h.field('contact-name','Family');h.field('contact-phone','+819000000000');h.click('add-contact');
  const current=h.record();assert.equal(current.profile.home,'東京');assert.equal(current.contacts[0].name,'Family');
  h.click('go',{page:'incident'});
  assert.match(h.app.innerHTML,/東京/);
  h.click('go',{page:'settings'});
  assert.match(h.app.innerHTML,/Family/);
});

test('Phase 1C has scoped responsive CSS and its own offline cache asset',()=>{
  assert.match(css,/\.p1c-night/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(html,/href="\.\/phase1c\.css"/);
  assert.match(sw,/disaster-management-app-v13/);
  assert.match(sw,/\.\/phase2a\.css/);
  assert.match(sw,/\.\/phase1c\.css/);
  assert.match(sw,/OWNED_CACHE = \/\^disaster-management-app-v/);
});
