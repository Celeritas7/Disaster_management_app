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
    {id:'water', group:'Survival essentials', title:'Drinking water', note:'Store an appropriate emergency supply and check the expiry dates.', pts:12},
    {id:'food', group:'Survival essentials', title:'Shelf-stable food', note:'Food you can eat even if power and cooking are unavailable.', pts:10},
    {id:'light', group:'Survival essentials', title:'Torch, radio and batteries', note:'A light and a way to receive official information.', pts:10},
    {id:'power', group:'Survival essentials', title:'Phone power bank charged', note:'Keep the charging cable with your emergency bag.', pts:8},
    {id:'bag', group:'Evacuation kit', title:'Go-bag packed near the door', note:'Shoes, warm layer, hygiene items and essential supplies.', pts:12},
    {id:'documents', group:'Evacuation kit', title:'Important documents accessible', note:'Know where to find passport, residence card, insurance and copies.', pts:10},
    {id:'cash', group:'Evacuation kit', title:'Emergency cash available', note:'Small notes and coins for card or network outages.', pts:8},
    {id:'contacts', group:'Family & location', title:'Emergency contact list ready', note:'Include someone outside your immediate region.', pts:10},
    {id:'shelter', group:'Family & location', title:'Designated shelter verified', note:'Check the official municipality map and walk the route if possible.', pts:10},
    {id:'plan', group:'Family & location', title:'Reunion and check-in plan agreed', note:'Decide where to meet and how to communicate.', pts:10}
  ];
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
  function defaults() {
    return {version:VERSION,page:'watch',tourStep:0,tourDone:false,profile:{home:'',office:'',shelter:'',safePlace:''},
      checks:{},contacts:[],incident:{active:false,step:1,done:{},contacted:[],note:''},
      departure:{wallet:false,pass:false,phone:false,keys:false},strandedStep:0,
      night:{phase:'idle',limit:2,budget:3000,leave:'23:30',mode:'train',drinks:0,spent:0,note:'',costHistory:[]},
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
    for(const k of Object.keys(d.profile)) d.profile[k]=str(obj(raw.profile)[k],240);
    for(const c of CHECKS) d.checks[c.id]=!!obj(raw.checks)[c.id];
    d.contacts=(Array.isArray(raw.contacts)?raw.contacts:[]).filter(c=>c&&typeof c.name==='string'&&typeof c.phone==='string')
      .slice(0,100).map(c=>({name:str(c.name,70),phone:str(c.phone,26)}));
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
    const night=obj(raw.night);
    d.night.phase=['idle','pre','live','after','drunk'].includes(night.phase)?night.phase:'idle';
    d.night.limit=num(night.limit,30,2);d.night.budget=num(night.budget,1000000,3000);
    d.night.leave=/^\d{2}:\d{2}$/.test(str(night.leave,5))?night.leave:'23:30';
    d.night.mode=['train','taxi','walk','other'].includes(night.mode)?night.mode:'train';
    d.night.drinks=num(night.drinks,500);d.night.spent=num(night.spent,10000000);
    d.night.note=str(night.note,500);
    d.night.costHistory=(Array.isArray(night.costHistory)?night.costHistory:[])
      .filter(x=>Number.isInteger(x)&&x>=0&&x<=100000).slice(-500);
    d.scenario=!!raw.scenario;
    d.logs=(Array.isArray(raw.logs)?raw.logs:[]).filter(x=>x && typeof x.title==='string').slice(0,150)
      .map(x=>({date:str(x.date,75),title:str(x.title,100),note:str(x.note,700)}));
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
  const app = document.getElementById('app');
  const readyCount = () => CHECKS.reduce((n,c) => n+(data.checks[c.id] ? c.pts : 0),0);
  const doneCount = () => CHECKS.filter(c => data.checks[c.id]).length;
  const when = () => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
  const yen = n => '¥'+Number(n || 0).toLocaleString('en-JP');
  const item = (title, note, right = '') => `<li><span>${safe(title)}<br><small class="muted">${safe(note)}</small></span><span>${right}</span></li>`;
  function save() {
    if(recoveryRaw!==null)return false; // Never overwrite an unreadable backup.
    try { localStorage.setItem(KEY,JSON.stringify(data));return true; }
    catch { toast('Local storage is unavailable; your changes may not persist.');return false; }
  }
  function update() { save(); render(); }
  function go(page) { data.page=page;update();window.scrollTo({top:0,behavior:'instant'}); }
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
    const score=readyCount(),next=CHECKS.find(c=>!data.checks[c.id]);
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
      <section class="p1a-readiness-strip"><div>${scoreRing()}<div><span class="p1a-section-label">YOUR READINESS · USER CHECKED</span><strong>${score===100?'10 items marked verified':`${doneCount()} / ${CHECKS.length} items verified`}</strong><small>${next?'Next to check: '+safe(next.title):'Please review your kit regularly.'}</small></div></div>${action('go','Review readiness '+icon('arrow','sm'),'btn-primary','data-page="readiness"')}</section>
      <div class="section-heading"><h2>Do something useful now</h2><small>Manual tools, available offline</small></div>
      <div class="action-grid">${tile('incident','Emergency guide','7-step earthquake response','alert','red')}${tile('departure','Departure check','Wallet, pass, phone and keys','bag','')}${tile('stranded','Stranded options','Try a practical fallback','pin','amber')}${tile('night','Night Out','Set limits before leaving','moon','green')}</div>
      <div class="info-band blue p1a-official"><span>${icon('info')}</span><div><strong>Watch does not monitor hazards yet.</strong> A quiet animation or an example card does not indicate your surroundings are safe. For current warnings, use official agencies and local evacuation notices.<div class="link-list" style="margin-top:12px">${link('https://www.jma.go.jp/bosai/','JMA 防災')}${link('https://www.bousai.go.jp/','Cabinet Office 防災')}</div></div></div>
      <p class="lastline">${netOnline?'Browser reports an internet connection.':'You are currently offline.'} · ${offlineReady?'App shell cached for offline access.':'The app will cache its files when browser permissions allow.'} · Records stay on this device.</p>
    </section>`;
  }
  function tile(page,title,note,ic,color) {
    return `<button class="action-tile" data-action="go" data-page="${page}"><span class="tile-icon ${color}">${icon(ic)}</span><span class="tile-title">${title}</span><span class="tile-note">${note}</span></button>`;
  }
  function readiness() {
    const remaining=CHECKS.length-doneCount(),gaps=CHECKS.filter(c=>!data.checks[c.id]).slice(0,3);
    const groups=[...new Set(CHECKS.map(c=>c.group))];
    return `<section class="p1a-readiness-page">${pageHeader('READINESS · 備え','Your readiness gaps.','Each point comes from a checklist item you personally marked. A tick is not independent verification.')}
      <div class="p1a-readiness-overview">${scoreRing(150)}<div><h2>${remaining?`${remaining} things to check`:'All 10 items marked'}</h2><p>${remaining?'Start with these three gaps. Review the complete inventory below.':'Your manual checklist is complete; check supplies and expiry dates regularly.'}</p><span class="p1a-quiet-chip">${doneCount()} of ${CHECKS.length} manually verified</span></div></div>
      <div class="p1a-gap-heading"><span class="p1a-section-label">${remaining?'THREE NEXT GAPS':'MAINTENANCE'}</span><small>Only mark an item when you check it</small></div>
      <div class="p1a-gap-grid">${gaps.map(c=>`<article class="p1a-gap-card"><div><strong>${safe(c.title)}</strong><p>${safe(c.note)}</p></div><button class="p1a-gap-action" type="button" data-action="toggle-check" data-id="${c.id}" aria-label="Mark ${safe(c.title)} verified after checking it">Mark verified ${icon('arrow','sm')}</button></article>`).join('')||'<div class="info-band blue">No unchecked items. Revisit your supplies periodically; tap any checked row below to update its status.</div>'}</div>
      <div class="p1a-gap-heading"><span class="p1a-section-label">INVENTORY</span><small>10 checklist items · grouped by purpose</small></div>
      <div class="p1a-inventory-summary">${groups.map(g=>{const entries=CHECKS.filter(c=>c.group===g),count=entries.filter(c=>data.checks[c.id]).length;return `<div><span>${safe(g)}</span><strong>${count} / ${entries.length} checked</strong></div>`;}).join('')}</div>
      ${groups.map(g=>`<section class="subsection"><div class="section-heading"><h2>${safe(g)}</h2><small>Tap to confirm or undo</small></div><div class="checklist-list">${CHECKS.filter(c=>c.group===g).map(c=>`<button class="check-row ${data.checks[c.id]?'is-done':''}" data-action="toggle-check" data-id="${c.id}" aria-pressed="${!!data.checks[c.id]}"><span class="check-control">${icon('check','sm')}</span><span class="check-copy"><strong>${safe(c.title)}</strong><p>${safe(c.note)}</p></span><span class="check-weight">${c.pts} pts</span></button>`).join('')}</div></section>`).join('')}
      <div class="section-heading"><h2>Personal details</h2></div><div class="info-band blue">${icon('pin')}<div>Save your shelter and emergency contacts from Settings. These are user-entered, not independently verified. ${action('go','Open settings','btn-quiet btn-sm','data-page="settings"')}</div></div>
      </section>`;
  }
  function incident() {
    const i=data.incident,step=INC[i.step-1],total=INC.length;
    return `<div class="incident-page">${pageHeader('EARTHQUAKE · 地震','Act one step at a time.','This offline guide supports decisions; it cannot determine whether a building or evacuation route is safe.')}
      <div class="info-band amber" style="margin-bottom:18px">${icon('alert')}<div><strong>Real emergency?</strong> Protect your head during shaking. For ambulance/fire dial <a href="tel:119">119</a>; for police dial <a href="tel:110">110</a>. Follow official emergency instructions.</div></div>
      <div class="incident-hero"><div class="eyebrow">STEP ${i.step} OF ${total} · ${i.active?'IN PROGRESS':'GUIDE READY'}</div><div class="stepper" aria-label="Incident steps">${INC.map(x=>`<button class="step-segment ${x.n<i.step?'past':''} ${x.n===i.step?'current':''}" data-action="incident-step" data-step="${x.n}" aria-label="Go to step ${x.n}" ${x.n===i.step?'aria-current="step"':''}></button>`).join('')}</div><h2>${safe(step.title)}</h2><p class="jp-sub">${safe(step.jp)}</p><p style="font-size:13px;color:#c0a4aa;margin-top:10px;line-height:1.5">${safe(step.desc)}</p></div>
      ${incidentBody(step)}
      <div class="incident-controls">${action('incident-prev',icon('chevron','sm')+' Previous','btn-outline',i.step===1?'disabled':'')}${action('go','Leave guide','btn-outline','data-page="watch"')}${action(i.step===7?'finish-incident':'incident-next',i.step===7?'Finish & save a log': 'Continue to step '+(i.step+1)+' '+icon('arrow','sm'),'btn-primary')}</div>
      <p class="lastline">Progress is saved locally · ${netOnline?'Online':'Offline'} · Official information may change rapidly.</p>
    </div>`;
  }
  function incidentBody(step) {
    const i=data.incident,done=i.done[i.step]||[];
    if(step.n===1) return `<section class="incident-step-card"><h3>Are you hurt? 怪我をしていますか？</h3><p>If you are injured or someone is in immediate danger, call emergency services. On a phone these buttons open the dialer.</p><div class="emergency-contact-grid"><a class="emergency-call" href="tel:119"><div><strong>119 · Ambulance / Fire</strong><span>救急・消防 · Tap to call</span></div>${icon('phone','lg')}</a><a class="emergency-call secondary" href="tel:110"><div><strong>110 · Police</strong><span>警察 · Tap to call</span></div>${icon('phone','lg')}</a></div><div class="info-band blue" style="margin-top:18px">${icon('message')}<div><strong>Japanese phone script</strong><br>救急です。住所は${safe(data.profile.home||'［住所］')}です。<br><small>“I need an ambulance. My address is …”</small></div></div></section>`;
    if(step.items) return `<section class="incident-step-card"><h3>Your checklist</h3><p>Do only what is safe. Tap to mark each item; you may continue even if something cannot be done.</p>${step.items.map(([t,j],k)=>`<button class="list-check ${done.includes(k)?'checked':''}" data-action="incident-toggle" data-index="${k}" aria-pressed="${done.includes(k)}"><span class="square">${done.includes(k)?icon('check','sm'):''}</span><span><strong>${safe(t)}</strong><small>${safe(j)}</small></span></button>`).join('')}
        ${step.n===2?`<div class="info-band amber" style="margin-top:17px">${icon('alert')}<div>If shaking starts again, drop, cover your head, and hold on. Avoid operating gas equipment if you suspect a leak.</div></div>`:''}
        ${step.n===6?`<div class="link-list" style="margin-top:18px">${link('https://www.jma.go.jp/bosai/','JMA official updates')}${link('https://www.nhk.or.jp/kishou-saigai/','NHK disaster info')}</div>`:''}
        ${step.n===7?`<div class="text-field" style="margin-top:20px"><label for="incident-note">What happened / what to improve</label><textarea id="incident-note" data-save-field="incident.note" placeholder="For your private incident log…">${safe(i.note)}</textarea></div>`:''}
      </section>`;
    if(step.n===3) return `<section class="incident-step-card"><h3>Draft a safety message</h3><p>Check the details before sending. Copying or opening SMS does not mean a message was delivered.</p>
      <div class="card-soft card-pad"><div class="sublabel">MESSAGE · ENGLISH / 日本語</div><p style="color:#e8efff;font-size:15px">${safe(safetyMessage())}</p><p style="color:#b3bfd6;font-size:14px">無事です。今は${safe(data.profile.safePlace||'［現在地］')}にいます。また連絡します。</p>${action('copy-message',icon('copy','sm')+' Copy message','btn-primary')}</div>
      <div class="section-heading"><h2>Emergency contacts</h2><small>${data.contacts.length} saved</small></div>
      ${data.contacts.length?data.contacts.map((c,k)=>`<div class="contact-row"><div><div class="contact-name">${safe(c.name)}</div><div class="contact-meta">${safe(c.phone)}</div></div><div class="form-actions" style="margin:0">${action('sms-contact','Compose SMS','btn-outline btn-sm',`data-index="${k}"`)}${action('incident-contact',i.contacted.includes(k)?'Reached ✓':'Mark reached',i.contacted.includes(k)?'btn-success btn-sm':'btn-outline btn-sm',`data-index="${k}"`)}</div></div>`).join(''):`<div class="info-band amber">${icon('info')}<div>No contacts saved yet. Add them from Settings. ${action('go','Add contacts','btn-quiet btn-sm','data-page="settings"')}</div></div>`}
      <div class="info-band blue" style="margin-top:18px">${icon('phone')}<div><strong>Disaster Message Dial 171 · 災害用伝言ダイヤル</strong><br>Call <a href="tel:171">171</a> and follow voice prompts. Press 1 to record or 2 to listen, then follow the requested phone-number steps. <a href="https://www.ntt-east.co.jp/en/saigai/voice171s/rec.html" target="_blank" rel="noopener noreferrer">NTT instructions</a>.</div></div></section>`;
    if(step.n===4) return `<section class="incident-step-card"><h3>Use current, verified warnings.</h3><p>This app has no live quake, tsunami, shelter availability or route feed. Never rely on a demonstration map for evacuation.</p>
      <div class="callout-steps"><div class="callout"><strong class="red">LEAVE IMMEDIATE DANGER</strong><ul><li>Fire, smoke or gas hazard</li><li>Serious structural damage</li><li>Tsunami warning / official order</li><li>Other imminent risk</li></ul></div><div class="callout neutral"><strong class="green">IF SHELTERING IN PLACE</strong><ul><li>Make sure conditions remain safe</li><li>Monitor official instructions</li><li>Keep exits clear</li><li>Be ready to move if advised</li></ul></div></div>
      <div class="card-soft card-pad" style="margin-top:15px"><div class="sublabel">YOUR VERIFIED SHELTER</div><h3 style="font-size:18px;margin:10px 0 4px">${safe(data.profile.shelter||'Not saved yet')}</h3><p>${data.profile.shelter?'This is only a name you entered. Confirm accessibility, route and official instructions.':'Set an officially designated shelter in Settings before an emergency.'}</p>${action('go','Edit shelter','btn-outline btn-sm','data-page="settings"')}</div>
      <div class="link-list" style="margin-top:17px">${link('https://www.jma.go.jp/bosai/','JMA official alerts')}${link('https://www.bousai.go.jp/','Japan disaster information')}</div></section>`;
    return '';
  }
  function departure() {
    const things=[
      ['wallet','Wallet','Cash and cards','wallet'],['pass','Transit pass','Card or mobile IC','document'],
      ['phone','Phone','Battery and charger','phone'],['keys','Keys','Home and work keys','home']
    ];
    const missing=things.filter(([id])=>!data.departure[id]);
    return pageHeader('DEPARTURE CHECK','Before you walk away.','A two-second check from the prototype. In this version you start it manually; no geofence or Bluetooth tag is connected.')+
      `<div class="details-grid"><section class="card card-pad"><div class="card-label">TAKE A MOMENT</div><h2 class="card-title">Everything with you?</h2><p class="card-descr">Tap each item to confirm it is physically with you, then finish the check.</p>
      <div class="checklist-list" style="margin-top:22px">${things.map(([id,title,note,ic])=>`<button class="check-row ${data.departure[id]?'is-done':''}" data-action="departure-toggle" data-id="${id}" aria-pressed="${!!data.departure[id]}"><span class="tile-icon" style="background:transparent">${icon(ic)}</span><span class="check-copy"><strong>${title}</strong><p>${note}</p></span><span class="check-control">${data.departure[id]?icon('check','sm'):''}</span></button>`).join('')}</div>
      <div class="form-actions">${action('departure-finish',missing.length?'Finish check · '+missing.length+' missing':'All with me · Done',missing.length?'btn-outline btn-full btn-lg':'btn-success btn-full btn-lg')}${action('departure-reset','Reset checks','btn-quiet btn-sm')}</div></section>
      <section class="card card-pad"><div class="card-label">IF SOMETHING IS MISSING</div><h2 class="card-title">A calm fallback plan.</h2><p class="card-descr">When you're stranded, work through options from simplest to most involved. No costs or distances are assumed.</p>
      <ol class="return-list">${STRANDED.slice(0,3).map((p,k)=>`<li><span class="number">${k+1}</span><div><h3>${safe(p.title)}</h3><p>${safe(p.description)}</p></div></li>`).join('')}</ol>
      ${action('go','Open stranded options '+icon('arrow','sm'),'btn-outline btn-full','data-page="stranded"')}
      <p class="block-note">Future Akatsuki integration could suggest nearby verified options based on location. It is not active in this build.</p></section></div>`;
  }
  function stranded() {
    const idx=data.strandedStep,p=STRANDED[idx];
    return pageHeader('FALLBACK PLAN','Stuck without a wallet or pass?','Try one practical option at a time. These are general ideas, not verified nearby locations or guaranteed services.')+
      `<div class="details-grid"><section class="card card-pad"><div class="eyebrow">OPTION ${idx+1} OF ${STRANDED.length}</div><div class="stepper">${STRANDED.map((_,i)=>`<button class="step-segment ${i<idx?'past':''} ${i===idx?'current':''}" data-action="stranded-select" data-index="${i}" aria-label="Option ${i+1}"></button>`).join('')}</div>
      <h2 class="page-title" style="font-size:31px">${safe(p.title)}</h2><p class="page-lead">${safe(p.description)}</p>
      <div class="info-band blue" style="margin-top:24px">${icon('info')}<span>${safe(p.when)}</span></div>
      <div class="form-actions">${action('stranded-resolved','Resolved · log it','btn-success btn-lg')}${action('stranded-next',idx===STRANDED.length-1?'Start again':'Won’t work · next','btn-outline btn-lg')}</div></section>
      <section class="card card-pad"><div class="card-label">FALLBACKS</div><h3 class="card-title">All available approaches</h3><ol class="return-list">${STRANDED.map((x,k)=>`<li><span class="number" style="background:${k===idx?'#596ce2':'#26395b'}">${k+1}</span><div style="flex:1"><h3>${safe(x.title)}</h3><p>${safe(x.when)}</p></div><button class="btn btn-outline btn-sm" data-action="stranded-select" data-index="${k}">View</button></li>`).join('')}</ol></section></div>`;
  }
  function night() {
    const n=data.night;
    if(n.phase==='idle') return pageHeader('PERSONAL SAFETY','Set limits before the first drink.','A practical safety flow from your prototype. You start it manually; no calendar connection or drinking detection exists yet.')+
      `<div class="details-grid"><section class="card card-pad" style="background:radial-gradient(ellipse at 90% 0%,rgba(100,100,200,.16),transparent 60%),#141c32"><span class="tile-icon green">${icon('moon')}</span><h2 class="page-title" style="font-size:32px">Make tomorrow easier.</h2><p class="page-lead">Decide how much to spend, when to leave and how to get home before the night starts.</p><div class="form-actions">${action('night-pre','Plan a night out '+icon('arrow','sm'),'btn-primary btn-lg')}</div></section>
      <section class="card card-pad"><div class="card-label">YOUR PLAN WILL TRACK</div><ul class="tiny-list">${item('Drinks','Your personally selected limit','Manual')}${item('Spending','What you enter as you go','Yen')}${item('Leave by','Your chosen departure time','Reminder on screen')}${item('If someone needs help','Emergency steps and 119','Japan')}</ul><p class="block-note">This app cannot send push notifications or automatically prevent drinking.</p></section></div>`;
    if(n.phase==='pre') return pageHeader('NIGHT OUT · BEFORE','Decide now, follow later.','Make a simple personal commitment while your judgement is clear.')+
      `<div class="card card-pad" style="max-width:760px"><div class="card-label">MY PLAN</div>
      <div class="field-grid" style="margin-top:22px"><div class="text-field"><label for="night-limit">Maximum drinks</label><input id="night-limit" type="number" min="0" max="30" value="${Number(n.limit)}" /></div><div class="text-field"><label for="night-budget">Spending limit (¥)</label><input id="night-budget" type="number" min="0" step="100" value="${Number(n.budget)}" /></div>
      <div class="text-field"><label for="night-leave">Leave by</label><input id="night-leave" type="time" value="${safe(n.leave)}" /></div><div class="text-field"><label for="night-mode">Getting home</label><select id="night-mode"><option value="train" ${n.mode==='train'?'selected':''}>Train</option><option value="taxi" ${n.mode==='taxi'?'selected':''}>Taxi</option><option value="walk" ${n.mode==='walk'?'selected':''}>Walk</option><option value="other" ${n.mode==='other'?'selected':''}>Other</option></select></div></div>
      <div class="info-band blue" style="margin-top:20px">${icon('info')}<div>Your departure time is self-entered, not checked against an actual train timetable. Verify the last train separately.</div></div>
      <div class="form-actions">${action('night-start','Lock this plan & start','btn-primary btn-lg')}${action('night-idle','Cancel','btn-quiet')}</div></div>`;
    if(n.phase==='drunk') return pageHeader('SAFETY CHECK','Someone is very intoxicated.','If you suspect alcohol poisoning or someone is unresponsive, seek immediate emergency help.')+
      `<section class="incident-hero"><div class="eyebrow">URGENT · 急性アルコール中毒</div><h2>Call 119 for emergency symptoms.</h2><p class="jp-sub">救急車を呼ぶ · 119</p><div class="callout-steps" style="margin-top:20px"><div class="callout"><strong class="red">RED FLAGS</strong><ul><li>Cannot wake them</li><li>Slow or irregular breathing</li><li>Seizure or severe confusion</li><li>Blue or very pale skin</li></ul></div><div class="callout neutral"><strong>WHILE WAITING FOR HELP</strong><ul><li>Stay with the person</li><li>If breathing, position on their side</li><li>Do not give more alcohol</li><li>Follow dispatcher instructions</li></ul></div></div><div class="form-actions"><a class="btn btn-danger btn-lg" href="tel:119">${icon('phone')} Call 119</a>${action('night-live','Back to night','btn-outline')}</div></section>`;
    if(n.phase==='after') return pageHeader('NIGHT OUT · AFTER','Close the loop.','Record the evening honestly. Your notes are for you alone.')+
      `<div class="details-grid"><section class="card card-pad"><div class="card-label">THE NUMBERS</div><div class="night-stat"><div><span>Drinks</span><strong>${n.drinks} / ${n.limit}</strong></div><div><span>Spent</span><strong>${yen(n.spent)}</strong></div><div><span>Budget</span><strong>${yen(n.budget)}</strong></div></div>
      <div class="text-field"><label for="night-note">What worked / what should change?</label><textarea id="night-note" placeholder="One thing to keep in mind next time…">${safe(n.note)}</textarea></div><div class="form-actions">${action('night-log','Save night to log','btn-primary btn-lg')}${action('night-live','Back to tracking','btn-outline')}</div></section>
      <section class="card card-pad"><div class="card-label">AFTER-ACTION</div><h2 class="card-title">One useful lesson beats ten regrets.</h2><p class="card-descr">After logging, you can create one specific rule and see it in your personal activity log.</p></section></div>`;
    const atLimit=n.drinks>=n.limit,overBudget=n.spent>=n.budget;
    return pageHeader('NIGHT OUT · IN PROGRESS','Stay with the plan you chose.','These counters update only when you tap them; there is no automatic monitoring.')+
      `<div class="details-grid"><section class="card card-pad"><div class="card-label">CURRENT NIGHT</div><div class="night-stat"><div><span>Drinks</span><strong class="${atLimit?'amber':''}">${n.drinks} / ${n.limit}</strong></div><div><span>Spent</span><strong class="${overBudget?'amber':''}">${yen(n.spent)}</strong></div><div><span>Leave by</span><strong>${safe(n.leave)}</strong></div></div>
      <div class="night-status ${atLimit||overBudget?'limit':''}"><div class="card-label">${atLimit||overBudget?'LIMIT REACHED':'ON TRACK'}</div><h2>${atLimit?'Your last sober decision matters.':overBudget?'You reached your budget.':'You’re following your plan.'}</h2><p>${atLimit?'You decided to stop at '+n.limit+' drinks before going out.':overBudget?'You set a spending limit of '+yen(n.budget)+'.':'Decide whether to continue, stop here, or head home.'}</p></div>
      <div class="section-heading"><h2>Log as you go</h2></div>
      <div class="field-grid"><div class="text-field"><label for="drink-cost">Cost of next drink (¥)</label><input id="drink-cost" type="number" min="0" step="50" value="650"/></div><div class="text-field"><label>Spend manually</label><div style="display:flex;gap:8px">${action('night-plus','+1 drink','btn-outline btn-full')}${action('night-undo','Undo','btn-outline')}</div></div></div>
      <div class="form-actions">${action('night-after','I’m heading home','btn-primary btn-lg')}${action('night-drunk','Someone needs help','btn-danger')}</div></section>
      <section class="card card-pad"><div class="card-label">REMEMBER</div><h2 class="card-title">You made a decision for a reason.</h2><ul class="list-plain"><li>${icon('check')}<span>Your spending cap: <strong>${yen(n.budget)}</strong></span></li><li>${icon('check')}<span>Your drink limit: <strong>${n.limit}</strong></span></li><li>${icon('check')}<span>Getting home: <strong>${safe(n.mode)}</strong> · leave <strong>${safe(n.leave)}</strong></span></li></ul><div class="info-band amber" style="margin-top:23px">${icon('alert')}<div>Never let a heavily intoxicated person go home alone. Call 119 for severe symptoms, and follow emergency dispatcher instructions.</div></div></section></div>`;
  }
  function logPage() {
    return pageHeader('YOUR MEMORY','A record that helps you learn.','Only actions you actually record appear here. The sample events from the original design are not presented as real history.')+
      `<div class="details-grid"><section class="card card-pad"><div class="card-head"><div><div class="card-label">TIMELINE</div><h2 class="card-title">Activity log</h2></div><span class="pill">${data.logs.length} entries</span></div>
      ${data.logs.length?`<div class="timeline" style="margin-top:14px">${data.logs.map(e=>`<div class="timeline-item"><time>${safe(e.date)}</time><div class="timeline-body"><h3>${safe(e.title)}</h3><p>${safe(e.note)}</p></div></div>`).join('')}</div>`:`<div class="empty-state" style="margin-top:18px">${icon('log','lg')}<h3>Your log starts with you.</h3><p>Complete a departure check, run the incident guide, or finish a night out to create your first entry.</p></div>`}
      </section><section class="card card-pad"><div class="card-label">NEW ENTRY</div><h2 class="card-title">Record an observation</h2><p class="card-descr">A brief note about a drill, small incident, or improvement idea.</p>
      <div class="text-field" style="margin-top:18px"><label for="log-title">Title</label><input id="log-title" placeholder="e.g. Emergency bag review"/></div>
      <div class="text-field" style="margin-top:12px"><label for="log-note">What happened?</label><textarea id="log-note" placeholder="Two or three lines are enough…"></textarea></div>
      <div class="form-actions">${action('log-create','Add entry','btn-primary')}${action('go','Create a safety rule','btn-outline','data-page="reflection"')}</div></section></div>
      <div class="section-heading"><h2>Rules you chose to keep</h2><small>${data.rules.length} learned</small></div>
      ${data.rules.length?`<div class="details-grid">${data.rules.map(r=>`<div class="rule-card"><strong>${safe(r.title)}</strong><p>Trigger: ${safe(r.trigger || 'Review occasionally')}</p><p>Saved ${safe(r.date)}</p></div>`).join('')}</div>`:`<div class="info-band blue">${icon('info')}<span>No rules saved yet. After something goes wrong or a drill reveals a weakness, record one concrete rule that would help next time.</span></div>`}`;
  }
  function reflection() {
    return pageHeader('AFTER ACTION','Turn an experience into a rule.','The prototype’s learning loop: identify the last decision point, then write a specific action you can take next time.')+
      `<div class="card card-pad" style="max-width:800px"><div class="card-label">1 · WHAT HAPPENED</div><div class="text-field" style="margin-top:10px"><label for="reflection-event">A short description</label><textarea id="reflection-event" placeholder="What did you notice?"></textarea></div>
      <div class="sublabel" style="margin-top:24px">2 · LAST DECISION POINT</div><p class="card-descr">What was the last moment you could have changed the outcome?</p><div class="text-field"><label for="reflection-point">The decision point</label><input id="reflection-point" placeholder="e.g. Leaving home without checking the forecast"/></div>
      <div class="sublabel" style="margin-top:24px">3 · ONE NEW RULE</div><div class="text-field" style="margin-top:9px"><label for="reflection-rule">The rule</label><input id="reflection-rule" placeholder="e.g. Check official advisories before early trips"/></div>
      <div class="text-field" style="margin-top:12px"><label for="reflection-trigger">When should you think about it?</label><input id="reflection-trigger" placeholder="e.g. Night before a train trip"/></div>
      <div class="form-actions">${action('save-reflection','Save rule & entry','btn-primary btn-lg')}${action('go','Cancel','btn-outline','data-page="log"')}</div>
      <p class="block-note">These are personal reminders in the log, not automated notifications.</p></div>`;
  }
  function settings() {
    return pageHeader('PREFERENCES & PRIVACY','Make the guide yours.','Save the details that matter in an emergency. Your data stays in browser storage on this device, not encrypted or synced.')+
      `<div class="details-grid"><section class="card card-pad"><div class="card-label">YOUR IMPORTANT PLACES</div><h2 class="card-title">Addresses & shelter</h2><p class="card-descr">The home address can appear in the Japanese emergency phone script. Add only information you are comfortable keeping on this device.</p>
      <div class="text-field" style="margin-top:18px"><label for="home-address">Home address · 自宅住所</label><input id="home-address" value="${safe(data.profile.home)}" placeholder="Ward / city, chōme, banchi…"/></div>
      <div class="text-field" style="margin-top:12px"><label for="office-address">Office / regular departure point</label><input id="office-address" value="${safe(data.profile.office)}" placeholder="Optional"/></div>
      <div class="text-field" style="margin-top:12px"><label for="shelter-name">Designated shelter · 指定避難所</label><input id="shelter-name" value="${safe(data.profile.shelter)}" placeholder="Verify using municipal information"/></div>
      <div class="text-field" style="margin-top:12px"><label for="safe-place">Preferred check-in location</label><input id="safe-place" value="${safe(data.profile.safePlace)}" placeholder="Home, evacuation center, etc."/></div>
      <div class="form-actions">${action('save-profile','Save these places','btn-primary')}</div></section>
      <section class="card card-pad"><div class="card-label">PRIVATE CONTACTS</div><h2 class="card-title">People you would call</h2><p class="card-descr">This web app cannot access your phone contacts. Enter numbers manually; SMS actions only open a draft.</p>
      <div class="contact-form" style="margin-top:19px"><div class="text-field"><label for="contact-name">Name</label><input id="contact-name" placeholder="e.g. Brother"/></div><div class="text-field"><label for="contact-phone">Phone number</label><input id="contact-phone" placeholder="+81 …" inputmode="tel"/></div>${action('add-contact','Add','btn-primary')}</div>
      <div class="subsection">${data.contacts.length?data.contacts.map((c,k)=>`<div class="contact-row"><div><div class="contact-name">${safe(c.name)}</div><div class="contact-meta">${safe(c.phone)}</div></div>${action('remove-contact',icon('trash','sm')+' Remove','btn-quiet btn-sm',`data-index="${k}"`)}</div>`).join(''):'<p class="block-note">No contacts added.</p>'}</div></section>
      <section class="card card-pad"><div class="card-label">SOURCE STATUS</div><h2 class="card-title">Connections</h2><ul class="tiny-list">${item('Weather & JMA earthquake feed','Live data not connected','Inactive')}${item('Akatsuki','No synchronization configured','Inactive')}${item('Calendar / geofences / Bluetooth','Manual-only in this version','Inactive')}${item('Local readiness and guide','Your entries stay in this browser','Available')}${item('Offline app shell','Loads after first successful cache',offlineReady?'Cached':'Preparing')}</ul>
      <div class="info-band blue" style="margin-top:17px">${icon('shield')}<span>Browser storage is not a secure vault. Avoid storing identity-document images or confidential information here, especially on shared devices.</span></div></section>
      <section class="card card-pad"><div class="card-label">YOUR DATA</div><h2 class="card-title">Back up or start fresh</h2><p class="card-descr">Export your checklist, contacts and logs as a local JSON file. Importing replaces this app’s records in the current browser.</p>
      <div class="form-actions">${action('export',icon('download','sm')+' Export data','btn-outline')}<label class="btn btn-outline" for="import-json" style="cursor:pointer">Import backup</label><input id="import-json" type="file" accept="application/json,.json" style="display:none" /></div>
      <div class="separator"></div><div class="form-actions">${action('go','Take setup tour','btn-outline','data-page="onboard"')}${action('erase',icon('trash','sm')+' Erase all local data','btn-danger')}</div><p class="block-note">Erase removes only this app’s browser records. Downloaded backups remain wherever you saved them.</p></section></div>`;
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
    const pages={watch,readiness,incident,departure,stranded,night,log:logPage,settings,reflection,onboard:onboarding};
    const current=pages[data.page]||watch;
    app.innerHTML=shell(current());
    document.title='Disaster Management · '+({watch:'Watch',readiness:'Readiness',incident:'Emergency guide',departure:'Departure check',stranded:'Stranded options',night:'Night Out',log:'Activity log',settings:'Settings',reflection:'After-action',onboard:'Setup'}[data.page]||'Watch');
  }
  function safetyMessage() {
    const location=data.profile.safePlace || data.profile.home || '[your location]';
    return 'I am safe. I am at '+location+'. I will contact you again when possible.';
  }
  function addLog(title,note) {
    data.logs.unshift({date:when(),title,note:note||''});
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
    if(name==='toggle-check') {data.checks[id]=!data.checks[id];return update();}
    if(name==='incident-step'){data.incident.active=true;data.incident.step=Number(button.dataset.step)||1;return update();}
    if(name==='incident-next'){data.incident.active=true;data.incident.step=Math.min(7,data.incident.step+1);return update();}
    if(name==='incident-prev'){data.incident.step=Math.max(1,data.incident.step-1);return update();}
    if(name==='incident-toggle'){
      const i=data.incident;const checked=new Set(i.done[i.step]||[]);
      if(checked.has(index))checked.delete(index);else checked.add(index);
      i.done[i.step]=[...checked];i.active=true;return update();
    }
    if(name==='incident-contact'){const a=new Set(data.incident.contacted||[]);if(a.has(index))a.delete(index);else a.add(index);data.incident.contacted=[...a];return update();}
    if(name==='copy-message') {
      const message=safetyMessage();
      if(navigator.clipboard?.writeText) navigator.clipboard.writeText(message).then(()=>toast('Message copied. Review before sharing.')).catch(()=>toast('Copy not available. Select the message text manually.'));
      else toast('Copy not available in this browser.');
      return;
    }
    if(name==='sms-contact'){
      const c=data.contacts[index];if(!c)return;const phone=c.phone.replace(/[^+\d]/g,'');
      if(!phone)return toast('Save a valid phone number first.');
      window.location.href='sms:'+phone+'?body='+encodeURIComponent(safetyMessage());
      return toast('SMS composer opened if supported. You must send it yourself.');
    }
    if(name==='finish-incident'){
      const note=field('incident-note')?.value || data.incident.note || 'Finished the seven-step safety guide.';
      addLog('Incident guide completed',note);
      data.incident={active:false,step:1,done:{},contacted:[],note:''};
      go('log');return toast('Incident guide recorded locally.');
    }
    if(name==='departure-toggle'){data.departure[id]=!data.departure[id];return update();}
    if(name==='departure-reset'){data.departure={wallet:false,pass:false,phone:false,keys:false};return update();}
    if(name==='departure-finish') {
      const missing=Object.keys(data.departure).filter(k=>!data.departure[k]);
      if(missing.length){data.strandedStep=0;go('stranded');return toast('Review the missing items and try a fallback.');}
      addLog('Departure check completed','Wallet, pass, phone and keys confirmed with you.');
      data.departure={wallet:false,pass:false,phone:false,keys:false};
      go('watch');return toast('Departure check saved.');
    }
    if(name==='stranded-select'){data.strandedStep=Math.min(STRANDED.length-1,Math.max(0,index));return update();}
    if(name==='stranded-next'){data.strandedStep=(data.strandedStep+1)%STRANDED.length;return update();}
    if(name==='stranded-resolved'){
      addLog('Stranded issue resolved','Resolved using: '+STRANDED[data.strandedStep].title);
      data.strandedStep=0;go('log');return toast('Outcome recorded.');
    }
    if(name==='night-pre'){data.night.phase='pre';return update();}
    if(name==='night-idle'){data.night.phase='idle';return update();}
    if(name==='night-start'){
      const n=data.night;
      n.limit=Math.min(30,Math.floor(numericField('night-limit',2)));
      n.budget=Math.min(1000000,Math.floor(numericField('night-budget',3000)));
      n.leave=field('night-leave')?.value || '23:30';n.mode=field('night-mode')?.value || 'train';
      n.drinks=0;n.spent=0;n.note='';n.costHistory=[];n.phase='live';update();return toast('Plan saved locally. Stay safe.');
    }
    if(name==='night-plus'){const cost=Math.min(100000,Math.floor(numericField('drink-cost',650)));data.night.costHistory=(data.night.costHistory||[]);data.night.costHistory.push(cost);data.night.drinks++;data.night.spent+=cost;return update();}
    if(name==='night-undo'){const last=(data.night.costHistory||[]).pop();if(last===undefined)return toast('Nothing to undo.');data.night.drinks=Math.max(0,data.night.drinks-1);data.night.spent=Math.max(0,data.night.spent-last);update();return toast('Last drink and its cost were removed.');}
    if(name==='night-after'){data.night.phase='after';return update();}
    if(name==='night-live'){data.night.phase='live';return update();}
    if(name==='night-drunk'){data.night.phase='drunk';return update();}
    if(name==='night-log'){
      data.night.note=(field('night-note')?.value||'').trim().slice(0,500);
      addLog('Night out recorded',data.night.drinks+' drinks, '+yen(data.night.spent)+'. '+(data.night.note||''));
      const n=data.night;data.night={...defaults().night,limit:n.limit,budget:n.budget,mode:n.mode,leave:n.leave};
      go('log');return toast('Night added to your log.');
    }
    if(name==='log-create'){
      const title=(field('log-title')?.value||'').trim(),note=(field('log-note')?.value||'').trim();
      if(!title)return toast('Please enter an entry title.');
      addLog(title.slice(0,100),note.slice(0,700));update();return toast('Entry saved in this browser.');
    }
    if(name==='save-reflection'){
      const title=(field('reflection-rule')?.value||'').trim();
      if(!title)return toast('Write a specific rule first.');
      const event=(field('reflection-event')?.value||'').trim();
      const point=(field('reflection-point')?.value||'').trim();
      const trigger=(field('reflection-trigger')?.value||'').trim();
      data.rules.unshift({title:title.slice(0,250),trigger:trigger.slice(0,250),date:when()});
      addLog('After-action rule created',(event?event+'. ':'')+(point?'Decision point: '+point+'. ':'')+'Rule: '+title);
      go('log');return toast('One new rule saved.');
    }
    if(name==='save-profile'){
      data.profile={home:field('home-address')?.value.trim().slice(0,240)||'',office:field('office-address')?.value.trim().slice(0,240)||'',shelter:field('shelter-name')?.value.trim().slice(0,240)||'',safePlace:field('safe-place')?.value.trim().slice(0,240)||''};
      update();return toast('Places saved only in this browser.');
    }
    if(name==='add-contact'){
      const contactName=field('contact-name')?.value.trim(),phone=field('contact-phone')?.value.trim();
      if(!contactName||!phone)return toast('Enter a name and phone number.');
      if(!/^[+\d()\s-]{5,26}$/.test(phone))return toast('Check the phone number format.');
      data.contacts.push({name:contactName.slice(0,70),phone:phone.slice(0,26)});
      update();return toast('Contact saved locally.');
    }
    if(name==='remove-contact'){if(data.contacts[index]){data.contacts.splice(index,1);update();toast('Contact removed.');}return;}
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
  document.addEventListener('change',async event=>{
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
