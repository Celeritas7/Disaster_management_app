import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'app.js'),'utf8');
const sw=readFileSync(join(root,'service-worker.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const css=readFileSync(join(root,'phase3c.css'),'utf8');
const KEY='disaster-management:v1';
const v1=()=>({version:1,page:'incident',tourDone:true,tourStep:0,
  profile:{home:'Historic home; NOT a current location',shelter:'Not checked'},checks:{water:true},
  readiness:{items:{water:{quantity:3,target:4,unit:'L',note:'Do not lose'}}},
  contacts:[{name:'Old primary',phone:'+819012345678',role:'primary'}],
  incident:{active:true,step:7,done:{2:[0]},contacted:[0],note:'Private original note'},
  departure:{wallet:true,pass:false,phone:true,keys:false},strandedStep:0,
  night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
  logs:[{date:'Old',title:'Old activity',note:'Do not overwrite'}],rules:[{title:'Old rule',trigger:'Manual',date:'Old'}]});

function harness(record=v1(),opts={}) {
  const stored=new Map(record===null?[]:[[KEY,typeof record==='string'?record:JSON.stringify(record)]]);
  const callbacks=new Map(),inputs=new Map(),app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const window={addEventListener(){},location:{href:''},scrollTo(){}};
  let confirms=0,agree=opts.agree??true,created=0,revoked=0;
  const FileImage=class {set src(value){this.naturalWidth=1200;this.naturalHeight=800;Promise.resolve().then(()=>this.onload?.());}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:inputs.get(id)||null,
    createElement:tag=>tag==='canvas'?{width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=>
      'data:image/jpeg;base64,'+'A'.repeat(120)}:{},
    addEventListener:(name,callback)=>callbacks.set(name,callback)};
  const storage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>{
    if(opts.rejectLarge&&String(value).includes('data:image/jpeg'))throw new Error('QuotaExceeded');
    stored.set(key,value);
  },removeItem:key=>stored.delete(key)};
  const URL={createObjectURL:()=>{created++;return 'blob:test';},revokeObjectURL:()=>{revoked++;}};
  vm.runInNewContext(js,{document,window,navigator:{onLine:false,userAgent:'Test'},
    localStorage:storage,Date,Intl,URL,Image:FileImage,Blob,confirm:()=>{confirms++;return agree;},
    setTimeout:()=>1,clearTimeout(){}},{filename:'app.js'});
  return {app,toast,stored,record:()=>JSON.parse(stored.get(KEY)),
    click(action,dataset={}){callbacks.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});},
    input(id,value){const el={id,value};inputs.set(id,el);callbacks.get('input')({target:el});},
    async photo(files){await callbacks.get('change')({target:{id:'p3c-photo-file',files,value:'chosen.jpg'}});},
    setConfirm(value){agree=value;},get confirms(){return confirms;},get urls(){return {created,revoked};}};
}

test('old v1 records open Phase 3C safely and keep incident, readiness, history and no inferred official damage',()=>{
  const h=harness(),before=v1();
  assert.match(h.app.innerHTML,/Private follow-up evidence/);
  assert.match(h.app.innerHTML,/not an official damage assessment/i);
  assert.match(h.app.innerHTML,/No evidence records yet/);
  assert.doesNotMatch(h.app.innerHTML,/Historic home; NOT a current location/);
  h.input('p3c-evidence-note','Observed cracked wall after reaching a safe place.');
  let record=h.record();
  assert.equal(record.version,1);
  assert.equal(record.evidence.draft.note,'Observed cracked wall after reaching a safe place.');
  assert.equal(record.incident.note,before.incident.note);
  assert.equal(record.checks.water,true);
  assert.equal(record.readiness.items.water.note,'Do not lose');
  assert.equal(record.contacts[0].name,'Old primary');
  h.click('evidence-save');record=h.record();
  assert.equal(record.evidence.entries.length,1);
  assert.equal(record.evidence.draft.note,'');
  assert.equal(record.evidence.entries[0].note,'Observed cracked wall after reaching a safe place.');
  assert.match(record.logs[0].note,/not an official assessment/);
  assert.equal(record.logs.at(-1).note,'Do not overwrite');
  h.click('finish-incident');record=h.record();
  assert.equal(record.incident.active,false);
  assert.equal(record.evidence.entries.length,1);
  assert.match(h.app.innerHTML,/Observed cracked wall/);
  const reload=harness(h.stored.get(KEY));
  assert.equal(reload.record().evidence.entries[0].note,record.evidence.entries[0].note);
  assert.equal(reload.record().version,1);
});

