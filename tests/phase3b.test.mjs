import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase3b.css'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';
const oldRecord=()=>({version:1,page:'incident',tourStep:0,tourDone:true,
  profile:{home:'Old home not current',safePlace:'Old meeting place',office:'Office',shelter:'Shelter'},
  checks:{water:true},contacts:[{name:'First',phone:'+819011112222',role:'primary'},{name:'Second',phone:'+819033334444',role:'backup'}],
  incident:{active:true,step:3,done:{2:[0]},contacted:[0],note:'An earlier private incident note'},
  departure:{wallet:true,pass:false,phone:true,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  scenario:false,logs:[{date:'Old',title:'Prior event',note:'Preserve exactly'}],rules:[{title:'Prior rule',trigger:'When',date:'Old'}]});

function harness(record=oldRecord(),opts={}) {
  const stored=new Map(record===null?[]:[[KEY,typeof record==='string'?record:JSON.stringify(record)]]);
  const listeners=new Map(),inputs=new Map(),app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const window={location:{href:''},addEventListener(){},scrollTo(){}};
  let confirms=0,agree=opts.agree??true;
  const copied=[];
  const navigator={onLine:false,userAgent:opts.userAgent||'Android test',
    clipboard:{writeText:async text=>{copied.push(text);}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    addEventListener:(name,callback)=>listeners.set(name,callback)};
  vm.runInNewContext(js,{document,window,navigator,location:{protocol:'http:',hostname:'example.invalid'},
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    Date,Intl,Blob,URL,confirm:()=>{confirms++;return agree;},setTimeout:()=>1,clearTimeout(){}},{filename:'app.js'});
  return {app,window,toast,stored,copied,record:()=>JSON.parse(stored.get(KEY)),
    click(action,dataset={}){listeners.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});},
    input(id,value){inputs.set(id,{value});listeners.get('input')({target:{id,value}});},
    changeTemplate(value){listeners.get('change')({target:{dataset:{communicationTemplate:value},matches:()=>true}});},
    changeLanguage(value){listeners.get('change')({target:{dataset:{communicationLanguage:value},matches:()=>true}});},
    setConfirm(value){agree=value;},get confirms(){return confirms;}};
}

test('old v1 safety marks and reached contacts never become SMS sent reports',()=>{
  const h=harness(),before=oldRecord();
  assert.equal(h.record().version,1);
  assert.match(h.app.innerHTML,/Request a check-in/);
  assert.match(h.app.innerHTML,/Unsent · no draft confirmed/);
  assert.doesNotMatch(h.app.innerHTML,/Old home not current|Old meeting place/);
  assert.match(h.app.innerHTML,/Reached ✓ \(manual\)/);
  h.click('communication-select',{id:'c-2'});
  const saved=h.record();
  assert.equal(saved.incident.communication.selected[0],'c-2');
  assert.equal(saved.incident.communication.entries['c-2'].status,'unsent');
  assert.equal(saved.incident.contacted[0],0);
  assert.equal(saved.contacts[0].name,before.contacts[0].name);
  assert.equal(saved.incident.note,before.incident.note);
  assert.equal(saved.logs[0].note,before.logs[0].note);
  assert.equal(saved.rules[0].title,before.rules[0].title);
  assert.equal(saved.departure.wallet,true);
  assert.equal(saved.checks.water,true);
});

test('neutral English and Japanese copy never borrows saved addresses; location must be entered now',async()=>{
  const h=harness();
  h.click('copy-message');await Promise.resolve();
  assert.match(h.copied[0],/Please let me know if you are safe/);
  assert.match(h.copied[0],/無事かどうか教えてください/);
  assert.doesNotMatch(h.copied[0],/Old home|Old meeting/);
  h.input('sms-current-location','Tokyo Station west exit');
  h.changeTemplate('help');h.changeLanguage('ja');h.click('copy-message');await Promise.resolve();
  assert.match(h.copied.at(-1),/助けが必要です/);
  assert.match(h.copied.at(-1),/今いる場所（自分で入力）：Tokyo Station west exit/);
  assert.doesNotMatch(h.copied.at(-1),/I need help/);
  h.changeTemplate('safe');h.changeLanguage('en');h.click('copy-message');await Promise.resolve();
  assert.match(h.copied.at(-1),/I am safe right now/);
  assert.match(h.copied.at(-1),/Current location \(entered by me\): Tokyo Station west exit/);
  h.input('sms-current-location','');h.click('copy-message');await Promise.resolve();
  assert.doesNotMatch(h.copied.at(-1),/Current location|Old home/);
  assert.equal(h.record().incident.communication.currentLocation,'');
});

