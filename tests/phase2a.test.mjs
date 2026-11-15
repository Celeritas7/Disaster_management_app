import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase2a.css'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const KEY='disaster-management:v1';

function harness(raw) {
  const stored=new Map(raw===undefined?[]:[[KEY,raw]]),listeners=new Map(),inputs=new Map();
  const app={innerHTML:'',contains:()=>true,querySelector:()=>null,querySelectorAll:()=>[]};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    addEventListener:(event,callback)=>listeners.set(event,callback)};
  let agreed=true;
  const window={addEventListener(){},scrollTo(){},location:{href:''}};
  vm.runInNewContext(js,{document,window,navigator:{onLine:false},location:{hostname:'example.org',protocol:'http:'},
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    Date,Intl,Blob,URL,clearTimeout:()=>{},setTimeout:()=>1,confirm:()=>agreed},{filename:'app.js'});
  return {
    app,window,toast,stored,record:()=>JSON.parse(stored.get(KEY)),
    field(id,value,checked=false){inputs.set(id,{value,checked});},
    click(action,dataset={}){listeners.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});},
    input(id,value){const input=inputs.get(id)||{checked:false};input.value=value;inputs.set(id,input);listeners.get('input')({target:{id}});},
    changeRole(index,role){listeners.get('change')({target:{dataset:{contactRole:String(index)},value:role,matches:()=>true}});},
    setConfirm(value){agreed=value;}
  };
}

function oldRecord() {
  return {version:1,page:'settings',tourDone:true,tourStep:3,
    profile:{home:'Tokyo home',office:'Office',shelter:'Community school',safePlace:'Library'},
    checks:{water:true,contacts:true},contacts:[{name:'Family',phone:'+819012345678'},{name:'Friend',phone:'090-8888-7777'}],
    incident:{active:true,step:3,done:{2:[0]},contacted:[1],note:'Keep this note'},
    departure:{wallet:true,pass:false,phone:true,keys:false},strandedStep:0,
    night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
    logs:[{date:'Earlier',title:'My note',note:'Not a fake event'}],rules:[{title:'Check first',trigger:'Before leaving',date:'Earlier'}]};
}

test('Legacy v1 records keep personal details and never acquire fabricated roles or verification',()=>{
  const h=harness(JSON.stringify(oldRecord()));
  assert.match(h.app.innerHTML,/Role not assigned/);
  assert.match(h.app.innerHTML,/Not checked by you/);
  h.click('go',{page:'readiness'});
  const saved=h.record();
  assert.equal(saved.version,1);
  assert.equal(saved.profile.home,'Tokyo home');
  assert.equal(saved.profile.shelter,'Community school');
  assert.equal(saved.profile.station,'');
  assert.equal(Object.keys(saved.profile.placeChecks).length,0);
  assert.equal(saved.contacts[0].role,'unspecified');
  assert.equal(saved.incident.contacted[0],1);
  assert.equal(saved.incident.note,'Keep this note');
  assert.equal(saved.logs[0].note,'Not a fake event');
  assert.equal(saved.rules[0].title,'Check first');
  assert.equal(saved.checks.water,true);
  assert.equal(saved.departure.wallet,true);
});