test('draft and saved evidence stay separate during no-network, no-contacts, and an interrupted incident',()=>{
  const old=v1();old.contacts=[];old.incident.contacted=[];
  old.incident.step=3;old.incident.communication={template:'checkin',language:'both',selected:[],entries:{},pendingId:''};
  const h=harness(old);assert.match(h.app.innerHTML,/No contacts saved/);
  h.click('incident-step',{step:'7'});
  h.input('p3c-evidence-note','Note from an offline rehearsal');
  h.click('go',{page:'watch'});
  const resumed=harness(h.stored.get(KEY));
  assert.equal(resumed.record().incident.paused,true);
  assert.match(resumed.app.innerHTML,/Resume earthquake guide/);
  resumed.click('go',{page:'incident'});
  resumed.click('incident-step',{step:'7'});
  assert.match(resumed.app.innerHTML,/Note from an offline rehearsal/);
  assert.equal(resumed.record().evidence.entries.length,0);
  resumed.click('evidence-clear');
  assert.equal(resumed.record().evidence.draft.note,'');
  assert.equal(resumed.record().evidence.entries.length,0);
  assert.equal(resumed.record().contacts.length,0);
});

test('safe selected photo is re-encoded, metadata omitted, draft persisted and removal works without uploads',async()=>{
  const h=harness();
  await h.photo([{type:'image/png',size:200,name:'PERSONAL-LOCATION.png',exifGPS:'fake coordinates'}]);
  const record=h.record(),photo=record.evidence.draft.photos[0];
  assert.equal(photo.id,'p-1');
  assert.match(photo.image,/^data:image\/jpeg;base64,/);
  assert.ok(photo.width<=960);
  assert.equal(record.evidence.draft.photos.length,1);
  assert.doesNotMatch(JSON.stringify(record),/PERSONAL-LOCATION|exifGPS|fake coordinates/);
  assert.equal(h.urls.created,1);assert.equal(h.urls.revoked,1);
  const reboot=harness(h.stored.get(KEY));
  assert.match(reboot.app.innerHTML,/User-selected photo 1/);
  reboot.click('evidence-remove-photo',{id:photo.id});
  assert.equal(reboot.record().evidence.draft.photos.length,0);
});

test('oversized images, invalid files and quota rejection never overwrite prior evidence',async()=>{
  const h=harness();
  h.input('p3c-evidence-note','Keep this note');
  const before=h.stored.get(KEY);
  await h.photo([{type:'image/png',size:8_000_001}]);
  assert.equal(h.stored.get(KEY),before);
  assert.match(h.toast.textContent,/not saved/i);
  await h.photo([{type:'application/pdf',size:20}]);
  assert.equal(h.stored.get(KEY),before);
  const blocked=harness(v1(),{rejectLarge:true});
  await blocked.photo([{type:'image/png',size:500}]);
  assert.equal(blocked.record().evidence,undefined); // unchanged old v1 bytes
  assert.equal(blocked.record().logs.at(-1).note,'Do not overwrite');
});

test('deleting a saved evidence record requires consent and leaves prior logs/contacts intact',()=>{
  const h=harness();h.input('p3c-evidence-note','Manual follow-up');h.click('evidence-save');
  const id=h.record().evidence.entries[0].id;
  h.setConfirm(false);h.click('evidence-delete',{id});
  assert.equal(h.record().evidence.entries.length,1);
  h.setConfirm(true);h.click('evidence-delete',{id});
  const record=h.record();
  assert.equal(record.evidence.entries.length,0);
  assert.equal(record.logs[0].title,'Private evidence deleted');
  assert.equal(record.logs.at(-1).note,'Do not overwrite');
  assert.equal(record.contacts[0].name,'Old primary');
});

test('malformed photo data in an imported v1 record is quarantined; original bytes are untouched',()=>{
  const prior=v1();prior.evidence={draft:{note:'',photos:[]},entries:[{id:'e-1',at:new Date().toISOString(),note:'Evidence',photos:[{id:'p-1',image:'data:image/svg+xml,<svg/>',width:1,height:1}]}],nextId:2,nextPhotoId:2};
  const bytes=JSON.stringify(prior),h=harness(bytes);
  assert.match(h.app.innerHTML,/unknown or damaged app version/);
  assert.equal(h.stored.get(KEY),bytes);
  assert.equal(h.record().evidence.entries.length,1); // raw bytes remain, not normalized
});

test('shell and backup remain v1, no cloud asset or unscoped cache clearing',()=>{
  assert.match(js,/const KEY = 'disaster-management:v1'/);
  assert.match(html,/\.\/phase3c\.css/);
  assert.match(sw,/disaster-management-app-v13/);
  assert.match(sw,/\.\/phase3c\.css/);
  assert.match(sw,/OWNED_CACHE/);
  assert.doesNotMatch(js,/localStorage\.clear\(/);
  assert.match(css,/\.p3c-evidence/);
  assert.match(css,/@media\(max-width:425px\)/);
});
