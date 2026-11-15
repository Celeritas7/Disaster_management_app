(() => {
  'use strict';

  // No network or account is required. Entries remain in this browser's storage.
  const KEY = 'disaster-management:v1';
  const VERSION = 1;
  // Keep the storage key stable across future schema revisions. Add one pure
  // migration function for each old version before incrementing VERSION.
  const MIGRATIONS = Object.freeze({});
  let recoveryRaw = null;
  const CHECKS = [
    {id:'water', group:'Survival essentials', title:'Drinking water', note:'Store an appropriate emergency supply and check the expiry dates.', pts:12,unit:'L',critical:true},
    {id:'food', group:'Survival essentials', title:'Shelf-stable food', note:'Food you can eat even if power and cooking are unavailable.', pts:10,unit:'days',critical:true},
    {id:'light', group:'Survival essentials', title:'Torch, radio and batteries', note:'A light and a way to receive official information.', pts:10},
    {id:'power', group:'Survival essentials', title:'Phone power bank charged', note:'Keep the charging cable with your emergency bag.', pts:8},
    {id:'bag', group:'Evacuation kit', title:'Go-bag packed near the door', note:'Shoes, warm layer, hygiene items and essential supplies.', pts:12},
    {id:'documents', group:'Evacuation kit', title:'Important documents accessible', note:'Know where to find passport, residence card, insurance and copies.', pts:10},
    {id:'cash', group:'Evacuation kit', title:'Emergency cash available', note:'Small notes and coins for card or network outages.', pts:8,unit:'JPY'},
    {id:'contacts', group:'Family & location', title:'Emergency contact list ready', note:'Include someone outside your immediate region.', pts:10},
    {id:'shelter', group:'Family & location', title:'Designated shelter verified', note:'Check the official municipality map and walk the route if possible.', pts:10},
    {id:'plan', group:'Family & location', title:'Reunion and check-in plan agreed', note:'Decide where to meet and how to communicate.', pts:10},
    {id:'firstAid', group:'Health & comfort', title:'First-aid and essential medicines', note:'Keep appropriate first-aid items and your own necessary medicines accessible.', pts:10,critical:true},
    {id:'sanitation', group:'Health & comfort', title:'Toilet and hygiene supplies', note:'Prepare portable toilet supplies, hygiene essentials and any personal care items.', pts:10},
    {id:'clothing', group:'Health & comfort', title:'Sturdy shoes and weather protection', note:'Include suitable clothes, gloves and rain or cold-weather protection.', pts:9},
    {id:'whistle', group:'Health & comfort', title:'Whistle and protective items', note:'Keep a whistle and appropriate protective supplies accessible.', pts:9}
  ];
  const CORE_CHECK_IDS = new Set(CHECKS.map(c=>c.id));
  const READINESS_UNITS = ['items','L','days','packs','JPY'];
  const EMBASSY_STATUSES = ['unknown','registered','not-registered','not-applicable'];
  const INCIDENT = [
    {n:1,title:'First, protect yourself',jp:'まず安全を確保',desc:'During shaking, protect your head and stay clear of falling objects.'},
    {n:2,title:'Make the area safe',jp:'身の安全を確認',desc:'When shaking stops, check for immediate hazards.',items:[
      ['Put on sturdy shoes','割れたガラスに注意'],['Check for smoke, fire or gas smells','火災・ガス漏れに注意'],['Keep an exit accessible','避難経路を確保'],['Avoid elevators','エレベーターは使用しない']
    ]},
    {n:3,title:'Tell people you are safe',jp:'安否確認',desc:'Prepare a message. You decide who receives it.'},
    {n:4,title:'Stay or evacuate?',jp:'避難の判断',desc:'Check real alerts and follow local evacuation orders.'},
    {n:5,title:'Water and essentials',jp:'水と備蓄',desc:'Take stock of critical supplies.',items:[
      ['Collect your go-bag','非常持ち出し袋を準備'],['Take water, if safe and available','飲料水を確保'],['Take your phone and charged power bank','携帯・充電器を携行'],['Check on neighbours if it is safe','安全であれば近隣の安否確認']
    ]},
    {n:6,title:'Get verified information',jp:'正確な情報を確認',desc:'Use official sources and avoid unverified social posts.',items:[
      ['Check JMA weather, quake and tsunami information','気象庁の情報を確認'],['Check your municipality’s evacuation notices','自治体の避難情報を確認'],['Check NHK or local radio for updates','NHK・地域のラジオを確認']
    ]},
    {n:7,title:'Document and follow up',jp:'記録と連絡',desc:'When it is safe, record the event and follow up.',items:[
      ['Photograph damage when safe','被害状況を撮影'],['Notify landlord or building manager','大家・管理会社に連絡'],['Tell work or school your situation','職場・学校に連絡'],['Record one preparedness improvement','次回の備えを記録']
    ]}
  ];
  const INC = INCIDENT;
  const STRANDED = [
    {title:'Retrace your steps',description:'Check where you last used your wallet, pass or keys. Return only if it is safe and accessible.',when:'No cost if you can safely retrieve it'},
    {title:'Check mobile payment options',description:'See whether a mobile transit card or payment card is already set up. Verify available funds and battery.',when:'Only if already supported by your device'},
    {title:'Ask station staff for options',description:'Explain what happened and ask what assistance or alternative payment options exist.',when:'Availability depends on operator'},
    {title:'Contact someone you trust',description:'Ask a colleague or friend for help, a transfer, or a place to wait.',when:'Use saved contacts if possible'},
    {title:'Seek help at a nearby 交番',description:'For urgent trouble, explain the situation at a police box. Financial assistance is not guaranteed.',when:'Avoid travelling to a closed or distant office'}
  ];
  // Generic, editable examples from the reference reflection screen. Never
  // infer that any of these events actually occurred for this user.
  const REFLECTION_IDEAS = [
    {point:'I skipped a check before leaving.',rule:'Check the essentials before I leave next time.'},
    {point:'I followed someone else’s plan instead of my own.',rule:'Pause and choose what I actually want to do.'},
    {point:'I ignored a time or spending limit I had chosen.',rule:'Review my limit before making the next decision.'}
  ];
  const LOG_KINDS = ['manual','departure','stranded','incident','night','reflection'];
  const LOG_STATUSES = ['recorded','confirmed','resolved','reviewed','saved'];
  const PLACE_FIELDS = ['home','office','safePlace','station','shelter'];
  const CONTACT_ROLES = ['unspecified','primary','backup','work','other'];
  const CONTACT_ROLE_LABELS = {unspecified:'Role not assigned',primary:'Primary contact',backup:'Backup contact',work:'Work / colleague',other:'Other trusted person'};
  const TOUR = [
    {jp:'はじめに',title:'A quiet watcher for a loud country.',body:'Disaster Management helps you prepare and walks you through difficult moments. Its first version works manually, even without a live feed.',points:[['Guided seven-step earthquake response','Offline guide'],['Checklist, contacts and safety notes','Saved here'],['Weather and quake monitoring','Not connected']]},
    {jp:'持ち出し',title:'Make your emergency kit visible.',body:'A readiness score is only useful when it reflects things you have genuinely checked.',points:[['Mark each item when verified','No assumptions'],['Prepare water, food and a go-bag','Your checklist'],['Remember to review dates','Manual']]},
    {jp:'緊急連絡先',title:'Save who you would contact.',body:'Add a few trusted contacts on your own device. The app helps draft a check-in, but cannot send one secretly.',points:[['Contacts stored in this browser','Local only'],['SMS needs your confirmation','Compose'],['Disaster Message Dial 171','Japan']]},
    {jp:'住所',title:'Know your address and shelter.',body:'Save your home address, workplace and officially verified shelter name. Do not assume a route or facility is safe without current alerts.',points:[['Your address in a Japanese phone script','Personalized'],['Shelter name if confirmed','Manual'],['No location tracking','Current version']]},
    {jp:'持ち物',title:'A two-second departure check.',body:'Before leaving, mark your wallet, pass, phone and keys. If something is missing, browse a practical fallback plan.',points:[['Wallet / pass / phone / keys','Manual'],['Stranded options','Step by step'],['Bluetooth/geofences','Not connected']]},
    {jp:'オフライン',title:'Keep the guide with you.',body:'After loading once and allowing the app to install its offline cache, the interface and saved records can work without internet.',points:[['App shell cached in your browser','Offline'],['Live alerts require internet','Separate'],['No cloud backup yet','Export data']]},
    {jp:'同意',title:'Your safety, your decisions.',body:'No Akatsuki, calendar, Bluetooth or remote data feed is connected in this build. Every action is initiated by you.',points:[['Data remains on this browser','No sign-in'],['Emergency calls open the phone dialer','Your choice'],['You can export or erase records','Settings']]}
  ];
  const SVG = {
    eye:'<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 10v4m0 3h.01"/>',
    bag:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2M3 14h18"/>',
    moon:'<path d="M20 15.1A8.5 8.5 0 0 1 8.9 4 8.5 8.5 0 1 0 20 15.1Z"/>',
    log:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 12h6m-6 5h4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M20 12a8 8 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15.4 3h-4l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 2L5 14.6l2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a8 8 0 0 0 0-2Z"/>',
    pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.6 19.6 0 0 1 2.1 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7l.5 2.7a2 2 0 0 1-.6 1.8L7.6 9.5a16 16 0 0 0 6.9 6.9l1.3-1.3a2 2 0 0 1 1.8-.6l2.7.5a2 2 0 0 1 1.7 2Z"/>',
    message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 6V3h10v3M17 15h2"/>',
    document:'<path d="M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 12h8M8 16h8"/>',
    cloud:'<path d="M20 16.5a4 4 0 0 0-.5-8A7 7 0 0 0 6 9a4 4 0 0 0 0 8h14"/>',
    sunrise:'<path d="M2 18h20M12 3v4m-7-2 3 3m9-3-3 3M5 18a7 7 0 0 1 14 0M3 13l3 1m15-1-3 1"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
    download:'<path d="M12 2v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/>'
  };
  function icon(name, size = '') {
    return `<svg class="ico ${size ? 'ico-'+size : ''}" viewBox="0 0 24 24" aria-hidden="true">${SVG[name] || SVG.info}</svg>`;
  }
  function safe(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function jstDay(date=Date.now()) {
    return new Date(date+9*60*60*1000).toISOString().slice(0,10);
  }
  function validInventoryDate(value) {
    if(typeof value!=='string'||!/^20\d\d-\d\d-\d\d$/.test(value))return false;
    const d=new Date(value+'T00:00:00Z');
    return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function normalizeInventoryDetail(raw,unit='items') {
    const d=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const amount=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))||Number(x)<0||Number(x)>1_000_000_000?null:Math.round(Number(x)*100)/100;
    const date=x=>validInventoryDate(x)?x:'';
    return {quantity:amount(d.quantity),target:amount(d.target),unit:READINESS_UNITS.includes(unit)?unit:'items',
      expiry:date(d.expiry),reviewDue:date(d.reviewDue),reviewedAt:date(d.reviewedAt),
      needsReview:!!d.needsReview,note:typeof d.note==='string'?d.note.slice(0,240):''};
  }
  function inventoryDetail(id) {
    return CORE_CHECK_IDS.has(id)?data.readiness.items[id]:data.readiness.custom.find(c=>c.id===id);
  }
  function readinessStatus(item) {
    const isCustom=!CORE_CHECK_IDS.has(item.id);
    const checked=isCustom?!!item.checked:!!data.checks[item.id];
    const detail=inventoryDetail(item.id)||normalizeInventoryDetail({});
    const today=jstDay();
    if(detail.expiry&&detail.expiry<today)return {key:'expired',label:'Expired · user-entered',reason:'The date you entered has passed. Replace or recheck this item.',ready:false};
    if(detail.reviewDue&&detail.reviewDue<today)return {key:'review-due',label:'Review overdue',reason:'Your scheduled review date has passed. Check this item again.',ready:false};
    if(!checked)return {key:'unchecked',label:'Not checked',reason:'Not yet marked as personally checked.',ready:false};
    if(detail.target!==null && (detail.quantity===null||detail.quantity<detail.target))
      return {key:'short',label:detail.quantity===null?'Quantity unknown':'Below your target',reason:detail.quantity===null?'Enter the amount you have.':'The recorded amount is below your own target.',ready:false};
    if((item.id==='water'||item.id==='cash') && (!detail.target||detail.quantity===null))
      return {key:'unknown',label:'Target / amount unknown',reason:'Enter the amount on hand and your own target to count this item.',ready:false};
    if(detail.needsReview)return {key:'recheck',label:'Recheck after editing',reason:'Details changed since your last check. Confirm the item again.',ready:false};
    return {key:'checked',label:'Checked by you',reason:detail.reviewedAt?'Last checked by you: '+detail.reviewedAt:'Earlier check retained; date unknown',ready:true};
  }
  function defaults() {
    return {version:VERSION,page:'watch',tourStep:0,tourDone:false,profile:{home:'',office:'',shelter:'',safePlace:'',station:'',shelterSource:'',placeChecks:{}},
      checks:{},readiness:{items:{},custom:[],nextCustomId:1,embassy:{status:'unknown',updatedAt:''}},
      contacts:[],incident:{active:false,step:1,done:{},contacted:[],note:'',oneStep:false,cursor:{},outcomes:{}},
      departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
      night:{phase:'idle',limit:2,budget:3000,leave:'23:30',leaveAt:null,mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
      scenario:false,logs:[],rules:[]};
  }
  function normalize(raw) {
    const d=defaults();
    if(!raw || typeof raw!=='object' || raw.version!==VERSION) return d;
    const obj=x=>x && typeof x==='object' && !Array.isArray(x) ? x:{};
    const str=(x,n)=>typeof x==='string'?x.slice(0,n):'';
    const num=(x,max,fallback=0)=>Number.isFinite(Number(x))?Math.max(0,Math.min(max,Math.floor(Number(x)))):fallback;
    const pages=['watch','readiness','incident','departure','stranded','night','log','settings','reflection','onboard'];
    d.page=pages.includes(raw.page)?raw.page:'watch';
    d.tourDone=!!raw.tourDone;d.tourStep=num(raw.tourStep,TOUR.length-1);
    const profile=obj(raw.profile);
    for(const k of [...PLACE_FIELDS,'shelterSource']) d.profile[k]=str(profile[k],240);
    // Optional additive v1 metadata. Never assume old addresses or shelters
    // were checked merely because a name was entered in a previous version.
    for(const k of PLACE_FIELDS){
      const check=obj(obj(profile.placeChecks)[k]),at=str(check.checkedAt,35);
      if(d.profile[k] && (! (k==='shelter') || d.profile.shelterSource)
        && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(at) && Number.isFinite(Date.parse(at)))
        d.profile.placeChecks[k]={checkedAt:at,source:k==='shelter'?'municipality-self':'user-self'};
    }
    for(const c of CHECKS) d.checks[c.id]=!!obj(raw.checks)[c.id];
    // Additive metadata under the existing v1 storage key: old checkmarks are
    // retained verbatim, but absent quantity/expiry fields are UNKNOWN.
    const readiness=obj(raw.readiness),itemDetails=obj(readiness.items);
    for(const c of CHECKS)d.readiness.items[c.id]=normalizeInventoryDetail(itemDetails[c.id],c.unit||'items');
    const seen=new Set();
    for(const rawItem of Array.isArray(readiness.custom)?readiness.custom.slice(0,30):[]){
      if(!rawItem||typeof rawItem!=='object'||!/^custom-\d+$/.test(rawItem.id)||seen.has(rawItem.id))continue;
      const title=str(rawItem.title,90).trim();if(!title)continue;
      seen.add(rawItem.id);
      d.readiness.custom.push({id:rawItem.id,title,checked:!!rawItem.checked,
        ...normalizeInventoryDetail(rawItem,READINESS_UNITS.includes(rawItem.unit)?rawItem.unit:'items')});
    }
    const largest=d.readiness.custom.reduce((n,c)=>Math.max(n,Number(c.id.slice(7))||0),0);
    d.readiness.nextCustomId=Math.max(largest+1,num(readiness.nextCustomId,1_000_000,1));
    const embassy=obj(readiness.embassy);
    d.readiness.embassy={status:EMBASSY_STATUSES.includes(embassy.status)?embassy.status:'unknown',
      updatedAt:validInventoryDate(embassy.updatedAt)?embassy.updatedAt:''};
    d.contacts=(Array.isArray(raw.contacts)?raw.contacts:[]).filter(c=>c&&typeof c.name==='string'&&typeof c.phone==='string')
      .slice(0,100).map(c=>({name:str(c.name,70),phone:str(c.phone,26),
        role:CONTACT_ROLES.includes(c.role)?c.role:'unspecified'}));
    for(const k of Object.keys(d.departure)) d.departure[k]=!!obj(raw.departure)[k];
    d.strandedStep=num(raw.strandedStep,STRANDED.length-1);
    const incident=obj(raw.incident);
    d.incident.active=!!incident.active;d.incident.step=Math.max(1,num(incident.step,7,1));
    d.incident.note=str(incident.note,700);
    d.incident.contacted=(Array.isArray(incident.contacted)?incident.contacted:[]).filter(x=>Number.isInteger(x)&&x>=0&&x<d.contacts.length);
    for(const [k,v] of Object.entries(obj(incident.done))) {
      if(!/^[1-7]$/.test(k)||!Array.isArray(v))continue;
      d.incident.done[k]=v.filter(x=>Number.isInteger(x)&&x>=0&&x<10).slice(0,10);
    }
    // Additive v1 fields: old records without per-item outcomes remain valid.
    // Can't and Skip are NOT completions, and must survive an offline reload.
    d.incident.oneStep=!!incident.oneStep;
    for(const s of INCIDENT.filter(s=>s.items)) {
      const k=String(s.n),cursor=obj(incident.cursor)[k];
      d.incident.cursor[k]=num(cursor,s.items.length,0);
      d.incident.outcomes[k]={};
      for(const [index,result] of Object.entries(obj(obj(incident.outcomes)[k]))) {
        if(!/^\d+$/.test(index)||Number(index)>=s.items.length)continue;
        if((result==='cant'||result==='skip')&&!d.incident.done[k]?.includes(Number(index)))
          d.incident.outcomes[k][index]=result;
      }
    }
    const night=obj(raw.night);
    d.night.phase=['idle','pre','live','after','drunk'].includes(night.phase)?night.phase:'idle';
    d.night.limit=num(night.limit,30,2);d.night.budget=num(night.budget,1000000,3000);
    d.night.leave=nextManualLeaveTime(str(night.leave,5))?night.leave:'23:30';
    d.night.leaveAt=Number.isSafeInteger(night.leaveAt)&&night.leaveAt>946684800000&&night.leaveAt<4102444800000?night.leaveAt:null;
    d.night.mode=['train','taxi','walk','other'].includes(night.mode)?night.mode:'train';
    d.night.drinks=num(night.drinks,500);d.night.spent=num(night.spent,50000000);
    d.night.note=str(night.note,500);
    d.night.costHistory=(Array.isArray(night.costHistory)?night.costHistory:[])
      .filter(x=>Number.isInteger(x)&&x>=0&&x<=100000).slice(-500);
    d.scenario=!!raw.scenario;
    // Existing records lack kind/status. Keep them visible as legacy entries;
    // do not infer successful actions or real-world events from a title alone.
    d.logs=(Array.isArray(raw.logs)?raw.logs:[]).filter(x=>x && typeof x.title==='string').slice(0,150)
      .map(x=>({date:str(x.date,75),title:str(x.title,100),note:str(x.note,700),
        kind:LOG_KINDS.includes(x.kind)?x.kind:'legacy',
        status:LOG_STATUSES.includes(x.status)?x.status:'unknown'}));
    d.rules=(Array.isArray(raw.rules)?raw.rules:[]).filter(x=>x && typeof x.title==='string').slice(0,100)
      .map(x=>({title:str(x.title,250),trigger:str(x.trigger,250),date:str(x.date,75)}));
    return d;
  }
  function migrateRecord(raw) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw) || !Number.isInteger(raw.version) || raw.version<1 || raw.version>VERSION) return null;
    const isObject=x=>x && typeof x==='object' && !Array.isArray(x);
    let record=raw;
    while(record.version<VERSION){
      const step=MIGRATIONS[record.version];
      if(typeof step!=='function')return null;
      const next=step(record);
      if(!next || next.version!==record.version+1)return null;
      record=next;
    }
    // Quarantine incompatible/corrupt records instead of silently replacing them.
    if(!isObject(record.profile) || !isObject(record.checks) || !isObject(record.incident)
       || !isObject(record.departure) || !isObject(record.night)
       || !Array.isArray(record.contacts) || !Array.isArray(record.logs) || !Array.isArray(record.rules))return null;
    return record;
  }
  function load() {
    let saved;
    try { saved=localStorage.getItem(KEY); }
    catch { /* private or disabled storage */ return defaults(); }
    if(saved===null)return defaults();
    try {
      const compatible=migrateRecord(JSON.parse(saved));
      if(compatible)return normalize(compatible);
    } catch { /* unexpected or malformed JSON: keep the original bytes */ }
    recoveryRaw=saved;
    return defaults();
  }
  let data = load();
  let netOnline = navigator.onLine;
  let offlineReady = false;
  let installPrompt = null;
  let toastTimer;
  let workerUpdateReady = false;
  // Presentation-only choice. Do not migrate or rewrite existing version-1 records.
  let watchLayout = 'radar';
  let nightLayout = 'counters';
  let contactEditIndex = null; // UI-only; never confuse editing with a saved contact.
  let inventoryOpenId = null; // UI-only; retain the detail panel being edited.
  const app = document.getElementById('app');
  const readyCount = () => Math.round(100*CHECKS.reduce((n,c)=>n+(readinessStatus(c).ready?c.pts:0),0)/CHECKS.reduce((n,c)=>n+c.pts,0));
  const usableCount = () => CHECKS.filter(c=>readinessStatus(c).ready).length;
  const doneCount = () => CHECKS.filter(c => data.checks[c.id]).length;
  const when = () => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
  const yen = n => '¥'+Number(n || 0).toLocaleString('en-JP');
  const contactRole = role => CONTACT_ROLE_LABELS[role]||CONTACT_ROLE_LABELS.unspecified;
  const checkedPlace = key => {
    const at=data.profile.placeChecks?.[key]?.checkedAt;
    if(!at)return 'Not checked by you';
    return 'Checked by you · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',day:'numeric',month:'short',year:'numeric'}).format(new Date(at));
  };
  function phoneForComposer(value) {
    const phone=String(value||'').trim(),digits=phone.replace(/\D/g,'');
    // Supports both local Japanese and international +E.164-style numbers;
    // formatting is only syntactic and does not prove a number is reachable.
    if(!/^\+?[0-9 ()-]+$/.test(phone)||digits.length<6||digits.length>15||phone.slice(1).includes('+'))return null;
    return (phone.startsWith('+')?'+':'')+digits;
  }
  // Japan has a fixed UTC+09:00 offset. Capture the *specific* next occurrence
  // of a user's selected leave time when their plan starts. Once it passes,
  // never silently roll the target over to tomorrow.
  function nextManualLeaveTime(hhmm,now=Date.now()) {
    const match=/^(\d{2}):(\d{2})$/.exec(hhmm||'');
    if(!match)return null;
    const hour=Number(match[1]),minute=Number(match[2]);
    if(hour>23||minute>59)return null;
    const local=new Date(now+9*60*60*1000);
    const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
    let target=midnight+(hour*60+minute)*60000-9*60*60*1000;
    if(target<=now)target+=86400000;
    return target;
  }
  function manualCountdown(target) {
    if(!Number.isSafeInteger(target))return 'Not available for older plans';
    const seconds=Math.ceil((target-Date.now())/1000);
    if(seconds<=0)return 'Chosen leave time passed';
    return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  const item = (title, note, right = '') => `<li><span>${safe(title)}<br><small class="muted">${safe(note)}</small></span><span>${right}</span></li>`;
  function save() {
    if(recoveryRaw!==null)return false; // Never overwrite an unreadable backup.
    try { localStorage.setItem(KEY,JSON.stringify(data));return true; }
    catch { toast('Local storage is unavailable; your changes may not persist.');return false; }
  }
  function update() { save(); render(); }
  function go(page) { if(page!=='settings')contactEditIndex=null;data.page=page;update();window.scrollTo({top:0,behavior:'instant'}); }
  function toast(message) {
    const el=document.getElementById('toast');
    el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),3300);
  }
  function updateBanner() {
    return `<section id="update-notice" class="info-band blue" role="status" style="margin-bottom:20px;display:block">
      <strong>An app update is ready</strong>
      <p style="margin:8px 0 12px">The new offline files are cached. Reload when it is safe to leave your current screen; any unsaved form text will be lost.</p>
      <div class="form-actions">${action('reload-app','Reload to update','btn-primary')}${action('defer-update','Later','btn-outline')}</div>
    </section>`;
  }
  function showUpdateNotice() {
    workerUpdateReady=true;
    // Insert without re-rendering: never wipe a half-written incident note.
    const workspace=app.querySelector('.workspace');
    if(workspace && !workspace.querySelector('#update-notice'))workspace.insertAdjacentHTML('afterbegin',updateBanner());
  }
  function action(name,label,klass='btn-outline',more='') { return `<button type="button" class="btn ${klass}" data-action="${name}" ${more}>${label}</button>`; }
  function link(url,label) {return `<a class="external-link" href="${url}" target="_blank" rel="noopener noreferrer">${label} ${icon('external','sm')}</a>`;}
  function pageHeader(kicker,title,lead,extra='') {return `<div class="page-header"><div><div class="eyebrow">${kicker}</div><h1 class="page-title">${title}</h1><p class="page-lead">${lead}</p></div><div class="page-date">${extra || when()}<br>JAPAN STANDARD TIME</div></div>`;}
  function scoreRing(size=110) {
    const r=size===150 ? 63:46,circ=2*Math.PI*r,score=readyCount();
    return `<div class="score-ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#2d3b54" stroke-width="8" fill="none"/><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#899fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${circ*score/100} ${circ}"/></svg><strong>${score}</strong><small>/ 100</small></div>`;
  }
  function sideNavButton(name,label,ic,badge='',extra='') {
    return `<button class="nav-button ${data.page===name?'active':''} ${extra}" data-action="go" data-page="${name}" aria-current="${data.page===name?'page':'false'}">${icon(ic)}<span>${label}</span>${badge?'<span class="nav-hint">'+badge+'</span>':''}</button>`;
  }
  function shell(content) {
    const section = data.page;
    return `<div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand"><span class="brand-emblem">${icon('eye','lg')}</span><div><div class="brand-label">Disaster Mgmt</div><div class="brand-sub">WATCH · PREPARE · ACT</div></div></div>
        <div class="nav-section">YOUR COMPANION</div>
        ${sideNavButton('watch','Watch','eye','HOME')}
        ${sideNavButton('readiness','Readiness','shield',readyCount()+'%')}
        ${sideNavButton('departure','Departure check','bag')}
        ${sideNavButton('night','Night Out','moon')}
        <div class="nav-section" style="margin-top:11px">RESPONSE & RECORDS</div>
        ${sideNavButton('incident','Incident guide','alert','','emergency')}
        ${sideNavButton('stranded','Stranded options','pin')}
        ${sideNavButton('log','Activity log','log')}
        <div class="sidebar-spacer"></div>
        ${sideNavButton('settings','Settings & contacts','settings')}
        <div class="privacy-mini"><div class="mini-status"><span class="dot"></span><strong>Private local mode</strong></div><p>No live JMA, train, calendar or Akatsuki connection. Check official alerts yourself.</p></div>
        <div class="build-version">BETA · LOCAL-FIRST VERSION 1.0</div>
      </aside>
      <div class="main">
        <header class="mobile-top"><div class="mobile-brand"><span class="brand-emblem">${icon('eye','sm')}</span>Disaster Management</div>${action('go',icon('alert','sm')+' Incident','btn-danger','data-page="incident"')}</header>
        <main class="workspace" id="main-content">${workerUpdateReady?updateBanner():''}${recoveryRaw!==null?recoveryBanner():''}${content}</main>
      </div>
      <nav class="bottom-nav" aria-label="Mobile navigation">
        ${[['watch','Watch','eye'],['readiness','Ready','shield'],['incident','Incident','alert'],['night','Night','moon'],['log','Log','log']].map(([p,l,i])=>`<button data-action="go" data-page="${p}" class="${section===p?'active':''} ${p==='incident'?'danger':''}" aria-current="${section===p?'page':'false'}">${icon(i)}<span>${l}</span></button>`).join('')}
      </nav>
    </div>`;
  }
  function recoveryBanner() {
    return `<section class="info-band amber" role="alert" style="margin-bottom:20px;display:block">
      <strong>Saved records need recovery</strong>
      <p style="margin:8px 0 12px">This browser has data from an unknown or damaged app version. Its original contents have <strong>not</strong> been replaced. You can still use the emergency guide, but changes made here will not be saved until you restore a compatible backup or deliberately reset.</p>
      <div class="form-actions">${action('export-raw','Download original records','btn-primary')}
        <label class="btn btn-outline" for="import-recovery-json" style="cursor:pointer">Restore a compatible backup</label>
        <input id="import-recovery-json" type="file" accept="application/json,.json" style="display:none" />
        ${action('erase','Reset after backing up','btn-outline')}
      </div></section>`;
  }
  function watchRiskTiles(compact=false) {
    const risks=[
      ['Weather','cloud','No live weather feed'],
      ['Quake activity','alert','No live earthquake feed'],
      ['Commute','sunrise','No train feed or timetable'],
      ['Upcoming trip','pin','No calendar connection']
    ];
    return `<div class="p1a-risk-grid ${compact?'p1a-risk-compact':''}" aria-label="Unconnected monitoring sources">${risks.map(([title,ic,desc])=>`<div class="p1a-risk-tile"><span class="p1a-risk-icon">${icon(ic)}</span><div><strong>${title}</strong><small>Unknown · Not connected</small>${compact?'':`<p>${desc}</p>`}</div></div>`).join('')}</div>`;
  }
  function watch() {
    const score=readyCount(),next=CHECKS.find(c=>!readinessStatus(c).ready);
    const demo=data.scenario;
    const visual=watchLayout==='radar'
      ? `${demo?`<section class="p1a-prediction" aria-label="Demonstration forecast card"><div class="p1a-prediction-top"><span>TOMORROW’S COMMUTE · EXAMPLE</span><span class="p1a-demo-tag">DEMO · NO FORECAST</span></div><h3>What if heavy rain affects your route?</h3><p>This is an imaginary scenario to show how a future recommendation might look. No rain, route, probability or timing has been measured.</p><div class="p1a-prediction-evidence">${icon('info','sm')} Hypothetical situation · No live evidence</div><div class="p1a-prediction-actions">${link('https://www.jma.go.jp/bosai/','Check official JMA weather')}${action('sample','Not relevant · dismiss','btn-outline btn-sm')}</div></section>`
        : `<section class="p1a-quiet" aria-label="Quiet layout, monitoring unavailable"><div class="p1a-radar-art" aria-hidden="true"><span class="p1a-radar-center"></span></div><h2>Nothing to preview yet.</h2><p>Quiet layout only. Weather, earthquakes and transport are <strong>not monitored</strong> by this app. Do not interpret this screen as “all clear.”</p><span class="p1a-quiet-chip">${icon('info','sm')} Live status unknown</span><div>${action('sample','Show example prediction','btn-outline')}</div></section>`}`
      : watchLayout==='list'
        ? `<section class="p1a-watch-list"><h2>${demo?'Example recommendation':'No active example'}</h2><p>${demo?'DEMO only · Heavy rain commute scenario, not a real prediction.':'Live alerts unavailable · This list does not show current hazard conditions.'}</p><div class="p1a-list-item"><span class="p1a-list-dot"></span><div><strong>${demo?'DEMO · Could rain disrupt your commute?':'Monitoring not connected'}</strong><small>${demo?'Hypothetical only — verify with JMA and your operator.':'Weather, earthquakes and transit are unknown.'}</small></div>${action('sample',demo?'Dismiss':'Restore demo','btn-quiet btn-sm')}</div>${watchRiskTiles(true)}</section>`
        : `<section class="p1a-watch-cards"><div class="p1a-card-feature"><span class="p1a-demo-tag">${demo?'DEMO · NOT LIVE':'STATUS UNKNOWN'}</span><h2>${demo?'Example: Change of commute plans':'Monitoring is not connected'}</h2><p>${demo?'Imaginary heavy-rain case. No actual forecast or confidence is available.':'No hazard feeds are available. Please consult official sources.'}</p>${action('sample',demo?'Dismiss example':'Show example prediction','btn-outline btn-sm')}</div>${watchRiskTiles(true)}</section>`;
    return `<section class="p1a-watch-page" aria-label="Watch dashboard">
      <div class="p1a-watch-top"><div class="p1a-kicker">${icon('eye','lg')} <span>WATCH</span></div><div class="p1a-watch-time">${when()} JST</div></div>
      ${!data.tourDone?`<div class="card-soft setup-row p1a-start-tour"><span class="tile-icon">${icon('sunrise')}</span><div style="flex:1"><h3>Set up your safety companion</h3><p>Seven short, honest steps. No live monitoring or permissions are active.</p></div>${action('go','Start setup '+icon('chevron','sm'),'btn-primary','data-page="onboard"')}</div>`:''}
      <div class="p1a-watch-intro"><div class="p1a-watch-state ${demo?'is-demo':''}"><span class="p1a-state-dot"></span><h1>${demo?'One thing to look at':'A quieter place to prepare.'}</h1></div><p>${demo?'Illustrative advice only · Not based on current conditions.':'Local guidance is ready. Current hazards remain unknown.'}</p></div>
      <div class="p1a-layout-selector" role="group" aria-label="Watch display layout">${[['radar','Radar'],['list','List'],['card','Cards']].map(([id,label])=>`<button type="button" data-action="watch-layout" data-layout="${id}" class="${watchLayout===id?'is-active':''}" aria-pressed="${watchLayout===id}">${label}</button>`).join('')}</div>
      ${visual}
      ${watchLayout==='radar'?watchRiskTiles():''}
      <section class="p1a-readiness-strip"><div>${scoreRing()}<div><span class="p1a-section-label">YOUR READINESS · SELF-REPORTED</span><strong>${usableCount()} / ${CHECKS.length} core items counted ready</strong><small>${next?'Next gap: '+safe(next.title)+' · '+safe(readinessStatus(next).label):'All core items currently counted; review them regularly.'}</small></div></div>${action('go','Review readiness '+icon('arrow','sm'),'btn-primary','data-page="readiness"')}</section>
      <div class="section-heading"><h2>Do something useful now</h2><small>Manual tools, available offline</small></div>
      <div class="action-grid">${tile('incident','Emergency guide','7-step earthquake response','alert','red')}${tile('departure','Departure check','Wallet, pass, phone and keys','bag','')}${tile('stranded','Stranded options','Try a practical fallback','pin','amber')}${tile('night','Night Out','Set limits before leaving','moon','green')}</div>
      <div class="info-band blue p1a-official"><span>${icon('info')}</span><div><strong>Watch does not monitor hazards yet.</strong> A quiet animation or an example card does not indicate your surroundings are safe. For current warnings, use official agencies and local evacuation notices.<div class="link-list" style="margin-top:12px">${link('https://www.jma.go.jp/bosai/','JMA 防災')}${link('https://www.bousai.go.jp/','Cabinet Office 防災')}</div></div></div>
      <p class="lastline">${netOnline?'Browser reports an internet connection.':'You are currently offline.'} · ${offlineReady?'App shell cached for offline access.':'The app will cache its files when browser permissions allow.'} · Records stay on this device.</p>
    </section>`;
  }
  function tile(page,title,note,ic,color) {
    return `<button class="action-tile" data-action="go" data-page="${page}"><span class="tile-icon ${color}">${icon(ic)}</span><span class="tile-title">${title}</span><span class="tile-note">${note}</span></button>`;
  }
  function inventoryCard(item,isCustom=false) {
    const detail=inventoryDetail(item.id)||normalizeInventoryDetail({},item.unit||'items');
    const status=readinessStatus(item),checked=isCustom?!!item.checked:!!data.checks[item.id];
    const unit=detail.unit||'items',id=item.id;
    const val=value=>value===null?'':String(value);
    const namedDate=(label,key)=>`<label class="p2b-field">${label}<input id="inventory-${key}-${id}" type="date" value="${safe(detail[key])}" /></label>`;
    const amount=(label,key)=>`<label class="p2b-field">${label} (${safe(unit)})<input id="inventory-${key}-${id}" type="number" min="0" max="1000000000" step="${unit==='JPY'||unit==='items'||unit==='packs'?'1':'0.01'}" inputmode="decimal" value="${val(detail[key])}" placeholder="Not entered" /></label>`;
    return `<article class="p2b-inventory-item p2b-status-${status.key}" id="readiness-${id}">
      <div class="p2b-item-top"><button type="button" class="p2b-check-button ${checked?'is-checked':''}" data-action="toggle-check" data-id="${id}" aria-pressed="${checked}" aria-label="${checked?'Undo check for':'Mark checked by me:'} ${safe(item.title)}">${icon('check','sm')}</button><div class="p2b-item-main"><strong>${safe(item.title)}</strong><p>${safe(item.note)}</p><span class="p2b-status-badge ${status.key}">${safe(status.label)}</span><small>${safe(status.reason)}${detail.reviewedAt?' · Last self-check: '+safe(detail.reviewedAt):''}</small></div>${isCustom?'<span class="p2b-unweighted">Extra</span>':`<span class="check-weight">${item.pts} pts</span>`}</div>
      <details class="p2b-item-details" id="details-${id}" ${inventoryOpenId===id?'open':''}><summary>Quantity, expiry &amp; review details</summary><div class="p2b-detail-grid">${amount('Amount on hand','quantity')}${amount('My target','target')}${namedDate('Expiry date · if applicable','expiry')}${namedDate('Next review due','reviewDue')}${isCustom?`<label class="p2b-field">Unit<select id="inventory-unit-${id}">${READINESS_UNITS.map(u=>`<option value="${u}" ${unit===u?'selected':''}>${u}</option>`).join('')}</select></label>`:''}<label class="p2b-field p2b-note">Private note<input id="inventory-note-${id}" maxlength="240" value="${safe(detail.note)}" placeholder="Storage place, replacement reminder…" /></label></div><p class="p2b-detail-help">Dates and amounts are entered by you. Editing details requires a fresh personal check before this item counts as ready. Nothing is independently inspected.</p><div class="p2b-detail-actions">${action('save-inventory-detail','Save details','btn-outline',`data-id="${id}"`)}${action('confirm-inventory','I checked this item today','btn-primary',`data-id="${id}"`)}${isCustom?action('remove-custom-inventory','Remove extra','btn-quiet',`data-id="${id}"`):''}</div></details>
    </article>`;
  }
  function readiness() {
    const groups=[...new Set(CHECKS.map(c=>c.group))];
    const remaining=CHECKS.length-usableCount();
    const gaps=CHECKS.filter(c=>!readinessStatus(c).ready).sort((a,b)=>Number(!!b.critical)-Number(!!a.critical)).slice(0,3);
    const expired=CHECKS.filter(c=>readinessStatus(c).key==='expired').length;
    const embassy=data.readiness.embassy;
    return `<section class="p1a-readiness-page p2b-readiness">${pageHeader('READINESS · 備え','A kit you can actually review.','14 core preparation checks plus your optional extras. All details are self-reported and kept in this browser; this is not a safety certification.')}
      <div class="p1a-readiness-overview">${scoreRing(150)}<div><h2>${remaining?`${remaining} readiness gaps`:'All 14 core items counted ready'}</h2><p>Weighted score counts only core items that you marked and whose recorded dates and required quantities do not show a gap. It cannot verify the items physically or guarantee safety.</p><span class="p1a-quiet-chip">${usableCount()} / ${CHECKS.length} counted · ${doneCount()} marked by you${expired?' · '+expired+' expired':''}</span></div></div>
      <div class="p2b-status-key" aria-label="Readiness status explanations"><span>✓ Checked by you: self-attested</span><span>! Unknown: details needed</span><span>! Expired / review due: not counted</span><span>System verified: none</span></div>
      <div class="p1a-gap-heading"><span class="p1a-section-label">${remaining?'THREE PRIORITY GAPS':'MAINTENANCE'}</span><small>Review your entries before confirming</small></div>
      <div class="p1a-gap-grid">${gaps.map(c=>{const s=readinessStatus(c);return `<article class="p1a-gap-card"><div><strong>${safe(c.title)}</strong><p>${safe(s.reason)}</p><small>${safe(s.label)}</small></div>${s.key==='unchecked'&&c.id!=='water'&&c.id!=='cash'?`<button class="p1a-gap-action" type="button" data-action="toggle-check" data-id="${c.id}" aria-label="Mark checked by me: ${safe(c.title)}">Mark checked by me ${icon('arrow','sm')}</button>`:`<button class="p1a-gap-action" type="button" data-action="focus-inventory" data-id="${c.id}">Review item details ${icon('arrow','sm')}</button>`}</article>`;}).join('')||'<div class="info-band blue">No current core gaps. Review quantities, expiry dates and physical supplies regularly.</div>'}</div>
      <div class="info-band blue p2b-guide">${icon('info')}<div><strong>Choose realistic targets.</strong> The Japanese Cabinet Office recommends planning home drinking-water supplies around 3 L per person per day for at least three days. A portable go-bag is different: keep it carryable. These are guidance, not quantities automatically assigned to you. ${link('https://www.bousai.go.jp/kyoiku/hokenkyousai/check.html','Official preparation guidance')}</div></div>
      <div class="p1a-gap-heading"><span class="p1a-section-label">CORE INVENTORY</span><small>${CHECKS.length} items · custom amounts and dates</small></div>
      <div class="p1a-inventory-summary">${groups.map(g=>{const entries=CHECKS.filter(c=>c.group===g),count=entries.filter(c=>readinessStatus(c).ready).length;return `<div><span>${safe(g)}</span><strong>${count} / ${entries.length} counted ready</strong></div>`;}).join('')}</div>
      ${groups.map(g=>`<section class="subsection"><div class="section-heading"><h2>${safe(g)}</h2><small>Open a row to edit details</small></div><div class="p2b-inventory-list">${CHECKS.filter(c=>c.group===g).map(c=>inventoryCard(c)).join('')}</div></section>`).join('')}
      <section class="p2b-custom-section"><div class="section-heading"><h2>Your extra items</h2><small>Not included in the 100-point core score</small></div><p>Add personal essentials without changing the 14-item baseline or previously saved checks.</p><div class="p2b-inventory-list">${data.readiness.custom.map(c=>inventoryCard(c,true)).join('')}</div>${data.readiness.custom.length===0?'<p class="p2b-empty">No extra items added yet.</p>':''}<div class="p2b-add-form"><label class="p2b-field">New item name<input id="custom-inventory-title" type="text" maxlength="90" placeholder="e.g. Glasses, pet supplies" /></label><label class="p2b-field">Notes · optional<input id="custom-inventory-note" type="text" maxlength="240" placeholder="What to pack or review" /></label>${action('add-custom-inventory','Add extra item '+icon('plus','sm'),'btn-primary')}</div></section>
      <section class="p2b-embassy-section"><div class="section-heading"><h2>Embassy registration · if relevant</h2></div><p>For foreign residents: track whether you registered with your own embassy. This is an optional personal reminder, not checked against an embassy database and not part of the readiness score.</p><label class="p2b-field">My reported status<select id="embassy-status">${[['unknown','Not checked / unknown'],['not-registered','Not registered'],['registered','I registered myself'],['not-applicable','Not applicable to me']].map(([value,label])=>`<option value="${value}" ${embassy.status===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="p2b-detail-actions">${action('save-embassy-status','Save my status','btn-outline')}<small>${embassy.updatedAt?'Last updated by you: '+safe(embassy.updatedAt):'No status confirmation date saved'}</small></div></section>
      <div class="section-heading"><h2>Personal details</h2></div><div class="info-band blue">${icon('pin')}<div>Save your shelter and emergency contacts from Settings. These are user-entered, not independently verified. ${action('go','Open settings','btn-quiet btn-sm','data-page="settings"')}</div></div>
      </section>`;
  }
  function incident() {
    const i=data.incident,step=INC[i.step-1],total=INC.length;
    return `<div class="incident-page p1b-incident" role="region" aria-label="Offline earthquake response guide">
      <div class="p1b-incident-top"><span>EARTHQUAKE · 地震</span><span>STEP ${i.step} / ${total}</span></div>
      <div class="p1b-incident-progress" role="group" aria-label="Guide navigation; earlier steps are not necessarily completed">${INC.map(x=>`<button type="button" class="p1b-incident-segment ${x.n<i.step?'past':''} ${x.n===i.step?'current':''}" data-action="incident-step" data-step="${x.n}" aria-label="Go to step ${x.n}: ${safe(x.title)}" ${x.n===i.step?'aria-current="step"':''}></button>`).join('')}</div>
      <header class="p1b-incident-header"><div class="p1b-overline">${i.active?'GUIDE IN PROGRESS':'OFFLINE GUIDE READY'}</div><h1>${step.n===1?'Are you hurt?':safe(step.title)}</h1><p class="p1b-incident-jp">${step.n===1?'怪我をしていますか？':safe(step.jp)}</p><p class="p1b-incident-lead">${safe(step.desc)}</p></header>
      <div class="p1b-emergency-bar" role="note">${icon('alert')}<span>Protect yourself during shaking. Emergency calls open your phone dialer: <a href="tel:119">119 · Ambulance / fire</a> or <a href="tel:110">110 · Police</a>. Current hazards and routes are not monitored.</span></div>
      ${incidentBody(step)}
      <div class="p1b-incident-controls">${action('incident-prev','← Previous step','btn-outline',i.step===1?'disabled':'')}${action(i.step===7?'finish-incident':'incident-next',i.step===7?'Save review to log':'Continue to step '+(i.step+1)+' →','btn-primary')}${action('go','Leave guide (progress saved)','btn-quiet','data-page="watch"')}</div>
      <p class="p1b-incident-footnote">Step position does not mean tasks are done. Manual progress is saved on this device. ${netOnline?'Browser reports connected; live alerts are not connected.':'Browser reports offline; use locally available official information and emergency services.'}</p>
    </div>`;
  }
  function incidentBody(step) {
    const i=data.incident,done=i.done[i.step]||[];
    if(step.n===1) return `<section class="p1b-incident-card p1b-call-card"><p>Call if anyone needs urgent medical assistance or is in danger. These links open the dialer; the app does not place a call by itself.</p><div class="p1b-call-buttons"><a class="p1b-call-primary" href="tel:119"><span><strong>Yes — call 119</strong><small>救急・消防 · Ambulance / Fire</small></span>${icon('phone','lg')}</a><a class="p1b-call-secondary" href="tel:110"><span><strong>Danger / crime — 110</strong><small>警察 · Police</small></span>${icon('phone','lg')}</a></div><div class="p1b-phone-script"><span>SAY ON THE PHONE · 日本語</span><strong>救急です。住所は${safe(data.profile.home||'［住所］')}です。</strong><small>“I need an ambulance. My address is …” Verify your location before speaking.</small></div></section>`;
    if(step.items) {
      const statuses=i.outcomes[i.step]||{},cursor=Math.min(i.cursor[i.step]||0,step.items.length);
      const complete=step.items.filter((_,k)=>done.includes(k)).length;
      const reviewed=step.items.filter((_,k)=>done.includes(k)||statuses[k]).length;
      const unresolved=step.items.length-complete;
      const focused=cursor<step.items.length?step.items[cursor]:null;
      return `<section class="p1b-incident-card p1b-checklist-card"><div class="p1b-checklist-heading"><div><h2>${i.oneStep?'One item at a time':'Safety checklist'}</h2><p>${reviewed} of ${step.items.length} reviewed · ${unresolved} not confirmed done. If unsafe, choose “Can’t” or “Skip” and continue.</p></div>${action('incident-mode',i.oneStep?'Show full checklist':'One at a time','btn-outline btn-lg')}</div>
      ${i.oneStep ? (focused ? `<div class="p1b-one-progress">ITEM ${cursor+1} OF ${step.items.length} · ${done.includes(cursor)?'MARKED DONE':statuses[cursor]==='cant'?'CAN’T DO':statuses[cursor]==='skip'?'SKIPPED':'NOT REVIEWED'}</div><div class="p1b-one-item"><h3>${safe(focused[0])}</h3><p lang="ja">${safe(focused[1])}</p></div><div class="p1b-one-actions"><button type="button" class="p1b-one-done" data-action="incident-item-outcome" data-index="${cursor}" data-result="done">Done ${icon('check','sm')}</button><button type="button" class="p1b-one-cant" data-action="incident-item-outcome" data-index="${cursor}" data-result="cant">Can’t do</button><button type="button" class="p1b-one-skip" data-action="incident-item-outcome" data-index="${cursor}" data-result="skip">Skip for now</button></div>${cursor>0?action('incident-item-prev','← Previous item','btn-quiet btn-lg'):''}` : `<div class="p1b-one-summary"><h3>Checklist reviewed</h3><p>${complete} done, ${Object.values(statuses).filter(s=>s==='cant').length} can’t do, ${Object.values(statuses).filter(s=>s==='skip').length} skipped. Unfinished actions are not marked complete. Revisit them if conditions allow.</p>${action('incident-item-restart','Review items again','btn-outline btn-lg')}</div>`) : `<div class="p1b-list-items">${step.items.map(([t,j],k)=>{const status=done.includes(k)?'done':statuses[k]||'pending';return `<button class="p1b-list-item ${status}" data-action="incident-toggle" data-index="${k}" aria-pressed="${status==='done'}" aria-label="${safe(t)} · ${status==='done'?'Done, tap to undo':status==='cant'?'Can’t do; tap to mark done':status==='skip'?'Skipped; tap to mark done':'Not reviewed; tap to mark done'}"><span class="p1b-list-mark">${status==='done'?icon('check','sm'):''}</span><span class="p1b-list-text"><strong>${safe(t)}</strong><small lang="ja">${safe(j)}</small></span><span class="p1b-list-status">${status==='done'?'Done':status==='cant'?'Can’t':status==='skip'?'Skipped':'Pending'}</span></button>`;}).join('')}</div>`}
        ${step.n===2?`<div class="info-band amber" style="margin-top:17px">${icon('alert')}<div>If shaking starts again, drop, cover your head, and hold on. Avoid operating gas equipment if you suspect a leak.</div></div>`:''}
        ${step.n===6?`<div class="link-list" style="margin-top:18px">${link('https://www.jma.go.jp/bosai/','JMA official updates')}${link('https://www.nhk.or.jp/kishou-saigai/','NHK disaster info')}</div>`:''}
        ${step.n===7?`<div class="text-field" style="margin-top:20px"><label for="incident-note">What happened / what to improve</label><textarea id="incident-note" data-save-field="incident.note" placeholder="For your private incident log…">${safe(i.note)}</textarea></div>`:''}
      </section>`;
    }
    if(step.n===3) return `<section class="incident-step-card"><h3>Draft a safety message</h3><p>Check the details before sending. Copying or opening SMS does not mean a message was delivered.</p>
      <div class="card-soft card-pad"><div class="sublabel">MESSAGE · ENGLISH / 日本語</div><p style="color:#e8efff;font-size:15px">${safe(safetyMessage())}</p><p style="color:#b3bfd6;font-size:14px">無事です。今は${safe(data.profile.safePlace||'［現在地］')}にいます。また連絡します。</p>${action('copy-message',icon('copy','sm')+' Copy message','btn-primary')}</div>
      <div class="section-heading"><h2>Emergency contacts</h2><small>${data.contacts.length} saved</small></div>
      ${data.contacts.length?data.contacts.map((c,k)=>`<div class="contact-row"><div><div class="contact-name">${safe(c.name)}</div><div class="contact-meta">${safe(contactRole(c.role))} · ${safe(c.phone)} · Priority ${k+1}</div></div><div class="form-actions" style="margin:0">${action('sms-contact','Review SMS draft','btn-outline btn-sm',`data-index="${k}"`)}${action('incident-contact',i.contacted.includes(k)?'Reached ✓':'Mark reached',i.contacted.includes(k)?'btn-success btn-sm':'btn-outline btn-sm',`data-index="${k}"`)}</div></div>`).join(''):`<div class="info-band amber">${icon('info')}<div>No contacts saved yet. Add them from Settings. ${action('go','Add contacts','btn-quiet btn-sm','data-page="settings"')}</div></div>`}
      <div class="info-band blue" style="margin-top:18px">${icon('phone')}<div><strong>Disaster Message Dial 171 · 災害用伝言ダイヤル</strong><br>Call <a href="tel:171">171</a> and follow voice prompts. Press 1 to record or 2 to listen, then follow the requested phone-number steps. <a href="https://www.ntt-east.co.jp/en/saigai/voice171s/rec.html" target="_blank" rel="noopener noreferrer">NTT instructions</a>.</div></div></section>`;
    if(step.n===4) return `<section class="incident-step-card"><h3>Use current, verified warnings.</h3><p>This app has no live quake, tsunami, shelter availability or route feed. Never rely on a demonstration map for evacuation.</p>
      <div class="callout-steps"><div class="callout"><strong class="red">LEAVE IMMEDIATE DANGER</strong><ul><li>Fire, smoke or gas hazard</li><li>Serious structural damage</li><li>Tsunami warning / official order</li><li>Other imminent risk</li></ul></div><div class="callout neutral"><strong class="green">IF SHELTERING IN PLACE</strong><ul><li>Make sure conditions remain safe</li><li>Monitor official instructions</li><li>Keep exits clear</li><li>Be ready to move if advised</li></ul></div></div>
      <div class="card-soft card-pad" style="margin-top:15px"><div class="sublabel">YOUR SAVED SHELTER · SELF-REPORTED</div><h3 style="font-size:18px;margin:10px 0 4px">${safe(data.profile.shelter||'Not saved yet')}</h3><p>${safe(checkedPlace('shelter'))}. ${data.profile.shelter?'Check the latest municipality instructions, accessibility and route again before travelling. The app has not verified availability.':'Add an officially designated shelter from your municipality’s information in Settings.'}</p>${data.profile.shelterSource?`<p><strong>Your source note:</strong> ${safe(data.profile.shelterSource)}</p>`:''}${action('go','Review shelter','btn-outline btn-sm','data-page="settings"')}</div>
      <div class="link-list" style="margin-top:17px">${link('https://www.jma.go.jp/bosai/','JMA official alerts')}${link('https://www.bousai.go.jp/','Japan disaster information')}</div></section>`;
    return '';
  }
  function departure() {
    const things=[
      ['wallet','Wallet','Cash and cards','wallet'],['pass','Transit pass','Card or mobile IC','document'],
      ['phone','Phone','Battery and charger','phone'],['keys','Keys','Home and work keys','home']
    ];
    const missing=things.filter(([id])=>!data.departure[id]);
    const date=new Date(),day=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',weekday:'long',day:'numeric',month:'long'}).format(date);
    const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
    return `<section class="p1b-departure">${pageHeader('DEPARTURE · 手荷物確認','A last check before leaving.','This is a manual in-app lock-screen-style preview, not an operating-system notification. No geofence, Bluetooth tag or automatic departure detection is active.')}
      <div class="p1b-departure-layout"><div class="p1b-lock-screen" role="group" aria-label="Manual departure reminder preview"><div class="p1b-lock-time"><span>${safe(day)}</span><strong>${safe(clock)}</strong><small>JAPAN STANDARD TIME · IN-APP PREVIEW</small></div>
        <div class="p1b-notification"><div class="p1b-notification-top"><span class="p1b-notification-icon">${icon('eye','sm')}</span><span>DISASTER MANAGEMENT</span><span class="p1b-notification-manual">MANUAL</span></div><h2>Leaving? Quick check.</h2><p>Tap what you physically have with you. Unchecked means <strong>not confirmed</strong>, not necessarily missing.</p>
          <div class="p1b-departure-items">${things.map(([id,title,note,ic])=>`<button type="button" class="p1b-departure-item ${data.departure[id]?'confirmed':''}" data-action="departure-toggle" data-id="${id}" aria-pressed="${!!data.departure[id]}"><span class="p1b-departure-icon">${icon(ic)}</span><strong>${title}</strong><small>${data.departure[id]?'With me ✓':'Not checked'}</small><span class="p1b-departure-hint">${safe(note)}</span></button>`).join('')}</div>
          <div class="p1b-departure-actions">${action('departure-all','All with me · Save','btn-primary btn-lg')}${action('departure-missing',"Something’s missing →",'btn-outline btn-lg')}</div><div class="p1b-notification-bottom"><span>${missing.length} not confirmed</span>${action('go','Not relevant · Dismiss','btn-quiet btn-sm','data-page="watch"')}</div>
        </div><p class="p1b-lock-disclaimer">A phone lock screen cannot be triggered by this app. Open this page yourself before leaving.</p></div>
        <aside class="p1b-departure-side"><span class="p1b-subtitle">HOW IT WORKS</span><h3>Two deliberate choices.</h3><p><strong>All with me</strong> records your confirmation and returns to Watch. <strong>Something’s missing</strong> opens practical alternatives, one at a time.</p><div class="p1b-side-note">${icon('info')}<span>Items selected above remain saved until you finish or reset this check. No tag, station, or location has been detected.</span></div>${action('departure-reset','Clear this check','btn-outline btn-lg')}<div class="p1b-side-next"><span>NEXT IF YOU NEED HELP</span><strong>Stranded options</strong><p>Manual suggestions. No claimed route, distance, price or guaranteed service.</p></div></aside>
      </div></section>`;
  }
  function stranded() {
    const idx=data.strandedStep,p=STRANDED[idx];
    return `<section class="p1b-stranded">${pageHeader('STRANDED · 対処','No pass or cash? Take one next step.','You choose each step. These are general manual options; there is no location, tag, timetable or Akatsuki connection.')}
      <div class="p1b-stranded-card"><div class="p1b-stranded-top"><span class="p1b-number">${idx+1}</span><span>NEXT ACTION · ${idx+1} OF ${STRANDED.length}</span></div><div class="p1b-stranded-bars" role="group" aria-label="Alternative option navigation">${STRANDED.map((_,n)=>`<button type="button" class="${n===idx?'current':''}" data-action="stranded-select" data-index="${n}" aria-label="View option ${n+1}" ${n===idx?'aria-current="step"':''}></button>`).join('')}</div>
        <h2>${safe(p.title)}</h2><p class="p1b-stranded-instruction">${safe(p.description)}</p><div class="p1b-stranded-facts"><div><span>Distance</span><strong>Unknown</strong></div><div><span>Walk</span><strong>Not calculated</strong></div><div><span>Cost</span><strong>Unverified</strong></div></div><div class="p1b-stranded-check">${icon('info')}<span>${safe(p.when)}. Check conditions before acting.</span></div>
        <div class="p1b-stranded-actions">${action('stranded-resolved','It worked · Save outcome','btn-success btn-lg')}${action('stranded-next',idx===STRANDED.length-1?'Review from start':'Won’t work · Next →','btn-outline btn-lg')}</div></div>
      <section class="p1b-stranded-rest"><span class="p1b-subtitle">IF THAT FAILS · OTHER OPTIONS</span><div class="p1b-stranded-list">${STRANDED.map((x,k)=>`<button type="button" class="p1b-stranded-option ${k===idx?'selected':''}" data-action="stranded-select" data-index="${k}" aria-label="Select option ${k+1}: ${safe(x.title)}"><span>${String(k+1).padStart(2,'0')}</span><strong>${safe(x.title)}</strong><small>${safe(x.when)}</small>${icon('chevron','sm')}</button>`).join('')}</div><p>Order is a general starting point, not a verified ranking by distance or price. If unsafe, stop and seek appropriate help. No action is logged as successful until you confirm it.</p></section></section>`;
  }
  function nightPhase1C() {
    const n=data.night;
    const smallNote='<p class="p1c-disclaimer">Manual tools only · No calendar, railway timetable, last-train calculation, phone alerts or drinking sensor is connected. For emergencies, call 119 yourself.</p>';
    const head=(phase,title,desc)=>pageHeader('NIGHT OUT · '+phase,title,desc);
    const stat=(label,value,detail='')=>`<div class="p1c-night-stat"><span>${safe(label)}</span><strong>${safe(value)}</strong>${detail?`<small>${safe(detail)}</small>`:''}</div>`;
    if(n.phase==='idle') {
      const saved=data.logs.filter(e=>e.kind==='night').length;
      return `<section class="p1c-night">${head('READY','Nothing planned tonight.','Start a manual plan before a night out, including alcohol-free evenings.')}
        <div class="p1c-night-hero"><span class="p1c-overline">YOUR CHOICE · BEFORE THE NIGHT</span><h2>Make tomorrow easier.</h2><p>Set a personal limit, a budget, a leave time and a way home. Nothing starts automatically.</p>${action('night-pre','Start a night out now '+icon('arrow','sm'),'btn-primary btn-lg')}</div>
        <section class="p1c-note-panel"><div class="p1c-overline">YOUR RECORD</div><h3>${saved?saved+' saved night'+(saved===1?'':'s'):'No night history yet'}</h3><p>${saved?'Only nights you recorded in this browser are counted.':'The sample three-night history and personalized patterns in the original design were illustrations.'}</p>${action('go','View your activity log','btn-outline','data-page="log"')}</section>${smallNote}</section>`;
    }
    if(n.phase==='pre') {
      return `<section class="p1c-night">${head('BEFORE','Decide before the first drink.','The values below are your own choices, not calendar predictions or advice about a safe alcohol quantity.')}
        <div class="p1c-night-main"><span class="p1c-overline">MY PLAN · EDITABLE</span><div class="p1c-limit-row"><label for="night-limit">Drinks limit <small>0 = alcohol-free</small></label><div class="p1c-limit-picker"><button type="button" data-action="night-limit-adjust" data-delta="-1" aria-label="Decrease drink limit">−</button><input id="night-limit" type="number" min="0" max="30" step="1" value="${n.limit}" aria-label="Drink limit"/><button type="button" data-action="night-limit-adjust" data-delta="1" aria-label="Increase drink limit">+</button></div></div>
          <div class="p1c-limit-row"><label for="night-budget">Spending cap <small>Japanese yen</small></label><div class="p1c-money-input"><span>¥</span><input id="night-budget" type="number" min="0" max="1000000" step="100" value="${n.budget}"/></div></div>
          <div class="p1c-limit-row"><label for="night-leave">Leave by <small>Chosen time · Japan</small></label><input id="night-leave" class="p1c-time-input" type="time" value="${safe(n.leave)}"/></div>
          <div class="p1c-home-row"><label for="night-mode">How will you get home?</label><select id="night-mode"><option value="train" ${n.mode==='train'?'selected':''}>Train · verify service yourself</option><option value="taxi" ${n.mode==='taxi'?'selected':''}>Taxi · check availability</option><option value="walk" ${n.mode==='walk'?'selected':''}>Walk · assess route safety</option><option value="other" ${n.mode==='other'?'selected':''}>Other</option></select></div>
          <div class="p1c-honesty">${icon('info')} Last train, walking time and travel buffer are unknown. The leave-by time is self-entered; this app cannot notify you when it arrives.</div><div class="p1c-night-actions">${action('night-start','Save my limits & start','btn-primary btn-lg')}${action('night-idle','Not tonight','btn-outline')}</div></div>${smallNote}</section>`;
    }
    if(n.phase==='drunk') {
      const signs=[['Cannot be woken','呼びかけに反応しない'],['Vomiting while very drowsy','意識がもうろうとして嘔吐'],['Slow or irregular breathing','呼吸が遅い・不規則'],['Cold, pale or bluish skin','体が冷たい・唇が青い']];
      return `<section class="p1c-night p1c-urgent">${head('EMERGENCY','Someone may need urgent help.','For suspected alcohol poisoning or serious symptoms, call emergency services without waiting.')}
        <div class="p1c-urgent-top"><span>URGENT · 急性アルコール中毒の疑い</span><h2>Any of these signs? Call 119.</h2><p>This is a prompt to seek professional help, not a diagnostic test.</p></div>
        <div class="p1c-red-flags">${signs.map(([en,jp])=>`<div><strong>${en}</strong><span lang="ja">${jp}</span></div>`).join('')}</div>
        <a class="p1c-urgent-dial" href="tel:119"><strong>${icon('phone','lg')} Call 119 · 救急車</strong><small>Opens the phone dialer; it does not call automatically</small></a>
        <div class="p1c-honesty">${icon('info')} Stay with the person. If unconscious but breathing normally, place them on their side while awaiting help; follow dispatcher instructions. If not breathing normally, follow emergency CPR guidance. Do not give more alcohol.</div>
        <div class="p1c-night-actions">${action('night-live','← Back to your night','btn-outline')}</div></section>`;
    }
    if(n.phase==='after') {
      return `<section class="p1c-night">${head('AFTER','Close the loop.','Record what happened; this does not claim you reached home or that a train was available.')}
        <div class="p1c-night-metrics">${stat('Drinks recorded',`${n.drinks} / ${n.limit}`)}${stat('Spent recorded',yen(n.spent))}${stat('Budget selected',yen(n.budget))}</div>
        <section class="p1c-night-main"><span class="p1c-overline">AFTER · YOUR OWN NOTES</span><h2>One useful lesson.</h2><label class="p1c-form-label" for="night-note">What worked? What would you change?</label><textarea id="night-note" rows="4" placeholder="A sentence is enough…">${safe(n.note)}</textarea>
          <div class="p1c-night-actions">${action('night-log','Save this night to Activity Log','btn-primary btn-lg')}${action('night-live','Back to counters','btn-outline')}</div></section>
        <section class="p1c-note-panel"><span class="p1c-overline">AFTER-ACTION</span><h3>Reflect when you're ready.</h3><p>After saving you can choose a decision point and write a rule. Saved rules are notes, not automatic reminders.</p></section>${smallNote}</section>`;
    }
    const overDrink=n.drinks>=n.limit,overBudget=n.spent>=n.budget;
    const status=n.limit===0?(n.drinks?'Alcohol-free plan was exceeded':'Alcohol-free plan'):overDrink?'Your drink limit is reached':overBudget?'Your spending cap is reached':'Review the plan you made';
    const timer=nightLayout==='timer';
    return `<section class="p1c-night">${head('IN PROGRESS','Stay with your plan.','Counters change only when you record something. Your leave time is not a real train timetable.')}
      <div class="p1c-layout-selector" role="group" aria-label="Night Out display layout">${[['counters','Counters'],['timer','Leave timer']].map(([v,label])=>`<button type="button" data-action="night-layout" data-layout="${v}" aria-pressed="${nightLayout===v}" class="${nightLayout===v?'active':''}">${label}</button>`).join('')}</div>
      ${timer?`<div class="p1c-timer-panel"><span class="p1c-overline">TIME TO YOUR MANUAL LEAVE TARGET</span><strong data-p1c-countdown>${safe(manualCountdown(n.leaveAt))}</strong><p>Leave by <b>${safe(n.leave)} JST</b> · ${n.leaveAt?'time chosen when the plan began':'older saved plan has no target date'}</p><div class="p1c-timer-sub">${safe(n.drinks)} / ${safe(n.limit)} drinks · ${yen(n.spent)} spent</div></div>`:
        `<div class="p1c-night-metrics">${stat('Drinks',`${n.drinks} / ${n.limit}`)}${stat('Spent',yen(n.spent))}${stat('Leave by',n.leave+' JST','Self-entered, not last train')}</div>`}
      <section class="p1c-night-main"><span class="p1c-overline">${overDrink||overBudget?'LIMIT REACHED · MANUAL COUNT':'YOUR CHOICE · LIVE'}</span><h2>${safe(status)}</h2><p>Check whether you still want to continue. Your selected way home is <b>${safe(n.mode)}</b>. Transport and personal safety conditions must be checked separately.</p>
        <div class="p1c-night-actions">${action('night-after','I’m heading home · Review','btn-primary btn-lg')}${action('night-drunk','Someone needs help','btn-danger btn-lg')}</div>
        <div class="p1c-record-row"><div><label for="drink-cost">Cost of next drink (¥)</label><input id="drink-cost" type="number" min="0" max="100000" step="50" value="650"/></div>${action('night-plus','+1 drink · Record','btn-outline btn-lg')}${action('night-undo','Undo last','btn-quiet btn-lg')}</div>
        <p class="p1c-undo-note">Add only a drink you actually had. Undo removes its recorded cost. A limit is a personal reminder, not a safety guarantee.</p></section>${smallNote}</section>`;
  }
  function logPhase1C() {
    const types={manual:'Personal note',departure:'Departure',stranded:'Stranded',incident:'Incident guide',night:'Night Out',reflection:'After-action',legacy:'Older record'};
    const statuses={recorded:'Recorded manually',confirmed:'User confirmed',resolved:'User confirmed',reviewed:'Guide reviewed only',saved:'Saved · inactive',unknown:'Status not recorded'};
    return `<section class="p1c-log">${pageHeader('ACTIVITY LOG · 記録','A record you control.','Only records saved in your browser appear below. They are not externally verified or sent to other services.')}
      <div class="p1c-log-columns"><section class="p1c-log-card"><div class="p1c-log-title"><div><span class="p1c-overline">ACTIVITY · ALL SAVED ENTRIES</span><h2>Timeline</h2></div><span class="p1c-count">${data.logs.length} entries</span></div>
      ${data.logs.length?`<ol class="p1c-timeline">${data.logs.map(e=>`<li><span class="p1c-event-dot" aria-hidden="true"></span><time>${safe(e.date)}</time><div><span class="p1c-event-type">${safe(types[e.kind]||types.legacy)}</span><h3>${safe(e.title)}</h3><p>${safe(e.note)}</p><span class="p1c-status ${e.status==='unknown'?'unknown':''}">${safe(statuses[e.status]||statuses.unknown)}</span></div></li>`).join('')}</ol>`:`<div class="p1c-empty"><h3>No recorded events yet.</h3><p>Complete a manual departure check, review the incident guide, or add your own observation. No sample history is inserted.</p></div>`}</section>
      <section class="p1c-log-card p1c-new-entry"><span class="p1c-overline">ADD AN OBSERVATION</span><h2>A small note is enough.</h2><p>Record something real: a drill, a check, or an idea for next time.</p>
        <div class="text-field"><label for="log-title">Title</label><input id="log-title" maxlength="100" placeholder="e.g. Checked emergency supplies"/></div><div class="text-field"><label for="log-note">What happened?</label><textarea id="log-note" rows="4" maxlength="700" placeholder="A few lines…"></textarea></div>
        <div class="p1c-night-actions">${action('log-create','Save observation','btn-primary')}${action('go','Write an after-action rule','btn-outline','data-page="reflection"')}</div></section></div>
      <div class="p1c-log-rules"><div class="p1c-log-title"><div><span class="p1c-overline">RULES · PERSONAL NOTES</span><h2>Rules you've written</h2></div><span class="p1c-count">${data.rules.length} saved</span></div>
        ${data.rules.length?`<div class="p1c-rules-grid">${data.rules.map(r=>`<article class="p1c-rule"><h3>${safe(r.title)}</h3><p><strong>When to remember:</strong> ${safe(r.trigger||'Not specified')}</p><span class="p1c-status unknown">Saved locally · Does not trigger reminders</span><small>${safe(r.date)}</small></article>`).join('')}</div>`:`<div class="p1c-empty">No saved rules. A rule is a manual note until an actual trigger system is implemented.</div>`}
        ${action('go','Create a rule','btn-outline','data-page="reflection"')}</div>
      <p class="p1c-disclaimer">An imported older record may lack a status. “Status not recorded” is intentional; a text title alone is not proof of completion. The 30-day filter from the original prototype is deferred until reliable event timestamps exist.</p></section>`;
  }
  function reflectionPhase1C() {
    return `<section class="p1c-reflection">${pageHeader('AFTER-ACTION · 振り返り','One decision, one useful rule.','Use these three short steps. Suggestions are examples you can edit; none is assumed to be your personal history.')}
      <div class="p1c-reflection-sheet"><div class="p1c-reflection-step"><div class="p1c-step-num">01</div><div><span class="p1c-overline">WHAT HAPPENED</span><h2>Describe it briefly.</h2><label class="p1c-form-label" for="reflection-event">Your observation</label><textarea id="reflection-event" rows="3" maxlength="700" placeholder="What did you notice?"></textarea></div></div>
        <div class="p1c-reflection-step"><div class="p1c-step-num">02</div><div><span class="p1c-overline">LAST DECISION POINT</span><h2>Where could you have chosen differently?</h2><p>Tap a generic example or type your own. This is not an automated diagnosis.</p><div class="p1c-decision-ideas" role="group" aria-label="Example decision points">${REFLECTION_IDEAS.map((i,index)=>`<button type="button" data-action="reflection-choice" data-index="${index}" aria-pressed="false"><span class="p1c-select-dot" aria-hidden="true"></span><span>${safe(i.point)}</span></button>`).join('')}</div><label class="p1c-form-label" for="reflection-point">Editable decision point</label><input id="reflection-point" maxlength="250" placeholder="Or describe your own decision…"/></div></div>
        <div class="p1c-reflection-step"><div class="p1c-step-num">03</div><div><span class="p1c-overline">ONE NEW RULE</span><h2>What will you do next time?</h2><label class="p1c-form-label" for="reflection-rule">Editable rule</label><input id="reflection-rule" maxlength="250" placeholder="One specific, doable action"/><label class="p1c-form-label" for="reflection-trigger">When should you remember it?</label><input id="reflection-trigger" maxlength="250" placeholder="e.g. Before heading to the station"/>
          <div class="p1c-honesty">${icon('info')} This creates an inactive personal rule in your log. No reminder or trigger is scheduled, and the app cannot guarantee it will fire.</div></div></div>
        <div class="p1c-reflection-actions">${action('save-reflection','Save rule and observation','btn-primary btn-lg')}${action('go','Back to Activity Log','btn-outline','data-page="log"')}</div></div></section>`;
  }
  function settingsPlacesPhase2A(group) {
    const placeInput=(key,id,label,placeholder)=>{
      const checked=!!data.profile.placeChecks?.[key]?.checkedAt;
      const instruction=key==='shelter'
        ? 'I checked this shelter against a current municipality source'
        : 'I checked this information myself';
      return `<div class="p2a-place-field"><div class="text-field"><label for="${id}">${label}</label><input id="${id}" maxlength="240" value="${safe(data.profile[key])}" placeholder="${placeholder}"/></div>
        <label class="p2a-check"><input type="checkbox" id="place-verify-${key}" ${checked?'checked':''}/><span>${instruction}<small data-place-status="${key}">${safe(checkedPlace(key))}</small></span></label></div>`;
    };
    const roles=selected=>CONTACT_ROLES.map(role=>`<option value="${role}" ${selected===role?'selected':''}>${safe(contactRole(role))}</option>`).join('');
    const editing=Number.isInteger(contactEditIndex)?data.contacts[contactEditIndex]:null;
    const missing=[];
    if(!data.contacts.some(c=>c.role==='primary'))missing.push('Choose a primary contact.');
    if(!data.contacts.some(c=>c.role==='backup'))missing.push('Choose a backup contact, preferably outside your immediate area.');
    const personCards=data.contacts.map((c,k)=>`<div class="p1c-setting-contact p2a-contact-card">
      <div class="p2a-contact-details"><strong>${safe(c.name)}</strong><small>Priority ${k+1} · ${safe(c.phone)} · ${safe(contactRole(c.role))}</small>
        <label>Role <select data-contact-role="${k}" aria-label="Role for ${safe(c.name)}">${roles(c.role)}</select></label></div>
      <div class="p2a-contact-controls">
        ${action('contact-up','↑','btn-outline btn-sm',`data-index="${k}" aria-label="Move ${safe(c.name)} higher" ${k===0?'disabled':''}`)}
        ${action('contact-down','↓','btn-outline btn-sm',`data-index="${k}" aria-label="Move ${safe(c.name)} lower" ${k===data.contacts.length-1?'disabled':''}`)}
        ${action('contact-edit','Edit','btn-outline btn-sm',`data-index="${k}"`)}
        ${action('remove-contact','Remove','btn-quiet btn-sm',`data-index="${k}"`)}
      </div></div>`).join('');
    return group('details','05 · IMPORTANT DETAILS','Addresses and contacts',`<p>Only store details you are comfortable keeping in unencrypted browser storage. Labels show what <strong>you</strong> checked, not a verified system feed or a safe evacuation route.</p>
      <div class="p1c-settings-two p2a-settings-two">
        <div class="p1c-settings-form p2a-place-form"><h3>Places · self-reported</h3>
          ${placeInput('home','home-address','Home address · 自宅住所','Ward / city, chōme, banchi…')}
          ${placeInput('office','office-address','Office / regular departure point','Optional')}
          ${placeInput('safePlace','safe-place','Preferred check-in location','Optional meeting place')}
          ${placeInput('station','preferred-station','Preferred station · 最寄り駅','e.g. Minami-Urawa')}
          ${placeInput('shelter','shelter-name','Municipal designated shelter · 指定避難所','Use your local municipality’s official list')}
          <div class="text-field"><label for="shelter-source">Municipality source you checked</label><input id="shelter-source" maxlength="240" value="${safe(data.profile.shelterSource)}" placeholder="Municipality URL or notice title"/><small>Required before marking the shelter as checked. This source is user-entered, not automatically validated.</small></div>
          <div class="p2a-helper">${icon('info')} If you change a saved value or the shelter source, review its checkbox again. A checked shelter may still close or become inaccessible in a disaster.</div>
          ${action('save-profile','Save these places','btn-primary')}
        </div>
        <div class="p1c-settings-form p2a-contacts-form"><h3>Emergency contacts · in priority order</h3>
          <p>Contacts are kept locally. A drafted SMS is never sent automatically; check the destination and message each time.</p>
          <div class="p2a-helper" role="status">${data.contacts.length?missing.join(' ')||'Primary and backup roles assigned.':'No contacts saved. Add a trusted person, then assign primary and backup roles.'}</div>
          ${editing?`<p class="p2a-editing">Editing ${safe(editing.name)} · Priority ${contactEditIndex+1}</p>`:''}
          <div class="text-field"><label for="contact-name">Contact name</label><input id="contact-name" maxlength="70" value="${safe(editing?.name||'')}" placeholder="e.g. Brother"/></div>
          <div class="text-field"><label for="contact-phone">Phone number</label><input id="contact-phone" maxlength="26" value="${safe(editing?.phone||'')}" placeholder="+81 90 1234 5678" inputmode="tel"/><small>Japanese local or international +country-code format, 6–15 digits. You must check that it is correct.</small></div>
          <div class="text-field"><label for="contact-role">Role</label><select id="contact-role">${roles(editing?.role||'unspecified')}</select></div>
          <div class="p2a-contact-controls">${action(editing?'save-contact':'add-contact',editing?'Save contact changes':'Add contact','btn-primary')}${editing?action('contact-cancel','Cancel edit','btn-outline'):''}</div>
          <div class="p1c-contact-list" aria-label="Saved emergency contacts">${data.contacts.length?personCards:'<p>No contacts saved.</p>'}</div>
          <p class="p2a-disclaimer">Up/down controls set the order used by the emergency message screen. Existing records without assigned roles stay <strong>unassigned</strong> until you edit them.</p>
        </div>
      </div>`);
  }
  function settingsPhase1C() {
    const group=(id,kicker,title,content)=>`<section class="p1c-setting-group" id="p1c-${id}"><span class="p1c-overline">${kicker}</span><h2>${title}</h2>${content}</section>`;
    const status=(label,detail,value)=>`<div class="p1c-setting-row"><div><strong>${safe(label)}</strong><small>${safe(detail)}</small></div><span>${safe(value)}</span></div>`;
    const sources=group('sources','01 · DATA SOURCES','Connections and service status',`<p>None of these remote services is currently connected to this app.</p>${status('JMA / weather / earthquakes','No current official feed or timestamps','Not connected')}${status('Train lines and timetables','No live delays, last-train lookup or confidence model','Not connected')}${status('Akatsuki / calendar','No sharing or automatic reminders','Not connected')}${status('Bluetooth / geofences','No paired tags or background position','Not connected')}${status('Local manual tools','Readiness, incident, log and Night Out','Available offline*')}`);
    const privacy=group('privacy','02 · PRIVACY','Your records stay on this device',`<p>Addresses, contacts and Night Out logs are kept in browser local storage <strong>without encryption</strong>. This app has no account and does not automatically transmit them.</p>${status('Exact location sharing','The app does not request or track location','Disabled')}${status('Akatsuki consent','No integration to authorize or revoke yet','Not configured')}${status('Contact and calendar sharing','No access or background synchronization','Disabled')}<div class="p1c-honesty">${icon('info')} Avoid saving sensitive identity-document photos or secrets, especially on shared devices. Browser storage can be lost when site data is cleared.</div>`);
    const thresholds=group('thresholds','03 · THRESHOLDS','Limits and alerts',`<p>Only manual Night Out limits are active. Weather and earthquake thresholds cannot fire without verified sources.</p>${status('Night Out drinks limit',nLimitLabel(),'Manual counter')}${status('Commute alert confidence','Requires a real prediction model','Unavailable')}${status('Quake intensity threshold','Requires a verified JMA feed','Unavailable')}${action('go','Edit Night Out plan','btn-outline','data-page="night"')}`);
    const offline=group('offline','04 · OFFLINE','Offline readiness',`<p>The guide, manual records and installed app files can work offline after the service worker finishes caching. No shelter-map tiles, identity documents or live feeds are included.</p>${status('App shell',offlineReady?'Service worker ready; verify by going offline':'Cache not confirmed in this session',offlineReady?'Worker ready':'Checking')}${status('Seven-step response guide','Included directly in the application','Included')}${status('Shelter maps / documents','No data downloaded; separate future phase','Not available')}<div class="p1c-honesty">${icon('info')} *Offline availability also depends on browser storage retention. Test an offline launch before relying on it.</div>`);
    const places=settingsPlacesPhase2A(group);
    const dataGroup=group('data','06 · DATA MANAGEMENT','Backup and recovery',`<p>Export contains your personal checklist, contacts and logs. Import replaces this app’s saved record <strong>only after confirmation</strong>.</p><div class="p1c-night-actions">${action('export',icon('download','sm')+' Export JSON backup','btn-outline')}<label class="btn btn-outline" for="import-json" style="cursor:pointer">Import backup</label><input id="import-json" type="file" accept="application/json,.json" style="display:none"/></div><div class="p1c-night-actions">${action('go','Review setup tour','btn-outline','data-page="onboard"')}${action('erase',icon('trash','sm')+' Erase this app’s records','btn-danger')}</div><p>Erasure is irreversible without a backup. No other app’s saved data or cache is intentionally deleted.</p>`);
    function nLimitLabel(){return data.night.limit===0?'Alcohol-free (0)':String(data.night.limit)+' drinks';}
    return `<section class="p1c-settings">${pageHeader('SETTINGS · 設定','Clarity and control.','Review your connected sources, privacy, manual thresholds, offline status, addresses, and backups.')}
      <nav class="p1c-setting-jumps" aria-label="Settings sections">${[['sources','Sources'],['privacy','Privacy'],['thresholds','Limits'],['offline','Offline'],['details','Contacts & places'],['data','Backups']].map(([id,label])=>`<a href="#p1c-${id}">${label}</a>`).join('')}</nav>
      ${sources}${privacy}${thresholds}${offline}${places}${dataGroup}</section>`;
  }
  function onboarding() {
    const index=data.tourStep,t=TOUR[index];
    const stageIcons=['eye','bag','phone','pin','wallet','download','shield'];
    return `<section class="p1a-onboard" aria-label="Setup, step ${index+1} of ${TOUR.length}">
      <div class="p1a-onboard-header"><div class="p1a-kicker">${icon('eye')} <span>YOUR SAFETY COMPANION</span></div><span>${index+1} / ${TOUR.length} · ${safe(t.jp)}</span></div>
      <div class="p1a-onboard-progress" role="progressbar" aria-label="Onboarding progress" aria-valuenow="${index+1}" aria-valuemin="1" aria-valuemax="${TOUR.length}">${TOUR.map((_,i)=>`<span class="${i<=index?'is-filled':''}"></span>`).join('')}</div>
      <div class="p1a-onboard-icon">${icon(stageIcons[index],'lg')}</div>
      <h1>${safe(t.title)}</h1><p class="p1a-onboard-lead">${safe(t.body)}</p>
      <ul class="p1a-onboard-points">${t.points.map(([l,r])=>`<li><span class="p1a-onboard-bullet" aria-hidden="true"></span><strong>${safe(l)}</strong><small>${safe(r)}</small></li>`).join('')}</ul>
      <div class="p1a-onboard-note">${icon('info','sm')} <div><strong>Why this matters</strong><p>${index===6?'You decide what to save or share. No services or device permissions are connected in this version.':'This step explains a manual feature. It does not grant permissions, activate background monitoring or send information.'}</p></div></div>
      <div class="p1a-onboard-controls">${action('tour-next',index===TOUR.length-1?'Finish setup '+icon('check','sm'):'Continue '+icon('arrow','sm'),'btn-primary btn-lg btn-full')}
        <div class="p1a-onboard-secondary">${index?action('tour-prev','← Back','btn-quiet'): '<span></span>'}${index===TOUR.length-1?'':action('tour-skip-step','Skip this step','btn-quiet')}${action('tour-skip','Exit tour','btn-quiet')}</div>
      </div>
    </section>`;
  }
  function render() {
    const pages={watch,readiness,incident,departure,stranded,night:nightPhase1C,log:logPhase1C,settings:settingsPhase1C,reflection:reflectionPhase1C,onboard:onboarding};
    const current=pages[data.page]||watch;
    app.innerHTML=shell(current());
    document.title='Disaster Management · '+({watch:'Watch',readiness:'Readiness',incident:'Emergency guide',departure:'Departure check',stranded:'Stranded options',night:'Night Out',log:'Activity log',settings:'Settings',reflection:'After-action',onboard:'Setup'}[data.page]||'Watch');
  }
  function safetyMessage() {
    const location=data.profile.safePlace || data.profile.home || '[your location]';
    return 'I am safe. I am at '+location+'. I will contact you again when possible.';
  }
  function addLog(title,note,kind='manual',status='recorded') {
    data.logs.unshift({date:when(),title,note:note||'',kind,status});
    data.logs=data.logs.slice(0,150);
  }
  function field(id) {return document.getElementById(id);}
  function numericField(id,fallback=0) {const x=Number(field(id)?.value);return Number.isFinite(x)?Math.max(0,x):fallback;}
  function downloadBackup(contents,filename) {
    const blob=new Blob([contents],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
    toast('Backup download started. Keep the file somewhere safe.');
  }
  function dispatch(name,button) {
    const id=button.dataset.id,index=Number(button.dataset.index);
    if(name==='reload-app')return window.location.reload();
    if(name==='defer-update'){
      workerUpdateReady=false;
      document.getElementById('update-notice')?.remove();return;
    }
    if(name==='go') return go(button.dataset.page);
    if(name==='sample') {data.scenario=!data.scenario;return update();}
    if(name==='watch-layout') {
      if(['radar','list','card'].includes(button.dataset.layout))watchLayout=button.dataset.layout;
      return render();
    }
    if(name==='toggle-check'||name==='confirm-inventory') {
      const core=CORE_CHECK_IDS.has(id),custom=data.readiness.custom.find(c=>c.id===id);
      if(!core&&!custom)return;
      const already=core?!!data.checks[id]:!!custom.checked;
      const checked=name==='confirm-inventory'?true:!already;
      if(core)data.checks[id]=checked;else custom.checked=checked;
      if(checked){
        const details=inventoryDetail(id)||normalizeInventoryDetail({});
        details.reviewedAt=jstDay();details.needsReview=false;
        if(core)data.readiness.items[id]=details;
      }
      inventoryOpenId=name==='confirm-inventory'?id:null;
      update();
      if(checked){
        const item=core?CHECKS.find(c=>c.id===id):custom;
        if(!readinessStatus(item).ready)toast('Personal check saved, but this item is not counted ready: '+readinessStatus(item).label+'.');
      }
      return;
    }
    if(name==='focus-inventory'){
      if(!CORE_CHECK_IDS.has(id)&&!data.readiness.custom.some(c=>c.id===id))return;
      const details=app.querySelector('#details-'+id);
      if(details){details.open=true;details.scrollIntoView?.({behavior:'smooth',block:'center'});details.querySelector('input')?.focus?.();}
      return;
    }
    if(name==='save-inventory-detail'){
      const core=CORE_CHECK_IDS.has(id),custom=data.readiness.custom.find(c=>c.id===id);
      if(!core&&!custom)return;
      const existing=inventoryDetail(id)||normalizeInventoryDetail({});
      const amount=(key)=>{
        const raw=field('inventory-'+key+'-'+id)?.value;
        if(raw===undefined)return {error:'Item form not found.'};
        if(raw.trim()==='')return {value:null};
        const value=Number(raw);
        if(!Number.isFinite(value)||value<0||value>1_000_000_000||!/^\d+(?:\.\d{1,2})?$/.test(raw.trim()))
          return {error:'Enter a non-negative amount (up to two decimal places).'};
        return {value};
      };
      const quantity=amount('quantity'),target=amount('target');
      if(quantity.error||target.error)return toast(quantity.error||target.error);
      const dates={};
      for(const key of ['expiry','reviewDue']){
        const raw=field('inventory-'+key+'-'+id)?.value??'';
        if(raw&&!validInventoryDate(raw))return toast('Enter a valid '+(key==='expiry'?'expiry':'review')+' date.');
        dates[key]=raw;
      }
      const unit=core?(CHECKS.find(c=>c.id===id)?.unit||'items'):field('inventory-unit-'+id)?.value;
      if(!READINESS_UNITS.includes(unit))return toast('Choose a valid quantity unit.');
      const note=(field('inventory-note-'+id)?.value||'').trim().slice(0,240);
      const next={...existing,quantity:quantity.value,target:target.value,unit,...dates,note};
      const keys=['quantity','target','unit','expiry','reviewDue','note'];
      const edited=keys.some(key=>next[key]!==existing[key]);
      const checked=core?!!data.checks[id]:!!custom.checked;
      if(edited&&checked)next.needsReview=true;
      if(core)data.readiness.items[id]=next;else Object.assign(custom,next);
      inventoryOpenId=id;update();
      toast(edited&&checked?'Details saved. Confirm your personal check again to count this item.':'Inventory details saved locally.');
      return;
    }
    if(name==='add-custom-inventory'){
      const title=(field('custom-inventory-title')?.value||'').trim().slice(0,90);
      const note=(field('custom-inventory-note')?.value||'').trim().slice(0,240);
      if(!title)return toast('Enter a name for the extra item.');
      if(data.readiness.custom.length>=30)return toast('Limit of 30 custom items reached.');
      const id='custom-'+data.readiness.nextCustomId++;
      data.readiness.custom.push({id,title,checked:false,...normalizeInventoryDetail({note})});
      inventoryOpenId=id;update();return toast('Extra item saved. It does not change the core score.');
    }
    if(name==='remove-custom-inventory'){
      const pos=data.readiness.custom.findIndex(c=>c.id===id);
      if(pos<0)return;
      if(!confirm('Remove this extra inventory item and its saved details from this browser?'))return;
      data.readiness.custom.splice(pos,1);inventoryOpenId=null;update();return toast('Extra item removed locally.');
    }
    if(name==='save-embassy-status'){
      const status=field('embassy-status')?.value;
      if(!EMBASSY_STATUSES.includes(status))return toast('Choose a registration status.');
      data.readiness.embassy={status,updatedAt:jstDay()};update();
      return toast('Your own embassy-registration status was saved. No embassy was contacted.');
    }
    if(name==='incident-step'){data.incident.active=true;data.incident.step=Number(button.dataset.step)||1;return update();}
    if(name==='incident-next'){data.incident.active=true;data.incident.step=Math.min(7,data.incident.step+1);return update();}
    if(name==='incident-prev'){data.incident.step=Math.max(1,data.incident.step-1);return update();}
    if(name==='incident-toggle'){
      const i=data.incident;const checked=new Set(i.done[i.step]||[]);
      if(checked.has(index))checked.delete(index);else checked.add(index);
      i.done[i.step]=[...checked];
      if(i.outcomes[i.step])delete i.outcomes[i.step][index];
      i.active=true;return update();
    }
    if(name==='incident-mode'){
      data.incident.oneStep=!data.incident.oneStep;
      data.incident.active=true;return update();
    }
    if(name==='incident-item-prev'){
      const i=data.incident;i.cursor[i.step]=Math.max(0,(i.cursor[i.step]||0)-1);
      i.active=true;return update();
    }
    if(name==='incident-item-restart'){
      const i=data.incident;i.cursor[i.step]=0;i.active=true;return update();
    }
    if(name==='incident-item-outcome'){
      const i=data.incident,step=INC[i.step-1],result=button.dataset.result;
      if(!step?.items || !Number.isInteger(index) || index<0 || index>=step.items.length
        || !['done','cant','skip'].includes(result))return;
      const checked=new Set(i.done[i.step]||[]);
      i.outcomes[i.step] ||= {};
      if(result==='done'){checked.add(index);delete i.outcomes[i.step][index];}
      else {checked.delete(index);i.outcomes[i.step][index]=result;}
      i.done[i.step]=[...checked];i.cursor[i.step]=index+1;i.active=true;
      return update();
    }
    if(name==='incident-contact'){const a=new Set(data.incident.contacted||[]);if(a.has(index))a.delete(index);else a.add(index);data.incident.contacted=[...a];return update();}
    if(name==='copy-message') {
      const message=safetyMessage();
      if(navigator.clipboard?.writeText) navigator.clipboard.writeText(message).then(()=>toast('Message copied. Review before sharing.')).catch(()=>toast('Copy not available. Select the message text manually.'));
      else toast('Copy not available in this browser.');
      return;
    }
    if(name==='sms-contact'){
      const c=data.contacts[index];if(!c)return;const phone=phoneForComposer(c.phone);
      if(!phone)return toast('Save a valid phone number first.');
      if(!confirm('Open a new SMS draft to '+c.name+' ('+phone+')? Check your message, number and current safety before deciding whether to send. This app cannot confirm delivery.'))return;
      window.location.href='sms:'+phone+'?body='+encodeURIComponent(safetyMessage());
      return toast('SMS composer requested. Review and send manually if appropriate.');
    }
    if(name==='finish-incident'){
      const incident=data.incident;
      const done=Object.values(incident.done).reduce((n,entries)=>n+entries.length,0);
      const outcomes=Object.values(incident.outcomes).flatMap(entries=>Object.values(entries));
      const cant=outcomes.filter(v=>v==='cant').length,skipped=outcomes.filter(v=>v==='skip').length;
      const note=(field('incident-note')?.value || incident.note || '').trim();
      addLog('Incident guide reviewed',`Manual guide review only; ${done} items marked done, ${cant} can’t do, ${skipped} skipped. Unfinished items are not complete.${note?' Note: '+note:''}`,'incident','reviewed');
      data.incident=defaults().incident;
      go('log');return toast('Guide review saved locally; no emergency action was sent.');
    }
    if(name==='departure-toggle'){data.departure[id]=!data.departure[id];return update();}
    if(name==='departure-reset'){data.departure={wallet:false,pass:false,phone:false,keys:false};return update();}
    if(name==='departure-finish') {
      const missing=Object.keys(data.departure).filter(k=>!data.departure[k]);
      if(missing.length){data.strandedStep=0;go('stranded');return toast('Review the missing items and try a fallback.');}
      addLog('Departure check completed','Wallet, pass, phone and keys confirmed with you.','departure','confirmed');
      data.departure={wallet:false,pass:false,phone:false,keys:false};
      go('watch');return toast('Departure check saved.');
    }
    if(name==='departure-all'){
      addLog('Departure check confirmed','You personally confirmed wallet, transit pass, phone and keys.','departure','confirmed');
      data.departure=defaults().departure;
      go('watch');return toast('Your manual confirmation was saved.');
    }
    if(name==='departure-missing'){
      data.strandedStep=0;go('stranded');
      return toast('Try one alternative at a time. Check availability yourself.');
    }
    if(name==='stranded-select'){data.strandedStep=Math.min(STRANDED.length-1,Math.max(0,index));return update();}
    if(name==='stranded-next'){data.strandedStep=(data.strandedStep+1)%STRANDED.length;return update();}
    if(name==='stranded-resolved'){
      addLog('Stranded issue resolved','User confirmed using: '+STRANDED[data.strandedStep].title,'stranded','resolved');
      data.strandedStep=0;go('log');return toast('Outcome recorded.');
    }
    if(name==='night-pre'){data.night.phase='pre';return update();}
    if(name==='night-idle'){data.night.phase='idle';return update();}
    if(name==='night-limit-adjust'){
      const input=field('night-limit');if(!input)return;
      const current=Number.isFinite(Number(input.value))?Number(input.value):0;
      input.value=String(Math.max(0,Math.min(30,Math.floor(current)+Number(button.dataset.delta||0))));
      return;
    }
    if(name==='night-layout'){
      if(['counters','timer'].includes(button.dataset.layout))nightLayout=button.dataset.layout;
      return render();
    }
    if(name==='night-start'){
      const n=data.night;
      n.limit=Math.min(30,Math.floor(numericField('night-limit',2)));
      n.budget=Math.min(1000000,Math.floor(numericField('night-budget',3000)));
      const leave=field('night-leave')?.value??'23:30',target=nextManualLeaveTime(leave);
      if(!target)return toast('Please choose a valid leave-by time.');
      n.leave=leave;n.leaveAt=target;
      n.mode=['train','taxi','walk','other'].includes(field('night-mode')?.value)?field('night-mode').value:'train';
      n.drinks=0;n.spent=0;n.note='';n.costHistory=[];n.phase='live';update();return toast('Plan saved locally. Stay safe.');
    }
    if(name==='night-plus'){
      if(data.night.drinks>=500)return toast('Local count limit reached. Save this night before adding more.');
      const cost=Math.min(100000,Math.floor(numericField('drink-cost',650)));
      data.night.costHistory=(data.night.costHistory||[]);data.night.costHistory.push(cost);
      data.night.drinks++;data.night.spent+=cost;return update();
    }
    if(name==='night-undo'){const last=(data.night.costHistory||[]).pop();if(last===undefined)return toast('Nothing to undo.');data.night.drinks=Math.max(0,data.night.drinks-1);data.night.spent=Math.max(0,data.night.spent-last);update();return toast('Last drink and its cost were removed.');}
    if(name==='night-after'){data.night.phase='after';return update();}
    if(name==='night-live'){data.night.phase='live';return update();}
    if(name==='night-drunk'){data.night.phase='drunk';return update();}
    if(name==='night-log'){
      data.night.note=(field('night-note')?.value||'').trim().slice(0,500);
      addLog('Night out recorded',data.night.drinks+' drinks, '+yen(data.night.spent)+'. '+(data.night.note||''),'night','recorded');
      const n=data.night;data.night={...defaults().night,limit:n.limit,budget:n.budget,mode:n.mode,leave:n.leave};
      go('log');return toast('Night added to your log.');
    }
    if(name==='log-create'){
      const title=(field('log-title')?.value||'').trim(),note=(field('log-note')?.value||'').trim();
      if(!title)return toast('Please enter an entry title.');
      addLog(title.slice(0,100),note.slice(0,700));update();return toast('Entry saved in this browser.');
    }
    if(name==='reflection-choice'){
      const idea=REFLECTION_IDEAS[index];if(!idea)return;
      const point=field('reflection-point'),rule=field('reflection-rule');
      if(point)point.value=idea.point;
      if(rule&&!rule.value.trim())rule.value=idea.rule;
      for(const choice of app.querySelectorAll?.('[data-action="reflection-choice"]')||[]){
        choice.setAttribute('aria-pressed',choice.dataset.index===String(index)?'true':'false');
      }
      return toast('Editable example selected. Review before saving.');
    }
    if(name==='save-reflection'){
      const title=(field('reflection-rule')?.value||'').trim();
      if(!title)return toast('Write a specific rule first.');
      const event=(field('reflection-event')?.value||'').trim();
      const point=(field('reflection-point')?.value||'').trim();
      const trigger=(field('reflection-trigger')?.value||'').trim();
      data.rules.unshift({title:title.slice(0,250),trigger:trigger.slice(0,250),date:when()});
      addLog('After-action rule created',(event?event+'. ':'')+(point?'Decision point: '+point+'. ':'')+'Rule: '+title,'reflection','saved');
      go('log');return toast('One new rule saved.');
    }
    if(name==='save-profile'){
      const ids={home:'home-address',office:'office-address',safePlace:'safe-place',station:'preferred-station',shelter:'shelter-name'};
      const old=data.profile,next={...old,placeChecks:{}};
      for(const [key,id] of Object.entries(ids))next[key]=(field(id)?.value||'').trim().slice(0,240);
      next.shelterSource=(field('shelter-source')?.value||'').trim().slice(0,240);
      if(field('place-verify-shelter')?.checked && (!next.shelter||!next.shelterSource))
        return toast('Enter the shelter and municipality source before marking it checked.');
      for(const key of PLACE_FIELDS){
        if(!next[key]||!field('place-verify-'+key)?.checked)continue;
        const unchanged=old[key]===next[key]&&(key!=='shelter'||old.shelterSource===next.shelterSource);
        next.placeChecks[key]={checkedAt:unchanged&&old.placeChecks?.[key]?.checkedAt||new Date().toISOString(),
          source:key==='shelter'?'municipality-self':'user-self'};
      }
      data.profile=next;update();return toast('Places and your own check dates saved locally.');
    }
    if(name==='add-contact'||name==='save-contact'){
      const contactName=field('contact-name')?.value.trim(),phone=field('contact-phone')?.value.trim();
      if(!contactName||!phone)return toast('Enter a name and phone number.');
      if(!phoneForComposer(phone))return toast('Check number: use 6–15 digits, optionally starting with +country code.');
      const role=field('contact-role')?.value;
      const next={name:contactName.slice(0,70),phone:phone.slice(0,26),role:CONTACT_ROLES.includes(role)?role:'unspecified'};
      if(name==='save-contact'){
        if(!Number.isInteger(contactEditIndex)||!data.contacts[contactEditIndex])return toast('Choose a contact to edit first.');
        data.contacts[contactEditIndex]=next;
      }else{
        if(data.contacts.length>=100)return toast('Maximum number of local contacts reached.');
        data.contacts.push(next);
      }
      contactEditIndex=null;update();return toast('Contact saved locally. Verify the number before using it.');
    }
    if(name==='contact-edit'){
      if(!data.contacts[index])return;
      contactEditIndex=index;render();field('contact-name')?.focus?.();return;
    }
    if(name==='contact-cancel'){contactEditIndex=null;return render();}
    if(name==='contact-up'||name==='contact-down'){
      const to=index+(name==='contact-up'?-1:1);
      if(!data.contacts[index]||to<0||to>=data.contacts.length)return;
      [data.contacts[index],data.contacts[to]]=[data.contacts[to],data.contacts[index]];
      data.incident.contacted=data.incident.contacted.map(k=>k===index?to:k===to?index:k);
      if(contactEditIndex===index)contactEditIndex=to;
      else if(contactEditIndex===to)contactEditIndex=index;
      update();return toast('Contact priority order updated.');
    }
    if(name==='remove-contact'){
      const c=data.contacts[index];if(!c)return;
      if(!confirm('Remove '+c.name+' from this device? This also clears its reached mark in the active guide.'))return;
      data.contacts.splice(index,1);
      data.incident.contacted=data.incident.contacted.filter(k=>k!==index).map(k=>k>index?k-1:k);
      if(contactEditIndex===index)contactEditIndex=null;
      else if(contactEditIndex!==null&&contactEditIndex>index)contactEditIndex--;
      update();return toast('Contact removed from this app.');
    }
    if(name==='export-raw' || (name==='export' && recoveryRaw!==null)) {
      if(recoveryRaw===null)return toast('No unreadable records were found.');
      return downloadBackup(recoveryRaw,'disaster-management-original-backup.json');
    }
    if(name==='export')return downloadBackup(JSON.stringify(data,null,2),'disaster-management-backup.json');
    if(name==='erase'){
      const warning=recoveryRaw!==null
        ? 'Erase the saved records that this app cannot currently read? Download the untouched backup first. This cannot be undone without that file.'
        : 'Erase all Disaster Management records on this browser? This cannot be undone without a backup.';
      if(!confirm(warning))return;
      try {localStorage.removeItem(KEY);}catch {return toast('Could not remove the saved records. No data was erased.');}
      recoveryRaw=null;data=defaults();update();return toast('Local app records erased.');
    }
    if(name==='tour-next'){
      if(data.tourStep<TOUR.length-1){data.tourStep++;return update();}
      data.tourDone=true;data.tourStep=0;go('watch');return toast('Setup tour complete. Welcome.');
    }
    if(name==='tour-prev'){data.tourStep=Math.max(0,data.tourStep-1);return update();}
    if(name==='tour-skip-step'){data.tourStep=Math.min(TOUR.length-1,data.tourStep+1);return update();}
    if(name==='tour-skip'){data.tourDone=true;data.tourStep=0;return go('watch');}
  }
  document.addEventListener('click', event=>{
    const button=event.target.closest('[data-action]');
    if(!button||!app.contains(button))return;
    event.preventDefault();dispatch(button.dataset.action,button);
  });
  document.addEventListener('input',event=>{
    const key=({'home-address':'home','office-address':'office','safe-place':'safePlace',
      'preferred-station':'station','shelter-name':'shelter','shelter-source':'shelter'})[event.target.id];
    if(!key)return;
    const box=field('place-verify-'+key);
    if(box)box.checked=false; // Edits must never retain a stale accuracy claim.
    const status=app.querySelector('[data-place-status="'+key+'"]');
    if(status)status.textContent='Edited · check again before saving';
  });
  document.addEventListener('change',async event=>{
    if(event.target.matches?.('[data-contact-role]')){
      const index=Number(event.target.dataset.contactRole),role=event.target.value;
      if(data.contacts[index]&&CONTACT_ROLES.includes(role)){
        data.contacts[index].role=role;update();toast('Contact role saved locally.');
      }
      return;
    }
    if(event.target.id==='import-json'||event.target.id==='import-recovery-json'){
      const file=event.target.files?.[0];if(!file)return;
      try {
        if(file.size>1_000_000)throw new Error('Backup must be smaller than 1 MB.');
        const raw=JSON.parse(await file.text());
        const compatible=migrateRecord(raw);
        if(!compatible)throw new Error('Unsupported backup version or format. The existing records remain untouched.');
        if(!confirm('Replace all existing records in this browser with this backup?')){render();return;}
        const restored=normalize(compatible);restored.page='settings';
        try {localStorage.setItem(KEY,JSON.stringify(restored));}
        catch {throw new Error('Browser storage rejected the backup; original records were not replaced.');}
        data=restored;recoveryRaw=null;render();toast('Backup imported into this browser.');
      } catch(err){toast('Could not import: '+err.message);} finally {event.target.value='';}
      return;
    }
    if(event.target.id==='incident-note'){data.incident.note=event.target.value.slice(0,700);save();}
  });
  window.addEventListener('online',()=>{netOnline=true;render();});
  window.addEventListener('offline',()=>{netOnline=false;render();});
  if(typeof window.setInterval==='function')window.setInterval(()=>{
    const current=app.querySelector('[data-p1c-countdown]');
    if(current)current.textContent=manualCountdown(data.night.leaveAt);
  },1000);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  render();
  // Browsers also treat loopback HTTP as a secure context for local smoke tests.
  if('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))){
    let hasBeenControlled=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      const replacing=hasBeenControlled;
      hasBeenControlled=!!navigator.serviceWorker.controller;
      offlineReady=true;
      if(replacing)showUpdateNotice();
    });
    navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'})
      .then(()=>navigator.serviceWorker.ready)
      .then(()=>{offlineReady=true;})
      .catch(()=>{offlineReady=false;});
  }
})();