test('Places record only explicit self-checks; shelter confirmation requires a named municipal source',()=>{
  const h=harness();
  h.click('go',{page:'settings'});
  h.field('home-address','Minami-Urawa');
  h.field('office-address','Work');
  h.field('safe-place','Library');
  h.field('preferred-station','Minami-Urawa Station');
  h.field('shelter-name','Shelter A');
  h.field('shelter-source','');
  h.field('place-verify-home','',true);
  h.field('place-verify-station','',true);
  h.field('place-verify-shelter','',true);
  h.click('save-profile');
  assert.match(h.toast.textContent,/municipality source/);
  assert.equal(h.record().profile.home,'');

  h.field('shelter-source','Municipal notice — printed');
  h.click('save-profile');
  const saved=h.record();
  assert.equal(saved.profile.station,'Minami-Urawa Station');
  assert.equal(saved.profile.shelterSource,'Municipal notice — printed');
  assert.equal(saved.profile.office,'Work');
  assert.ok(saved.profile.placeChecks.home.checkedAt);
  assert.ok(saved.profile.placeChecks.station.checkedAt);
  assert.equal(saved.profile.placeChecks.shelter.source,'municipality-self');
  assert.equal(saved.profile.placeChecks.safePlace,undefined);
  const reopened=harness(h.stored.get(KEY));
  assert.match(reopened.app.innerHTML,/Checked by you/);

  // Edited values clear the visible check and remove old attestation on save.
  reopened.field('home-address','New home');
  reopened.field('office-address','Work');
  reopened.field('safe-place','Library');
  reopened.field('preferred-station','Minami-Urawa Station');
  reopened.field('shelter-name','Shelter A');
  reopened.field('shelter-source','Updated municipal notice');
  for(const key of ['home','station','shelter'])reopened.field('place-verify-'+key,'',true);
  reopened.input('home-address','New home');
  reopened.input('shelter-source','Updated municipal notice');
  reopened.click('save-profile');
  const changed=reopened.record();
  assert.equal(changed.profile.home,'New home');
  assert.equal(changed.profile.placeChecks.home,undefined);
  assert.equal(changed.profile.placeChecks.shelter,undefined);
  assert.equal(changed.profile.placeChecks.station.checkedAt,saved.profile.placeChecks.station.checkedAt);
});

test('Contact roles, explicit priority, edits and deletion keep incident reached marks attached',()=>{
  const h=harness();
  h.click('go',{page:'settings'});
  const add=(name,phone,role)=>{
    h.field('contact-name',name);h.field('contact-phone',phone);h.field('contact-role',role);h.click('add-contact');
  };
  add('First','090-1234-5678','primary');
  add('Second','+91 98765 43210','backup');
  add('Third','+81 90 1111 2222','work');
  assert.equal(h.record().contacts.length,3);
  assert.equal(h.record().contacts[0].role,'primary');
  h.click('go',{page:'incident'});
  h.click('incident-contact',{index:'0'});
  h.click('incident-contact',{index:'2'});
  h.click('go',{page:'settings'});
  h.click('contact-up',{index:'2'});
  let current=h.record();
  assert.deepEqual(Array.from(current.incident.contacted),[0,1]);
  assert.equal(current.contacts[1].name,'Third');
  h.click('remove-contact',{index:'0'});
  current=h.record();
  assert.equal(current.contacts[0].name,'Third');
  assert.deepEqual(Array.from(current.incident.contacted),[0]);
  h.click('contact-edit',{index:'0'});
  h.field('contact-name','Updated Third');
  h.field('contact-phone','+819099998888');
  h.field('contact-role','primary');
  h.click('save-contact');
  assert.equal(h.record().contacts[0].name,'Updated Third');
  assert.equal(h.record().contacts[0].role,'primary');
  assert.equal(h.record().contacts[0].phone,'+819099998888');
  h.changeRole(1,'other');
  assert.equal(h.record().contacts[1].role,'other');
  h.setConfirm(false);h.click('remove-contact',{index:'1'});
  assert.equal(h.record().contacts.length,2);
});

test('Invalid numbers are rejected and SMS needs manual confirmation before opening a draft',()=>{
  const h=harness();
  h.click('go',{page:'settings'});
  h.field('contact-name','Family');
  h.field('contact-phone','+81+90 bad');
  h.field('contact-role','primary');
  h.click('add-contact');
  assert.equal(h.record().contacts.length,0);
  h.field('contact-phone','+819012345678');
  h.click('add-contact');
  assert.equal(h.record().contacts.length,1);
  h.setConfirm(false);h.click('sms-contact',{index:'0'});
  assert.equal(h.window.location.href,'');
  h.setConfirm(true);h.click('sms-contact',{index:'0'});
  assert.match(h.window.location.href,/^sms:\+819012345678\?body=/);
  assert.match(decodeURIComponent(h.window.location.href),/I am safe/);
});

test('New styles and current versioned cache include the Phase 2A UI without changing the data key',()=>{
  assert.match(css,/\.p2a-contact-card/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(html,/href="\.\/phase2a\.css"/);
  assert.match(sw,/disaster-management-app-v8/);
  assert.match(sw,/\.\/phase2a\.css/);
  assert.match(js,/disaster-management:v1/);
  assert.doesNotMatch(js,/localStorage\.clear\(/);
});