test('priority queue requests ONE SMS draft at a time, with explicit self-reported statuses',()=>{
  const h=harness();
  h.click('communication-select',{id:'c-2'});h.click('communication-select',{id:'c-1'});
  assert.equal(h.record().incident.communication.selected.length,2);
  h.click('communication-next');
  let state=h.record().incident.communication;
  assert.equal(state.pendingId,'c-1'); // priority of Settings, not selection order
  assert.equal(state.entries['c-1'].status,'unsent'); // handoff is not proof of opening
  assert.match(h.window.location.href,/^sms:\+819011112222\?body=/);
  assert.doesNotMatch(decodeURIComponent(h.window.location.href),/Old home/);
  const firstUrl=h.window.location.href;
  h.click('communication-next');assert.equal(h.window.location.href,firstUrl);
  h.click('communication-confirm-open',{id:'c-1'});
  assert.equal(h.record().incident.communication.entries['c-1'].status,'draft-opened');
  assert.equal(h.record().incident.communication.pendingId,'');
  assert.match(h.app.innerHTML,/Draft opened · user-reported, not sent-confirmed/);
  h.click('communication-next');
  assert.match(h.window.location.href,/^sms:\+819033334444\?body=/);
  assert.equal(h.record().incident.communication.pendingId,'c-2');
  h.click('communication-confirm-sent',{id:'c-2'});
  state=h.record().incident.communication;
  assert.equal(state.entries['c-2'].status,'user-confirmed-sent');
  assert.equal(state.pendingId,'');
  assert.match(h.app.innerHTML,/User confirmed Send · delivery UNKNOWN/);
  assert.equal(h.record().logs[0].title,'SMS send reported by user');
  assert.match(h.record().logs[0].note,/Delivery and receipt remain unknown/);
  assert.equal(h.record().logs[1].note,'Preserve exactly');
  h.click('communication-confirm-sent',{id:'c-1'});
  assert.equal(h.record().incident.communication.entries['c-1'].status,'user-confirmed-sent');
  assert.equal(h.record().logs.filter(x=>x.title==='SMS send reported by user').length,2);
});

test('draft cancellation remains unsent and interrupted offline requests can be reconciled after reload',()=>{
  const h=harness();h.click('communication-select',{id:'c-1'});h.click('communication-select',{id:'c-2'});
  h.click('communication-next');
  const restored=harness(h.stored.get(KEY));
  assert.equal(restored.record().incident.communication.pendingId,'c-1');
  assert.match(restored.app.innerHTML,/Draft requested for First · outcome NOT verified/);
  restored.click('communication-no-send',{id:'c-1'});
  const saved=restored.record();
  assert.equal(saved.incident.communication.entries['c-1'].status,'unsent');
  assert.equal(saved.incident.communication.entries['c-1'].skipped,true);
  restored.click('communication-next');
  assert.equal(restored.record().incident.communication.pendingId,'c-2');
  restored.click('go',{page:'watch'});
  assert.equal(restored.record().incident.paused,true);
  const resumed=harness(restored.stored.get(KEY));
  assert.match(resumed.app.innerHTML,/Resume earthquake guide/);
  resumed.click('go',{page:'incident'});
  assert.match(resumed.app.innerHTML,/Draft requested for Second/);
  resumed.click('communication-confirm-open',{id:'c-2'});
  assert.equal(resumed.record().incident.communication.entries['c-2'].status,'draft-opened');
  assert.equal(resumed.record().incident.communication.entries['c-1'].status,'unsent');
});

