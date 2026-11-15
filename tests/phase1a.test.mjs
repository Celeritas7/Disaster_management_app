import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=process.env.DMA_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)),'..');
const script=readFileSync(join(root,'app.js'),'utf8');
const css=readFileSync(join(root,'styles.css'),'utf8');
const key='disaster-management:v1';

function browser(initialRaw) {
  const records=new Map(initialRaw?[[key,initialRaw]]:[]);
  const events=new Map();
  const app={innerHTML:'',contains:()=>true,querySelector:()=>null};
  const toast={textContent:'',classList:{add(){},remove(){}}};
  const document={title:'',getElementById:id=>id==='app'?app:id==='toast'?toast:null,
    addEventListener:(name,fn)=>events.set(name,fn)};
  const window={addEventListener(){},scrollTo(){},location:{reload(){}}};
  const context={document,window,navigator:{onLine:false},localStorage:{
    getItem:id=>records.get(id)??null,setItem:(id,value)=>records.set(id,value),removeItem:id=>records.delete(id)},
    Date,Intl,URL,Blob,setTimeout:()=>1,clearTimeout:()=>{},confirm:()=>true,
    location:{protocol:'http:',hostname:'localhost'}};
  vm.runInNewContext(script,context,{filename:'app.js'});
  const click=(action,dataset={})=>events.get('click')({target:{closest:()=>({dataset:{action,...dataset}})},preventDefault(){}});
  return {app,records,click,record:()=>records.has(key)?JSON.parse(records.get(key)):null};
}

test('Watch defaults to a quiet, unconnected state; it never claims conditions are safe',()=>{
  const b=browser();
  assert.match(b.app.innerHTML,/Nothing to preview yet/);
  assert.match(b.app.innerHTML,/Live status unknown/);
  assert.match(b.app.innerHTML,/not monitored/);
  assert.doesNotMatch(b.app.innerHTML,/>All clear</);
  for(const source of ['Weather','Quake activity','Commute','Upcoming trip'])assert.match(b.app.innerHTML,new RegExp(source));
  assert.equal(b.record()?.scenario??false,false);
});

test('Watch demo is explicitly labeled in radar, list, and cards; dismiss restores quiet view',()=>{
  const b=browser();
  b.click('sample');
  assert.match(b.app.innerHTML,/DEMO · NO FORECAST/);
  assert.match(b.app.innerHTML,/No live evidence/);
  assert.doesNotMatch(b.app.innerHTML,/72% conf/);
  b.click('watch-layout',{layout:'list'});
  assert.match(b.app.innerHTML,/DEMO only/);
  assert.match(b.app.innerHTML,/aria-pressed="true">List/);
  b.click('watch-layout',{layout:'card'});
  assert.match(b.app.innerHTML,/DEMO · NOT LIVE/);
  b.click('sample');
  assert.match(b.app.innerHTML,/STATUS UNKNOWN/);
  b.click('watch-layout',{layout:'radar'});
  assert.match(b.app.innerHTML,/Nothing to preview yet/);
  assert.equal(b.record().scenario,false);
});

test('Readiness gap cards and group inventory reflect actual checks, not a fixed example score',()=>{
  const b=browser();
  b.click('go',{page:'readiness'});
  assert.match(b.app.innerHTML,/14 readiness gaps/);
  assert.equal((b.app.innerHTML.match(/class="p1a-gap-card"/g)||[]).length,3);
  assert.match(b.app.innerHTML,/0 \/ 14 counted · 0 marked by you/);
  b.click('toggle-check',{id:'water'});
  assert.match(b.app.innerHTML,/14 readiness gaps/); // Water amount/target are not known.
  assert.match(b.app.innerHTML,/0 \/ 14 counted · 1 marked by you/);
  assert.match(b.app.innerHTML,/Target \/ amount unknown/);
  assert.equal(b.record().checks.water,true);
  assert.equal((b.app.innerHTML.match(/class="p1a-gap-card"/g)||[]).length,3);
  b.click('toggle-check',{id:'food'});
  assert.match(b.app.innerHTML,/13 readiness gaps/);
  assert.match(b.app.innerHTML,/1 \/ 4 counted ready/);
  b.click('toggle-check',{id:'water'});
  assert.equal(b.record().checks.water,false);
});

test('Seven onboarding pages support per-step skip and Back without terminating the tour',()=>{
  const b=browser();
  b.click('go',{page:'onboard'});
  assert.match(b.app.innerHTML,/Setup, step 1 of 7/);
  assert.match(b.app.innerHTML,/Skip this step/);
  b.click('tour-skip-step');
  assert.match(b.app.innerHTML,/Setup, step 2 of 7/);
  assert.equal(b.record().tourDone,false);
  b.click('tour-prev');
  assert.match(b.app.innerHTML,/Setup, step 1 of 7/);
  for(let n=2;n<=7;n++){
    b.click('tour-next');
    assert.match(b.app.innerHTML,new RegExp(`Setup, step ${n} of 7`));
  }
  assert.match(b.app.innerHTML,/Browser permission checks and protected-storage requests only run when you tap/);
  b.click('tour-next');
  assert.equal(b.record().tourDone,true);
  assert.equal(b.record().page,'watch');
});

test('Phase 1A remains responsive and publishes a new owned offline shell revision',()=>{
  assert.match(css,/\.p1a-watch-page/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(max-width:375px\)/);
  const worker=readFileSync(join(root,'service-worker.js'),'utf8');
  assert.match(worker,/disaster-management-app-v10/);
  assert.match(worker,/OWNED_CACHE = \/\^disaster-management-app-v/);
});