test('no contacts, invalid numbers, and changed numbers cannot silently start another draft',()=>{
  const empty=oldRecord();empty.contacts=[];empty.incident.contacted=[];
  const h=harness(empty);h.click('communication-next');
  assert.equal(h.window.location.href,'');assert.match(h.app.innerHTML,/No contacts saved/);
  const old=oldRecord();old.contacts[0].phone='bad input';
  const invalid=harness(old);invalid.click('communication-select',{id:'c-1'});
  invalid.click('go',{page:'incident'});
  assert.equal(invalid.record().incident.communication.selected.length,0);
  assert.match(invalid.toast.textContent,/Correct this number/);

  const changed=harness();changed.click('communication-select',{id:'c-1'});
  const record=changed.record();record.contacts[0].phone='+819099998888';
  const reload=harness(record);reload.click('communication-next');
  assert.equal(reload.window.location.href,'');
  assert.match(reload.toast.textContent,/phone number changed/);
  reload.click('communication-reset',{id:'c-1'});
  reload.click('communication-next');
  assert.match(reload.window.location.href,/^sms:\+819099998888\?body=/);
});

test('iPhone uses recipient-only sms: link with explicit copy fallback; no body is claimed prefilled',async()=>{
  const h=harness(oldRecord(),{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)'});
  h.click('communication-select',{id:'c-1'});h.click('copy-message');await Promise.resolve();
  h.click('communication-next');
  assert.equal(h.window.location.href,'sms:+819011112222');
  assert.match(h.toast.textContent,/copy and paste/);
  assert.match(h.copied[0],/無事かどうか/);
  assert.equal(h.record().incident.communication.entries['c-1'].status,'unsent');
});

test('missing or damaged communication metadata never fabricates sent status',()=>{
  const record=oldRecord();
  record.contacts[0].id='c-42';
  record.incident.communication={template:'fictional',language:'unknown',currentLocation:42,selected:['c-42','c-42','c-99'],
    pendingId:'c-99',entries:{'c-42':{status:'delivered',requestedAt:'',phone:'+819011112222'},'c-99':{status:'user-confirmed-sent'}}};
  const h=harness(record);h.click('go',{page:'watch'});
  const comm=h.record().incident.communication;
  assert.equal(comm.template,'checkin');assert.equal(comm.language,'both');
  assert.deepEqual(Array.from(comm.selected),['c-42']);
  assert.equal(comm.entries['c-42'].status,'unsent');assert.equal(comm.entries['c-99'],undefined);
  assert.equal(comm.pendingId,'');
  assert.equal(h.record().version,1);
});

test('finishing incident records summary but does not turn drafts into delivery events or damage existing logs',()=>{
  const h=harness();h.click('communication-select',{id:'c-1'});h.click('communication-next');
  h.click('incident-step',{step:'7'});h.setConfirm(false);h.click('finish-incident');
  assert.equal(h.record().incident.communication.pendingId,'c-1');
  h.setConfirm(true);h.click('finish-incident');
  assert.equal(h.record().incident.communication.selected.length,0);
  assert.equal(h.record().incident.active,false);
  assert.match(h.record().logs[0].note,/0 SMS Send actions reported by user \(delivery unknown\)/);
  assert.equal(h.record().logs[1].note,'Preserve exactly');
});

test('Phase 3B remains an app-owned offline asset and uses unchanged v1 key',()=>{
  assert.match(html,/href="\.\/phase3b\.css"/);
  assert.match(css,/\.p3b-communication/);
  assert.match(css,/@media\(max-width:375px\)/);
  assert.match(sw,/disaster-management-app-v11/);
  assert.match(sw,/\.\/phase3b\.css/);
  assert.match(sw,/OWNED_CACHE/);
  assert.match(js,/const KEY = 'disaster-management:v1'/);
  assert.doesNotMatch(js,/localStorage\.clear\(/);
});
