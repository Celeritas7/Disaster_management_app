(() => {
  'use strict';

  // No network or account is required. Entries remain in this browser's storage.
  const KEY = 'disaster-management:v1';
  // A single local pre-import snapshot, never a background/cloud backup.
  // It is intentionally a separate app-owned key and is erased with KEY.
  const PREIMPORT_KEY = 'disaster-management:preimport:v1';
  const VERSION = 1;
  const ENCRYPTED_BACKUP_FORMAT = 'disaster-management-encrypted';
  const ENCRYPTED_BACKUP_VERSION = 1;
  const BACKUP_KDF_ITERATIONS = 600000;
  const MAX_BACKUP_FILE_BYTES = 2_000_000;
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
  // Offline, static safety copy reviewed against FDMA/JMA/NTT primary sources
  // on 2026-11-15. The app cannot verify a current hazard or service status.
  const INCIDENT_GUIDANCE_REVIEW = '2026-11-15';
  const INCIDENT_HELP = {
    1: {title:'If you need urgent help · 緊急時',points:[
      ['If someone needs an ambulance or there is a fire, call 119. Use 110 for an urgent police matter.','救急・火災は119、緊急の事件・事故は110。'],
      ['If a phone cannot connect to 119, try a public phone or ask a nearby person or shop to call. Do not use emergency numbers merely to test them.','119につながらない場合は、公衆電話や周囲の人に通報を依頼。']
    ]},
    2: {title:'If a hazard prevents the check · 危険がある場合',points:[
      ['Protect yourself while shaking. Check appliances only once the shaking stops and only if safe.','揺れている間は身を守り、揺れが収まってから安全を確認。'],
      ['If you smell gas, avoid flames and electrical switches, including ventilation fans. Leave the area safely and contact the gas company from outside.','ガス臭がしたら火気・電気スイッチを使わず、安全な場所へ。'],
      ['For fire or thick smoke, move away from danger. Keep low to avoid smoke and call 119.','火災・煙がある場合は煙を避けて避難し、119へ。']
    ]},
    3: {title:'If you cannot contact anyone · 連絡できない場合',points:[
      ['Save your progress and try later. A copied message or opened SMS composer is NOT a delivered message.','送信画面を開いただけでは送信完了ではありません。'],
      ['Disaster Message Dial 171 operates when NTT activates it, including announced practice periods. Check availability when online; follow the voice prompts if active.','171は提供中のみ利用できます。利用状況と音声案内を確認。']
    ]},
    4: {title:'If you cannot verify an evacuation route · 避難判断に迷ったら',points:[
      ['Move away from fire, heavy smoke, gas leaks or serious building damage. Follow current local authorities; do not wait for this app to update.','火災・ガス漏れ・建物損傷などの危険から離れ、自治体の指示に従う。'],
      ['Near the coast, strong or long shaking may signal tsunami danger. Go promptly to higher, safer ground without waiting for an alert. Tsunami status here is UNKNOWN.','海岸付近で強い揺れや長い揺れを感じたら、警報を待たず高い安全な場所へ。']
    ]},
    5: {title:'If supplies are not accessible · 持ち出せない場合',points:[
      ['Do not return to an unsafe building or delay a necessary evacuation to collect supplies. Mark items you cannot take and continue.','危険な建物に戻らず、持ち出せない物は「できない」を選ぶ。']
    ]},
    6: {title:'If the network or battery is limited · 通信できない場合',points:[
      ['Try battery-powered radio, public announcements or nearby official notices when safe. Web links require a connection.','ラジオや自治体の放送など、安全に利用できる情報源を確認。'],
      ['Reduce screen brightness in your device settings and conserve power. This web app cannot switch on battery saver or measure battery reliably.','端末の設定で画面を暗くし、電池を節約してください。']
    ]},
    7: {title:'If recording evidence is unsafe · 記録できない場合',points:[
      ['Only photograph or write notes when it is safe; never re-enter a dangerous area for evidence. An image is not an official assessment.','安全が最優先。危険な場所に戻って写真を撮らないでください。']
    ]}
  };
  const ITEM_FALLBACKS = {
    2:['If the floor is unsafe, do not cross broken glass. Find a safer route if possible.',
      'If there is smoke or gas, leave safely. Do not touch switches or gas equipment.',
      'Use another safe way out if the usual exit is blocked. Do not force a dangerous route.',
      'Use stairs only if they are safe; do not enter a damaged stairwell.'],
    5:['Do not enter an unsafe area for the bag.','Take water only if it is safe to reach.','Conserve remaining power if the charger is inaccessible.','Only help others when doing so does not put you in danger.'],
    6:['If web access fails, try an offline radio or local official announcement.','Do not assume silence means an evacuation order is absent.','Radio may help when mobile data is unavailable.'],
    7:['Do not photograph in danger; write a note later.','Contact them when a safe means is available.','Try later if the network is down.','Add the improvement later; urgent safety takes priority.']
  };
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
  // Editable, local-only SMS composition. "Safe" and "need help" are never
  // inferred from an incident, readiness score, saved address or GPS.
  const SMS_TEMPLATES = [
    {id:'checkin',label:'Request a check-in · 安否を確認',en:'Please let me know if you are safe when you can. I will update you when possible.',ja:'落ち着いたら、無事かどうか教えてください。こちらからも可能なときに連絡します。'},
    {id:'safe',label:'I am safe right now · 今は無事',en:'I am safe right now. I will contact you again when possible.',ja:'今は無事です。また連絡できるときに連絡します。'},
    {id:'help',label:'I need help · 助けが必要',en:'I need help. Please contact me if you can.',ja:'助けが必要です。可能なら連絡してください。'}
  ];
  const SMS_LANGUAGES = ['en','ja','both'];
  const SMS_STATUSES = ['unsent','draft-opened','user-confirmed-sent'];
  const CONTACT_ID = /^c-[1-9]\d{0,8}$/;
  const emptyCommunication = () => ({template:'checkin',language:'both',currentLocation:'',selected:[],entries:{},pendingId:''});
  // Conservative limits keep optional photos within the existing 2 MB v1
  // backup/import contract. JPEGs are re-encoded, stripping source EXIF/GPS.
  const EVIDENCE_MAX_RECORDS = 12;
  const EVIDENCE_MAX_PHOTOS = 6;
  const EVIDENCE_MAX_PHOTO_CHARS = 120_000;
  const EVIDENCE_MAX_TOTAL_CHARS = 650_000;
  const EVIDENCE_MAX_FILE_BYTES = 8_000_000;
  const emptyEvidence = () => ({draft:{note:'',photos:[]},entries:[],nextId:1,nextPhotoId:1});
  const validEvidencePhoto = x => !!x && typeof x==='object' && !Array.isArray(x)
    && /^p-[1-9]\d{0,8}$/.test(x.id)
    && typeof x.image==='string' && x.image.length<=EVIDENCE_MAX_PHOTO_CHARS
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(x.image)
    && Number.isInteger(x.width) && x.width>0 && x.width<=960
    && Number.isInteger(x.height) && x.height>0 && x.height<=960;
  const TOUR = [
    {jp:'はじめに',title:'A quiet watcher for a loud country.',body:'Disaster Management helps you prepare and walks you through difficult moments. Its first version works manually, even without a live feed.',points:[['Guided seven-step earthquake response','Offline guide'],['Checklist, contacts and safety notes','Saved here'],['Weather and quake monitoring','Not connected']]},
    {jp:'持ち出し',title:'Make your emergency kit visible.',body:'A readiness score is only useful when it reflects things you have genuinely checked.',points:[['Mark each item when verified','No assumptions'],['Prepare water, food and a go-bag','Your checklist'],['Remember to review dates','Manual']]},
    {jp:'緊急連絡先',title:'Save who you would contact.',body:'Add a few trusted contacts on your own device. The app helps draft a check-in, but cannot send one secretly.',points:[['Contacts stored in this browser','Local only'],['SMS needs your confirmation','Compose'],['Disaster Message Dial 171','Japan']]},
    {jp:'住所',title:'Know your address and shelter.',body:'Save your home address, workplace and officially verified shelter name. You may test browser location once, but no coordinates are retained. Manual entry always works.',points:[['Your address in a Japanese phone script','Personalized'],['Shelter name if confirmed','Manual'],['Location test requires your tap','Optional']]},
    {jp:'持ち物',title:'A two-second departure check.',body:'Before leaving, mark your wallet, pass, phone and keys. If something is missing, browse a practical fallback plan.',points:[['Wallet / pass / phone / keys','Manual'],['Stranded options','Step by step'],['Bluetooth/geofences','Not connected']]},
    {jp:'オフライン',title:'Keep the guide with you.',body:'After loading once and allowing the app to install its offline cache, the interface and saved records can work without internet.',points:[['App shell cached in your browser','Offline'],['Live alerts require internet','Separate'],['No cloud backup yet','Export data']]},
    {jp:'同意',title:'Your safety, your decisions.',body:'No Akatsuki, calendar, Bluetooth or remote data feed is connected. Browser permission checks and protected-storage requests only run when you tap their buttons.',points:[['Data remains in this browser','No sign-in'],['Permissions are optional','Manual fallback'],['Encrypted exports and restore preview','Settings']]}
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
      contacts:[],nextContactId:1,incident:{active:false,step:1,done:{},contacted:[],note:'',oneStep:false,cursor:{},outcomes:{},stepOutcomes:{},paused:false,lowPower:false,communication:emptyCommunication()},
      evidence:emptyEvidence(),
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
    const rawContacts=(Array.isArray(raw.contacts)?raw.contacts:[]).filter(c=>c&&typeof c.name==='string'&&typeof c.phone==='string').slice(0,100);
    const reserved=new Set(rawContacts.map(c=>c.id).filter(id=>typeof id==='string'&&CONTACT_ID.test(id)));
    const assigned=new Set();let generated=1;
    d.contacts=rawContacts.map(c=>{
      let id=c.id;
      if(typeof id!=='string'||!CONTACT_ID.test(id)||assigned.has(id)){
        while(reserved.has('c-'+generated)||assigned.has('c-'+generated))generated++;
        id='c-'+generated++;
      }
      assigned.add(id);
      return {id,name:str(c.name,70),phone:str(c.phone,26),role:CONTACT_ROLES.includes(c.role)?c.role:'unspecified'};
    });
    d.nextContactId=Math.max(num(raw.nextContactId,1_000_000_000,1),...d.contacts.map(c=>Number(c.id.slice(2))+1),1);
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
    d.incident.paused=!!incident.paused && d.incident.active;
    d.incident.lowPower=!!incident.lowPower;
    // Optional v1 follow-up records never disappear when the incident guide
    // resets. They remain in the same local/unencrypted export and restore.
    const evidence=obj(raw.evidence),draft=obj(evidence.draft);
    d.evidence.draft.note=str(draft.note,1200);
    d.evidence.draft.photos=(Array.isArray(draft.photos)?draft.photos:[]).map(p=>({id:p.id,image:p.image,width:p.width,height:p.height}));
    d.evidence.entries=(Array.isArray(evidence.entries)?evidence.entries:[]).map(e=>({
      id:e.id,at:e.at,note:str(e.note,1200),photos:e.photos.map(p=>({id:p.id,image:p.image,width:p.width,height:p.height}))
    }));
    d.evidence.nextId=Math.max(1,num(evidence.nextId,1_000_000_000,1),...d.evidence.entries.map(e=>Number(e.id.slice(2))+1));
    d.evidence.nextPhotoId=Math.max(1,num(evidence.nextPhotoId,1_000_000_000,1),
      ...[d.evidence.draft,...d.evidence.entries].flatMap(e=>e.photos).map(p=>Number(p.id.slice(2))+1));
    // Phase 3B adds optional v1 fields. Missing communication records are
    // always UNSENT, including old `incident.contacted` (a separate manual mark).
    const communication=obj(incident.communication),state=d.incident.communication;
    state.template=SMS_TEMPLATES.some(x=>x.id===communication.template)?communication.template:'checkin';
    state.language=SMS_LANGUAGES.includes(communication.language)?communication.language:'both';
    state.currentLocation=str(communication.currentLocation,120);
    const existingIds=new Set(d.contacts.map(c=>c.id));
    state.selected=(Array.isArray(communication.selected)?communication.selected:[])
      .filter(id=>typeof id==='string'&&existingIds.has(id)).filter((id,k,all)=>all.indexOf(id)===k);
    const validSavedTime=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value)
      && Number.isFinite(Date.parse(value));
    for(const [id,rawEntry] of Object.entries(obj(communication.entries))){
      if(!existingIds.has(id))continue;
      const entry=obj(rawEntry),contact=d.contacts.find(c=>c.id===id);
      const requestedAt=validSavedTime(entry.requestedAt)?str(entry.requestedAt,35):'';
      const openedAt=validSavedTime(entry.openedAt)?str(entry.openedAt,35):'';
      const confirmedAt=validSavedTime(entry.confirmedAt)?str(entry.confirmedAt,35):'';
      let status=SMS_STATUSES.includes(entry.status)?entry.status:'unsent';
      if((status==='draft-opened'&&!openedAt)||(status==='user-confirmed-sent'&&!confirmedAt)||(!requestedAt&&status!=='unsent'))status='unsent';
      state.entries[id]={name:str(entry.name,70)||contact.name,phone:str(entry.phone,26)||contact.phone,
        status,requestedAt,openedAt,confirmedAt,
        skipped:!!entry.skipped};
    }
    if(typeof communication.pendingId==='string'&&state.selected.includes(communication.pendingId)
      &&state.entries[communication.pendingId]?.requestedAt
      &&state.entries[communication.pendingId].status==='unsent')state.pendingId=communication.pendingId;
    for(const [stepNumber,result] of Object.entries(obj(incident.stepOutcomes))){
      if(/^[1-7]$/.test(stepNumber) && ['cant','skip'].includes(result))
        d.incident.stepOutcomes[stepNumber]=result;
    }
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
    // Never silently truncate/destroy photo evidence from an incompatible or
    // damaged backup. Preserve original bytes in quarantine instead.
    if(record.evidence!==undefined && !validEvidenceRecord(record.evidence))return null;
    return record;
  }
  function validEvidenceRecord(evidence) {
    if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)
      ||!evidence.draft||typeof evidence.draft.note!=='string'||!Array.isArray(evidence.draft.photos)
      ||!Array.isArray(evidence.entries)||evidence.entries.length>EVIDENCE_MAX_RECORDS
      ||!Number.isInteger(evidence.nextId)||evidence.nextId<1||evidence.nextId>999_999_999
      ||!Number.isInteger(evidence.nextPhotoId)||evidence.nextPhotoId<1||evidence.nextPhotoId>999_999_999)return false;
    const entries=[evidence.draft,...evidence.entries],seenEntries=new Set(),seenPhotos=new Set();
    let totalPhotos=0,totalChars=0;
    for(const entry of entries){
      if(!entry||typeof entry!=='object'||typeof entry.note!=='string'||entry.note.length>1200||!Array.isArray(entry.photos))return false;
      if(entry!==evidence.draft){
        if(!/^e-[1-9]\d{0,8}$/.test(entry.id)||seenEntries.has(entry.id)||Number(entry.id.slice(2))>=evidence.nextId
          ||typeof entry.at!=='string'||entry.at.length>35||Number.isNaN(Date.parse(entry.at)))return false;
        seenEntries.add(entry.id);
      }
      for(const photo of entry.photos){
        if(!validEvidencePhoto(photo)||seenPhotos.has(photo.id)||Number(photo.id.slice(2))>=evidence.nextPhotoId)return false;
        seenPhotos.add(photo.id);totalPhotos++;totalChars+=photo.image.length;
      }
    }
    return totalPhotos<=EVIDENCE_MAX_PHOTOS&&totalChars<=EVIDENCE_MAX_TOTAL_CHARS;
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
  let pendingImport = null; // Preview only; no live record is changed until Apply.
  let evidenceUploadBusy = false;
  const permissionState = {location:'Not checked',notification:'Not checked',storage:'Not checked',locationTest:'Not tested'};
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
  function go(page) {
    if(page!=='settings')contactEditIndex=null;
    if(data.page==='incident' && page!=='incident' && data.incident.active)data.incident.paused=true;
    if(page==='incident' && data.incident.active)data.incident.paused=false;
    data.page=page;update();window.scrollTo({top:0,behavior:'instant'});
  }
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
        ${[['watch','Watch','eye'],['readiness','Ready','shield'],['incident','Incident','alert'],['night','Night','moon'],['log','Log','log'],['settings','Settings','settings']].map(([p,l,i])=>`<button data-action="go" data-page="${p}" class="${section===p?'active':''} ${p==='incident'?'danger':''}" aria-current="${section===p?'page':'false'}">${icon(i)}<span>${l}</span></button>`).join('')}
      </nav>
      <button type="button" class="mobile-scroll-top" data-action="scroll-top" aria-label="Back to top of this page" hidden>↑ Top</button>
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
      ${data.incident.active?`<section class="p3a-resume" aria-label="Unfinished incident guide"><div><span>UNFINISHED · LOCALLY SAVED</span><h2>Resume earthquake guide · step ${data.incident.step} of 7</h2><p>${data.incident.paused?'You left the guide before finishing.':'The guide has unfinished progress.'} Checked, can't-do and skipped items remain distinct; none is assumed safe or completed.</p></div>${action('go','Resume guide','btn-primary btn-lg','data-page="incident"')}</section>`:''}
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
    const stepOutcome=i.stepOutcomes[i.step];
    return `<div class="incident-page p1b-incident ${i.lowPower?'p3a-simple':''}" role="region" aria-label="Offline earthquake response guide">
      <div class="p1b-incident-top"><span>EARTHQUAKE · 地震</span><span>STEP ${i.step} / ${total}</span></div>
      <div class="p1b-incident-progress" role="group" aria-label="Guide navigation; earlier steps are not necessarily completed">${INC.map(x=>`<button type="button" class="p1b-incident-segment ${x.n<i.step?'past':''} ${x.n===i.step?'current':''}" data-action="incident-step" data-step="${x.n}" aria-label="Go to step ${x.n}: ${safe(x.title)}" ${x.n===i.step?'aria-current="step"':''}></button>`).join('')}</div>
      <header class="p1b-incident-header"><div class="p1b-overline">${i.active?'GUIDE IN PROGRESS':'OFFLINE GUIDE READY'}</div><h1>${step.n===1?'Are you hurt?':safe(step.title)}</h1><p class="p1b-incident-jp">${step.n===1?'怪我をしていますか？':safe(step.jp)}</p><p class="p1b-incident-lead">${safe(step.desc)}</p></header>
      <div class="p1b-emergency-bar" role="note">${icon('alert')}<span>Protect yourself during shaking. <a href="tel:119">119 · Ambulance / fire</a> or <a href="tel:110">110 · Police</a>. Links only request the dialer: if it does not open, dial manually on a supported phone or ask someone nearby. No call is placed or confirmed by this app. Current hazards and routes are not monitored.</span></div>
      <div class="p3a-status-row" role="group" aria-label="Incident display options">${action('incident-low-power',i.lowPower?'Show standard display':'Use simpler display','btn-outline btn-sm',`aria-pressed="${i.lowPower}"`)}<span>Manual low-power reading layout · does not change device battery settings</span></div>
      ${stepOutcome?`<div class="p3a-unfinished" role="status"><strong>${stepOutcome==='cant'?'Cannot do this step right now':'Step skipped for now'} · NOT COMPLETE</strong><p>Return to this step when safe; its actions have not been verified.</p>${action('incident-step-clear','Clear this step status','btn-quiet btn-sm')}</div>`:''}
      ${incidentBody(step)}
      ${incidentHelp(step)}
      <div class="p3a-step-outcomes" role="group" aria-label="Step status">${action('incident-step-cant','Can’t do this step','btn-outline btn-sm')}${action('incident-step-skip','Skip step for now','btn-outline btn-sm')}<small>These choices never mark a step complete. “Can’t” shows a safe fallback; “Skip” moves on without confirming anything.</small></div>
      <div class="p1b-incident-controls">${action('incident-prev','← Previous step','btn-outline',i.step===1?'disabled':'')}${action(i.step===7?'finish-incident':'incident-next',i.step===7?'Save review to log':'Continue to step '+(i.step+1)+' →','btn-primary')}${action('go','Leave guide (progress saved)','btn-quiet','data-page="watch"')}</div>
      <p class="p1b-incident-footnote">Safety copy reviewed ${INCIDENT_GUIDANCE_REVIEW} against Japanese official sources; not a live assessment. Tsunami and other warnings here are <strong>unknown</strong>. ${netOnline?'Browser reports a connection, but may not reach websites.':'Browser reports offline; external official links may not work.'} Steps and unavailable actions remain saved locally.</p>
    </div>`;
  }
  function incidentHelp(step) {
    const help=INCIDENT_HELP[step.n];
    return `<details class="p3a-help" ${data.incident.stepOutcomes[step.n]==='cant'?'open':''}><summary>Help with this step · 困ったときは</summary><div><h2>${safe(help.title)}</h2><ul>${help.points.map(([en,jp])=>`<li><strong>${safe(en)}</strong><span lang="ja">${safe(jp)}</span></li>`).join('')}</ul>
      <p>Guidance may not fit every situation. Prioritize immediate safety and current official instructions; this app has no live hazard status.</p>
      ${step.n===3?`<p>${link('https://www.ntt-east.co.jp/saigai/news/','NTT 171 current availability (online)')}</p>`:''}
      ${step.n===4?`<p>${link('https://www.jma.go.jp/bosai/','JMA live warnings (online)')}</p>`:''}
    </div></details>`;
  }
  function communicationPanel() {
    const state=data.incident.communication,selected=new Set(state.selected);
    const pending=data.contacts.find(c=>c.id===state.pendingId);
    const next=selectedContacts().find(c=>{
      const entry=state.entries[c.id];
      return !entry || (entry.status==='unsent'&&!entry.skipped&&!entry.requestedAt);
    });
    const statusText=(entry,id)=>{
      if(id===state.pendingId)return ['Draft requested · outcome unverified','pending'];
      if(entry?.status==='user-confirmed-sent')return ['User confirmed Send · delivery UNKNOWN','sent'];
      if(entry?.status==='draft-opened')return ['Draft opened · user-reported, not sent-confirmed','opened'];
      return [entry?.skipped?'Unsent · skipped for now':'Unsent · no draft confirmed','unsent'];
    };
    return `<section class="incident-step-card p3b-communication" aria-label="Emergency SMS communication">
      <div class="p3b-heading"><div><span class="sublabel">PHASE 3B · MANUAL COMMUNICATION</span><h2>Emergency messages · 緊急連絡</h2></div><span class="p3b-local">LOCAL ONLY · NO AUTO-SEND</span></div>
      <p>Choose the message that is <strong>true right now</strong>. No safety status or current location is inferred from your home address, shelter, readiness checks or the network. For immediate danger, use <a href="tel:119">119</a> or <a href="tel:110">110</a>; SMS may be delayed.</p>
      <fieldset class="p3b-choices"><legend>Message type · 状況</legend>${SMS_TEMPLATES.map(t=>`<label><input type="radio" name="sms-template" data-communication-template="${t.id}" ${state.template===t.id?'checked':''}/><span>${safe(t.label)}</span></label>`).join('')}</fieldset>
      <fieldset class="p3b-choices p3b-languages"><legend>Message language · 言語</legend>${[['en','English'],['ja','日本語'],['both','English + 日本語']].map(([value,label])=>`<label><input type="radio" name="sms-language" data-communication-language="${value}" ${state.language===value?'checked':''}/><span>${label}</span></label>`).join('')}</fieldset>
      <div class="text-field p3b-location"><label for="sms-current-location">Current location · optional, typed by you</label><input id="sms-current-location" maxlength="120" autocomplete="off" value="${safe(state.currentLocation)}" placeholder="Only if you know where you are now"/><small>Never copied from your saved home, office, safe place or shelter. This entry stays in local v1 records and backups until you finish/reset the guide. Clear it if it becomes outdated.</small></div>
      <div class="p3b-preview" aria-label="SMS text preview"><div class="sublabel">REVIEW EXACT MESSAGE BEFORE SENDING</div><p id="p3b-message-preview">${safe(safetyMessage())}</p>${action('copy-message',icon('copy','sm')+' Copy this text','btn-primary btn-sm')}<small>Copying is not sending. An SMS app may ignore the prefilled body; on iPhone/iPad, copy and paste it manually. Bilingual messages may use multiple billable SMS segments.</small></div>
      <div class="p3b-heading"><h3>Select contacts in saved priority order</h3><small>${selected.size} selected · one draft at a time</small></div>
      ${data.contacts.length?`<div class="p3b-recipient-list">${data.contacts.map((c,k)=>{
        const entry=state.entries[c.id],chosen=selected.has(c.id),[label,kind]=statusText(entry,c.id);
        const stale=!!entry&&entry.phone!==c.phone;
        const valid=!!phoneForComposer(c.phone);
        return `<div class="p3b-recipient ${chosen?'is-selected':''}" data-contact-id="${safe(c.id)}"><div class="p3b-recipient-title"><div><strong>${k+1}. ${safe(c.name)}</strong><small>${safe(contactRole(c.role))} · ${safe(c.phone)}</small></div>${action('communication-select',chosen?'Remove from queue':'Select',chosen?'btn-outline btn-sm':'btn-quiet btn-sm',`data-id="${safe(c.id)}" aria-pressed="${chosen}"`)}</div>
          <div class="p3b-recipient-status"><span class="p3b-status ${kind}">${safe(label)}</span>${stale?'<strong class="p3b-stale">Phone changed; old draft cannot be reused.</strong>':''}${!valid?'<strong class="p3b-stale">Invalid phone — edit in Settings.</strong>':''}</div>
          <div class="p3b-recipient-actions">${action('sms-contact','Review SMS draft','btn-outline btn-sm',`data-index="${k}" ${!valid||stale||state.pendingId||entry?.status==='user-confirmed-sent'||entry?.status==='draft-opened'?'disabled':''}`)}
            ${entry?.status==='draft-opened'?action('communication-confirm-sent','I tapped Send','btn-success btn-sm',`data-id="${safe(c.id)}"`):''}
            ${entry?.status==='draft-opened'?action('communication-no-send','Did not send','btn-outline btn-sm',`data-id="${safe(c.id)}"`):''}
            ${(entry?.skipped||stale||entry?.status==='user-confirmed-sent')?action('communication-reset','Start new draft','btn-quiet btn-sm',`data-id="${safe(c.id)}"`):''}
            ${action('incident-contact',data.incident.contacted.includes(k)?'Reached ✓ (manual)':'Mark reached (manual)',data.incident.contacted.includes(k)?'btn-success btn-sm':'btn-outline btn-sm',`data-index="${k}"`)}
          </div></div>`;
      }).join('')}</div>`:`<div class="info-band amber">${icon('info')}<div>No contacts saved. Add a person in Settings first, or copy the message manually. ${action('go','Add contacts','btn-quiet btn-sm','data-page="settings"')}</div></div>`}
      <div class="p3b-queue"><strong>Sequential composition · 一人ずつ</strong><p>Each tap requests a draft for <strong>one recipient only</strong>. After the SMS app, return here and report what actually happened. Nothing is sent automatically.</p>
        ${action('communication-next',next?'Open next draft · '+safe(next.name):'No unreviewed recipient', 'btn-primary',`aria-label="Open next SMS draft" ${!next||state.pendingId?'disabled':''}`)}
        <small>${next?'Next by priority: '+safe(next.name):'Select at least one contact, or review/reset earlier attempts.'} · SMS app availability and delivery are unknown.</small></div>
      ${pending?`<div class="p3b-pending" role="status"><strong>Draft requested for ${safe(pending.name)} · outcome NOT verified</strong><p>The app cannot tell whether the SMS composer actually opened. If you sent it yourself, report that; otherwise keep it unsent or acknowledge seeing the draft. This choice stays saved if you leave and return.</p><div class="p3b-pending-actions">${action('communication-confirm-open','I saw the draft open','btn-outline btn-sm',`data-id="${safe(pending.id)}"`)}${action('communication-confirm-sent','I tapped Send in SMS app','btn-success btn-sm',`data-id="${safe(pending.id)}"`)}${action('communication-no-send','Not sent / could not open','btn-quiet btn-sm',`data-id="${safe(pending.id)}"`)}</div></div>`:''}
      <p class="p3b-disclaimer"><strong>Delivery status is always UNKNOWN.</strong> “User confirmed Send” means you reported tapping Send, not that a carrier accepted it or the recipient received it. “Reached (manual)” is a separate note, including in older records; it never proves an SMS was delivered.</p>
      <div class="info-band blue" style="margin-top:18px">${icon('phone')}<div><strong>Disaster Message Dial 171 · 災害用伝言ダイヤル</strong><br>This is <strong>not an always-on service</strong>. NTT activates 171 during eligible disasters and announced practice periods. Availability is <strong>unknown in this offline app</strong>. When offered, <a href="tel:171">dial 171</a> (or enter 171 manually), follow voice prompts: 1 to record or 2 to play, then the requested phone-number steps. <a href="https://www.ntt-east.co.jp/saigai/voice171s/rec.html" target="_blank" rel="noopener noreferrer">NTT instructions</a> · <a href="https://www.ntt-east.co.jp/saigai/news/" target="_blank" rel="noopener noreferrer">current availability (requires internet)</a>. The app cannot call or verify a recording.</div></div>
    </section>`;
  }
  function incidentBody(step) {
    const i=data.incident,done=i.done[i.step]||[];
    if(step.n===1) return `<section class="p1b-incident-card p1b-call-card"><p>Call if anyone needs urgent medical assistance or is in danger. These links open the dialer; the app does not place a call by itself.</p><div class="p1b-call-buttons"><a class="p1b-call-primary" href="tel:119"><span><strong>Yes — call 119</strong><small>救急・消防 · Ambulance / Fire</small></span>${icon('phone','lg')}</a><a class="p1b-call-secondary" href="tel:110"><span><strong>Danger / crime — 110</strong><small>警察 · Police</small></span>${icon('phone','lg')}</a></div><div class="p1b-phone-script"><span>SAY ON THE PHONE · 日本語</span><strong>救急です。今いる場所は［現在地を確認］です。</strong><small>“I need an ambulance. My current location is …” Give the dispatcher your ACTUAL location or a nearby landmark.</small>${data.profile.home?`<small>Saved home address (NOT assumed to be your current position): ${safe(data.profile.home)}</small>`:''}</div></section>`;
    if(step.items) {
      const statuses=i.outcomes[i.step]||{},cursor=Math.min(i.cursor[i.step]||0,step.items.length);
      const complete=step.items.filter((_,k)=>done.includes(k)).length;
      const reviewed=step.items.filter((_,k)=>done.includes(k)||statuses[k]).length;
      const unresolved=step.items.length-complete;
      const focused=cursor<step.items.length?step.items[cursor]:null;
      return `<section class="p1b-incident-card p1b-checklist-card"><div class="p1b-checklist-heading"><div><h2>${i.oneStep?'One item at a time':'Safety checklist'}</h2><p>${reviewed} of ${step.items.length} reviewed · ${unresolved} not confirmed done. If unsafe, choose “Can’t” or “Skip” and continue.</p></div>${action('incident-mode',i.oneStep?'Show full checklist':'One at a time','btn-outline btn-lg')}</div>
      ${i.oneStep ? (focused ? `<div class="p1b-one-progress">ITEM ${cursor+1} OF ${step.items.length} · ${done.includes(cursor)?'MARKED DONE':statuses[cursor]==='cant'?'CAN’T DO':statuses[cursor]==='skip'?'SKIPPED':'NOT REVIEWED'}</div><div class="p1b-one-item"><h3>${safe(focused[0])}</h3><p lang="ja">${safe(focused[1])}</p></div><details class="p3a-item-help"><summary>Help if I can't do this item · できないとき</summary><p>${safe(ITEM_FALLBACKS[step.n]?.[cursor] || 'If it is unsafe, do not force it. Try again later.')}</p></details><div class="p1b-one-actions"><button type="button" class="p1b-one-done" data-action="incident-item-outcome" data-index="${cursor}" data-result="done">Done ${icon('check','sm')}</button><button type="button" class="p1b-one-cant" data-action="incident-item-outcome" data-index="${cursor}" data-result="cant">Can’t do</button><button type="button" class="p1b-one-skip" data-action="incident-item-outcome" data-index="${cursor}" data-result="skip">Skip for now</button></div>${cursor>0?action('incident-item-prev','← Previous item','btn-quiet btn-lg'):''}` : `<div class="p1b-one-summary"><h3>Checklist reviewed</h3><p>${complete} done, ${Object.values(statuses).filter(s=>s==='cant').length} can’t do, ${Object.values(statuses).filter(s=>s==='skip').length} skipped. Unfinished actions are not marked complete. Revisit them if conditions allow.</p>${action('incident-item-restart','Review items again','btn-outline btn-lg')}</div>`) : `<div class="p1b-list-items">${step.items.map(([t,j],k)=>{const status=done.includes(k)?'done':statuses[k]||'pending';return `<button class="p1b-list-item ${status}" data-action="incident-toggle" data-index="${k}" aria-pressed="${status==='done'}" aria-label="${safe(t)} · ${status==='done'?'Done, tap to undo':status==='cant'?'Can’t do; tap to mark done':status==='skip'?'Skipped; tap to mark done':'Not reviewed; tap to mark done'}"><span class="p1b-list-mark">${status==='done'?icon('check','sm'):''}</span><span class="p1b-list-text"><strong>${safe(t)}</strong><small lang="ja">${safe(j)}</small></span><span class="p1b-list-status">${status==='done'?'Done':status==='cant'?'Can’t':status==='skip'?'Skipped':'Pending'}</span></button>`;}).join('')}</div>`}
        ${step.n===2?`<div class="info-band amber" style="margin-top:17px">${icon('alert')}<div>If shaking starts again, drop, cover your head, and hold on. Avoid operating gas equipment if you suspect a leak.</div></div>`:''}
        ${step.n===6?`<div class="link-list" style="margin-top:18px">${link('https://www.jma.go.jp/bosai/','JMA official updates')}${link('https://www.nhk.or.jp/kishou-saigai/','NHK disaster info')}</div>`:''}
        ${step.n===7?`<div class="text-field" style="margin-top:20px"><label for="incident-note">What happened / what to improve</label><textarea id="incident-note" data-save-field="incident.note" placeholder="For your private incident log…">${safe(i.note)}</textarea></div>`:''}
        ${step.n===7?evidencePanel(false):''}
      </section>`;
    }
    if(step.n===3) return communicationPanel();
    if(step.n===4) return `<section class="incident-step-card"><h3>Use current, verified warnings.</h3><p>This app has no live quake, tsunami, shelter availability or route feed. <strong>Tsunami status: UNKNOWN.</strong> At the coast, leave for higher, safer ground promptly after strong or long shaking without waiting for an alert. Never rely on a demonstration map for evacuation.</p>
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
  function evidencePanel(inLog) {
    const e=data.evidence,draft=e.draft;
    const photoCount=[draft,...e.entries].reduce((n,item)=>n+item.photos.length,0);
    const gallery=(photos,editable)=>photos.length?`<div class="p3c-gallery" aria-label="User-provided photo thumbnails">${photos.map((photo,k)=>`<figure><img src="${photo.image}" alt="User-selected photo ${k+1}; not an official assessment" loading="lazy"/><figcaption>Photo ${k+1} · ${photo.width}×${photo.height}${editable?action('evidence-remove-photo','Remove','btn-quiet btn-sm',`data-id="${photo.id}" aria-label="Remove photo ${k+1}"`):''}</figcaption></figure>`).join('')}</div>`:'';
    return `<section class="p3c-evidence" aria-label="Local follow-up evidence">
      <div class="p3c-evidence-heading"><div><span class="p1c-overline">PHASE 3C · OPTIONAL · 記録</span><h2>Private follow-up evidence</h2></div><span class="p3c-local">LOCAL ONLY · UNVERIFIED</span></div>
      <div class="p3c-evidence-warning" role="note">${icon('alert','sm')}<p><strong>Safety first · 安全第一.</strong> Never return to an unsafe area to collect evidence. Photos and notes are your own observations, <strong>not an official damage assessment</strong>. For danger or injury, use emergency services, not this form.<span lang="ja">危険な場所に戻って撮影しないでください。写真は公的な被害判定ではありません。</span></p></div>
      <p>Only add what you personally know. No GPS, address, event severity or damage status is inferred. Choose an existing photo only when safe; the app never starts a camera or uploads a photo.</p>
      <div class="p3c-draft"><div class="p3c-draft-title"><strong>${draft.photos.length||draft.note.trim()?'Draft saved locally':'New private draft'}</strong><small>Draft survives leaving this page or an offline reload.</small></div>
        <label class="p3c-label" for="p3c-evidence-note">My observation · 私の記録 · optional</label><textarea id="p3c-evidence-note" maxlength="1200" rows="3" placeholder="What you observed, when it was safe…">${safe(draft.note)}</textarea>
        <label class="p3c-photo-input" for="p3c-photo-file"><span>${icon('plus','sm')} Add selected photo(s) · 写真を追加 · optional</span><input id="p3c-photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,image/bmp" multiple aria-describedby="p3c-photo-help"/></label>
        <p id="p3c-photo-help" class="p3c-help">At most ${EVIDENCE_MAX_PHOTOS} small photos across all records. Each is compressed to JPEG (up to 960 px); the original filename and EXIF/GPS are not kept. Avoid faces, IDs, and sensitive addresses. The image itself may still reveal private details.</p>
        ${gallery(draft.photos,true)}
        <div class="p3c-draft-actions">${action('evidence-save','Save follow-up record · 記録を保存','btn-primary',`${!draft.note.trim()&&!draft.photos.length?'disabled':''}`)}${action('evidence-clear','Discard this draft','btn-outline',`${!draft.note.trim()&&!draft.photos.length?'disabled':''}`)}</div>
        <p class="p3c-storage-note">All photos and notes are saved in <code>disaster-management:v1</code> as <strong>unencrypted local browser data</strong>. They are included in JSON and password-encrypted backups; browser/site data erasure loses them. Export a private backup if important. No cloud sync or automatic sharing.</p>
      </div>
      <div class="p3c-records-heading"><h3>Saved observations</h3><small>${e.entries.length} records · ${photoCount} photos including drafts · max ${EVIDENCE_MAX_RECORDS} records</small></div>
      ${e.entries.length?`<div class="p3c-records">${e.entries.map(record=>`<article class="p3c-record"><div class="p3c-record-header"><div><strong>Self-reported observation</strong><time datetime="${safe(record.at)}">${safe(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(record.at)))}</time></div>${action('evidence-delete','Delete record','btn-outline btn-sm',`data-id="${safe(record.id)}"`)}</div>${record.note?`<p class="p3c-record-note">${safe(record.note)}</p>`:''}${gallery(record.photos,false)}<small>Personal record · not official, not verified or submitted</small></article>`).join('')}</div>`:`<p class="p3c-empty">No evidence records yet. A draft is separate from a completed record.</p>`}
      ${!inLog?`<p class="p3c-navigation">Earlier observations remain accessible from Activity Log after you finish the incident guide. ${action('go','View activity history','btn-quiet btn-sm','data-page="log"')}</p>`:''}
    </section>`;
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
      ${evidencePanel(true)}
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
    const contactsForm=`<div id="p1c-contacts" class="p1c-settings-form p2a-contacts-form"><h3>Emergency contacts · in priority order</h3>
          <p>Contacts are kept locally. A drafted SMS is never sent automatically; check the destination and message each time.</p>
          <div class="p2a-helper" role="status">${data.contacts.length?missing.join(' ')||'Primary and backup roles assigned.':'No contacts saved. Add a trusted person, then assign primary and backup roles.'}</div>
          ${editing?`<p class="p2a-editing">Editing ${safe(editing.name)} · Priority ${contactEditIndex+1}</p>`:''}
          <div class="text-field"><label for="contact-name">Contact name</label><input id="contact-name" maxlength="70" value="${safe(editing?.name||'')}" placeholder="e.g. Brother"/></div>
          <div class="text-field"><label for="contact-phone">Phone number</label><input id="contact-phone" maxlength="26" value="${safe(editing?.phone||'')}" placeholder="+81 90 1234 5678" inputmode="tel"/><small>Japanese local or international +country-code format, 6–15 digits. You must check that it is correct.</small></div>
          <div class="text-field"><label for="contact-role">Role</label><select id="contact-role">${roles(editing?.role||'unspecified')}</select></div>
          <div class="p2a-contact-controls">${action(editing?'save-contact':'add-contact',editing?'Save contact changes':'Add contact','btn-primary')}${editing?action('contact-cancel','Cancel edit','btn-outline'):''}</div>
          <div class="p1c-contact-list" aria-label="Saved emergency contacts">${data.contacts.length?personCards:'<p>No contacts saved.</p>'}</div>
          <p class="p2a-disclaimer">Up/down controls set the order used by the emergency message screen. Existing records without assigned roles stay <strong>unassigned</strong> until you edit them.</p>
        </div>`;
    const placesForm=`<div id="p1c-places" class="p1c-settings-form p2a-place-form"><h3>Places · self-reported</h3>
          ${placeInput('home','home-address','Home address · 自宅住所','Ward / city, chōme, banchi…')}
          ${placeInput('office','office-address','Office / regular departure point','Optional')}
          ${placeInput('safePlace','safe-place','Preferred check-in location','Optional meeting place')}
          ${placeInput('station','preferred-station','Preferred station · 最寄り駅','e.g. Minami-Urawa')}
          ${placeInput('shelter','shelter-name','Municipal designated shelter · 指定避難所','Use your local municipality’s official list')}
          <div class="text-field"><label for="shelter-source">Municipality source you checked</label><input id="shelter-source" maxlength="240" value="${safe(data.profile.shelterSource)}" placeholder="Municipality URL or notice title"/><small>Required before marking the shelter as checked. This source is user-entered, not automatically validated.</small></div>
          <div class="p2a-helper">${icon('info')} If you change a saved value or the shelter source, review its checkbox again. A checked shelter may still close or become inaccessible in a disaster.</div>
          ${action('save-profile','Save these places','btn-primary')}
        </div>`;
    return group('details','05 · IMPORTANT DETAILS','Contacts and places',`<p>Only store details you are comfortable keeping in unencrypted browser storage. Labels show what <strong>you</strong> checked, not a verified system feed or a safe evacuation route.</p>
      <div class="p1c-settings-two p2a-settings-two">${contactsForm}${placesForm}</div>`);
  }
  function hasPreimportSnapshot() {
    try {return localStorage.getItem(PREIMPORT_KEY)!==null;} catch {return false;}
  }
  function importCounts(record) {
    const photos=[record.evidence.draft,...record.evidence.entries].reduce((sum,e)=>sum+e.photos.length,0);
    return `${record.contacts.length} contacts · ${record.logs.length} log entries · ${record.rules.length} rules · ${record.evidence.entries.length} evidence records + ${photos} photos (including drafts) · ${record.readiness.custom.length} extra kit items · ${CHECKS.filter(c=>record.checks[c.id]).length} checked essentials`;
  }
  function importPreview() {
    if(!pendingImport)return '';
    const b=pendingImport;
    const header=`<div class="p2c-preview-heading"><div><span class="p1c-overline">RESTORE REVIEW · NOTHING CHANGED YET</span><h3>${b.kind==='locked'?'Unlock encrypted backup':'Review before replacing records'}</h3><p>${safe(b.filename)} · ${b.fromSnapshot?'Previous local recovery copy':b.encrypted?'Password-encrypted file':'Unencrypted JSON file'}</p></div>${action('cancel-import','Cancel','btn-outline')}</div>`;
    if(b.kind==='locked')return `<section id="p2c-import-preview" class="p2c-preview" aria-label="Encrypted backup unlock">${header}<p>Enter the password for this file. Decryption happens locally. A wrong password changes no saved data.</p><div class="text-field"><label for="p2c-unlock-password">Backup password</label><input id="p2c-unlock-password" type="password" autocomplete="off" minlength="12" maxlength="256" /></div>${action('unlock-import','Unlock and preview','btn-primary')}<p class="p2c-footnote">Lost passwords cannot be recovered by the app.</p></section>`;
    const current=recoveryRaw!==null?'Current storage is quarantined (unreadable in this version).':importCounts(data);
    const future=b.kind==='unreadable';
    return `<section id="p2c-import-preview" class="p2c-preview" aria-label="Backup restore preview">${header}<div class="p2c-comparison"><div><strong>Saved in this browser now</strong><p>${safe(current)}</p></div><div><strong>Selected backup</strong><p>${future?'Previous raw records cannot be read by this version; restoring them will return to recovery mode.':safe(importCounts(b.record))}</p></div></div><p class="p2c-warning">${future?'This original snapshot is not compatible with the current app. Restore the untouched bytes only if you intend to recover them later with a compatible version.':'Importing replaces the current Disaster Management record, including contacts, kit details and logs. It will NOT merge the two records.'} A one-slot local copy of the current bytes is attempted first. If that copy cannot be saved, replacement is refused.</p>${action('apply-import',future?'Restore original bytes':'Replace records with this backup','btn-danger')}<p class="p2c-footnote">Cancel leaves your existing records unchanged. A previous copy is stored unencrypted in this browser, not uploaded.</p></section>`;
  }
  function settingsPhase1C() {
    const group=(id,kicker,title,content)=>`<section class="p1c-setting-group" id="p1c-${id}"><span class="p1c-overline">${kicker}</span><h2>${title}</h2>${content}</section>`;
    const status=(label,detail,value,permissionKey='')=>`<div class="p1c-setting-row"><div><strong>${safe(label)}</strong><small>${safe(detail)}</small></div><span ${permissionKey?`data-permission-status="${permissionKey}"`:''}>${safe(value)}</span></div>`;
    const sources=group('sources','01 · DATA SOURCES','Connections and service status',`<p>None of these remote services is currently connected to this app.</p>${status('JMA / weather / earthquakes','No current official feed or timestamps','Not connected')}${status('Train lines and timetables','No live delays, last-train lookup or confidence model','Not connected')}${status('Akatsuki / calendar','No sharing or automatic reminders','Not connected')}${status('Bluetooth / geofences','No paired tags or background position','Not connected')}${status('Local manual tools','Readiness, incident, log and Night Out','Available offline*')}`);
    const privacy=group('privacy','02 · PRIVACY','Permission and privacy controls',`<p>Addresses, contacts, optional follow-up photos and logs are kept in browser local storage <strong>without encryption</strong>. No account, cloud synchronization or background tracking is connected. Selected photos are re-encoded to small JPEGs without the original EXIF/GPS or filename, but their visible contents can still reveal identity or location.</p><div class="p2c-permission-status">${status('Browser location permission','Status only; checking does not request access',permissionState.location,'location')}${status('Notification permission','Status only; notifications are not implemented',permissionState.notification,'notification')}${status('Offline storage protection','Browser may still clear data when you clear site data',permissionState.storage,'storage')}<div class="p2c-location-result" data-permission-status="locationTest" data-permission-prefix="One-time location test: " role="status">One-time location test: ${safe(permissionState.locationTest)}</div></div><div class="p2c-privacy-actions">${action('check-browser-permissions','Check browser status','btn-outline')}${action('test-location-once','Test location once','btn-outline')}${action('request-persistent-storage','Request protected storage','btn-outline')}</div><p class="p2c-footnote">Location test may show a browser prompt; its coordinates are immediately discarded. Manual address and shelter entry always work. If you grant location access, revoke it later through your browser’s site permissions. Protected storage is best-effort and is not a substitute for exporting a backup.</p>${status('Akatsuki / calendar / Bluetooth','No integration, authorization or revocation yet','Not connected')}${status('Contacts and personal documents','Never uploaded automatically','Local only')}<div class="p1c-honesty">${icon('info')} Avoid saving identity-document photos, faces, IDs or secrets, especially on shared devices. Browser site-data clearing and device loss can remove local records.</div>`);
    const thresholds=group('thresholds','03 · THRESHOLDS','Limits and alerts',`<p>Only manual Night Out limits are active. Weather and earthquake thresholds cannot fire without verified sources.</p>${status('Night Out drinks limit',nLimitLabel(),'Manual counter')}${status('Commute alert confidence','Requires a real prediction model','Unavailable')}${status('Quake intensity threshold','Requires a verified JMA feed','Unavailable')}${action('go','Edit Night Out plan','btn-outline','data-page="night"')}`);
    const offline=group('offline','04 · OFFLINE','Offline readiness',`<p>The guide, manual records and installed app files can work offline after the service worker finishes caching. No shelter-map tiles, identity documents or live feeds are included.</p>${status('App shell',offlineReady?'Service worker ready; verify by going offline':'Cache not confirmed in this session',offlineReady?'Worker ready':'Checking')}${status('Seven-step response guide','Included directly in the application','Included')}${status('Shelter maps / documents','No data downloaded; separate future phase','Not available')}<div class="p1c-honesty">${icon('info')} *Offline availability also depends on browser storage retention. Test an offline launch before relying on it.</div>`);
    const places=settingsPlacesPhase2A(group);
    const dataGroup=group('data','06 · DATA MANAGEMENT','Backup, privacy and recovery',`<p>Backups include any saved or draft evidence photos, plus your addresses, contacts and logs. <strong>Unencrypted JSON is readable by anyone with the file.</strong> Both formats can be imported after a preview, without any network service.</p><div class="p2c-backup-controls"><div class="p2c-export-card"><strong>Standard JSON · no password</strong><small>Compatible with older app backups. Store it privately.</small>${action('export',icon('download','sm')+' Export JSON backup','btn-outline')}</div><div class="p2c-export-card"><strong>Encrypted JSON · optional</strong><small>AES-GCM encryption with a password you choose. Password is never saved or sent.</small><div class="text-field"><label for="p2c-export-password">Backup password (12–256 characters)</label><input id="p2c-export-password" type="password" autocomplete="new-password" minlength="12" maxlength="256" /></div><div class="text-field"><label for="p2c-export-confirm">Confirm password</label><input id="p2c-export-confirm" type="password" autocomplete="new-password" minlength="12" maxlength="256" /></div>${action('export-encrypted',icon('download','sm')+' Export encrypted backup','btn-primary')}<small>Keep this password safely: there is no recovery option.</small></div></div><div class="p2c-import-controls"><label class="btn btn-outline" for="import-json" style="cursor:pointer">Choose backup to preview</label><input id="import-json" type="file" accept="application/json,.json" style="display:none"/>${hasPreimportSnapshot()?`${action('preview-previous','Review previous local copy','btn-outline')}${action('download-previous','Download previous copy','btn-outline')}`:''}</div>${importPreview()}<div class="p1c-night-actions">${action('go','Review setup tour','btn-outline','data-page="onboard"')}${action('erase',icon('trash','sm')+' Erase this app’s records','btn-danger')}</div><p class="p2c-footnote">The previous-copy slot is a second, <strong>unencrypted</strong> copy in this same browser, retained until the next successful restore or erasure. It is not a remote backup. Erasing removes only this app’s record and recovery copy, not unrelated app storage.</p><div class="p2c-sync-status"><strong>Account / secure sync · design stage only</strong><p>No account, server, Akatsuki contract or automatic upload is active. Future sync needs explicit per-data-category consent, verified authentication, encryption and conflict recovery.</p><span class="p2c-unconnected">Not connected</span></div>`);
    function nLimitLabel(){return data.night.limit===0?'Alcohol-free (0)':String(data.night.limit)+' drinks';}
    return `<section class="p1c-settings">${pageHeader('SETTINGS · 設定','Clarity and control.','Review your connected sources, privacy, manual thresholds, offline status, addresses, and backups.')}
      <nav class="p1c-setting-jumps" aria-label="Jump to Settings section">${[['contacts','Contacts'],['data','Backups'],['places','Places'],['offline','Offline'],['privacy','Privacy'],['sources','Sources'],['thresholds','Limits']].map(([id,label])=>`<a href="#p1c-${id}">${label}</a>`).join('')}</nav>
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
      ${index===3?`<div class="p2c-tour-permission"><p>Optional: test whether browser location works <strong>once</strong>. No coordinates are kept. You can also type the address yourself in Settings.</p>${action('test-location-once','Test location once','btn-outline')}<span data-permission-status="locationTest" role="status">${safe(permissionState.locationTest)}</span></div>`:''}
      ${index===6?`<div class="p2c-tour-permission"><p>Check current browser status without asking for new permissions, or continue with manual features.</p>${action('check-browser-permissions','Check browser status','btn-outline')}<span data-permission-status="location" data-permission-prefix="Location: " role="status">Location: ${safe(permissionState.location)}</span>${action('go','Review privacy settings','btn-outline','data-page="settings"')}</div>`:''}
      <div class="p1a-onboard-note">${icon('info','sm')} <div><strong>Why this matters</strong><p>${index===6?'You decide what to save and share. Calendar, Bluetooth, Akatsuki and notifications are still not connected.':'The app stays manual; this step cannot activate background monitoring or send information.'}</p></div></div>
      <div class="p1a-onboard-controls">${action('tour-next',index===TOUR.length-1?'Finish setup '+icon('check','sm'):'Continue '+icon('arrow','sm'),'btn-primary btn-lg btn-full')}
        <div class="p1a-onboard-secondary">${index?action('tour-prev','← Back','btn-quiet'): '<span></span>'}${index===TOUR.length-1?'':action('tour-skip-step','Skip this step','btn-quiet')}${action('tour-skip','Exit tour','btn-quiet')}</div>
      </div>
    </section>`;
  }
  function updateScrollTopVisibility() {
    const topButton=app.querySelector('.mobile-scroll-top');
    if(topButton)topButton.hidden=window.scrollY<360;
  }
  function render() {
    const pages={watch,readiness,incident,departure,stranded,night:nightPhase1C,log:logPhase1C,settings:settingsPhase1C,reflection:reflectionPhase1C,onboard:onboarding};
    const current=pages[data.page]||watch;
    app.innerHTML=shell(current());
    updateScrollTopVisibility();
    document.title='Disaster Management · '+({watch:'Watch',readiness:'Readiness',incident:'Emergency guide',departure:'Departure check',stranded:'Stranded options',night:'Night Out',log:'Activity log',settings:'Settings',reflection:'After-action',onboard:'Setup'}[data.page]||'Watch');
  }
  function safetyMessage() {
    const state=data.incident.communication;
    const template=SMS_TEMPLATES.find(x=>x.id===state.template)||SMS_TEMPLATES[0];
    // The home, office, safe place and shelter fields are intentionally never
    // inserted here: none establishes where the user actually is right now.
    const place=state.currentLocation.trim();
    const en=template.en+(place?' Current location (entered by me): '+place+'.':'');
    const ja=template.ja+(place?' 今いる場所（自分で入力）：'+place+'。':'');
    return state.language==='en'?en:state.language==='ja'?ja:en+'\n'+ja;
  }
  function communicationEntry(contact) {
    const state=data.incident.communication;
    return state.entries[contact.id] ||= {name:contact.name,phone:contact.phone,status:'unsent',
      requestedAt:'',openedAt:'',confirmedAt:'',skipped:false};
  }
  function selectedContacts() {
    const ids=new Set(data.incident.communication.selected);
    return data.contacts.filter(contact=>ids.has(contact.id)); // Settings priority order.
  }
  function smsForIOS() {
    // Apple's published sms: URL scheme documents a recipient, not a body.
    // Use copy/paste instead of promising text prefill on these devices.
    return /iPad|iPhone|iPod/i.test(navigator.userAgent||'') ||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  }
  function openCommunicationDraft(contact) {
    const state=data.incident.communication;
    if(state.pendingId)return toast('Resolve the previous SMS draft request before opening another.');
    if(!contact)return toast('Choose a saved recipient first.');
    const phone=phoneForComposer(contact.phone);
    if(!phone)return toast('This number is invalid. Correct it in Settings before opening SMS.');
    const entry=communicationEntry(contact);
    if(entry.phone!==contact.phone)return toast('This phone number changed. Reset the recipient draft before using the new number.');
    if(entry.status==='user-confirmed-sent')return toast('You already reported tapping Send for this contact. Reset deliberately to draft again.');
    if(entry.status==='draft-opened')return toast('Resolve the opened draft or reset this contact before requesting another.');
    const template=SMS_TEMPLATES.find(t=>t.id===state.template);
    const warning=state.currentLocation.trim()?' The location text was manually entered in this guide.':'';
    if(!confirm('Open a new SMS draft to '+contact.name+' ('+phone+')? Message type: '+template.label+'. Confirm it describes your current situation. Review the recipient and text in your SMS app before tapping Send.'+warning+' This app cannot verify that a draft opens, that you tap Send, or that delivery succeeds.'))return;
    if(!state.selected.includes(contact.id))state.selected.push(contact.id);
    entry.requestedAt=new Date().toISOString();entry.skipped=false;
    state.pendingId=contact.id;data.incident.active=true;
    save();render();
    const body=safetyMessage();
    window.location.href='sms:'+phone+(smsForIOS()?'':'?body='+encodeURIComponent(body));
    return toast(smsForIOS()?'SMS app requested. On iPhone/iPad, copy and paste the preview manually.':'SMS draft requested. If the body is missing, copy and paste the preview manually.');
  }
  function addLog(title,note,kind='manual',status='recorded') {
    data.logs.unshift({date:when(),title,note:note||'',kind,status});
    data.logs=data.logs.slice(0,150);
  }
  function evidencePhotoCount() {
    return [data.evidence.draft,...data.evidence.entries].reduce((sum,e)=>sum+e.photos.length,0);
  }
  function evidencePhotoChars() {
    return [data.evidence.draft,...data.evidence.entries].reduce((sum,e)=>sum+e.photos.reduce((n,p)=>n+p.image.length,0),0);
  }
  async function reencodeEvidencePhoto(file) {
    // SVG/vector sources could fetch remote resources while decoding. Accept
    // only familiar raster formats; re-encoding never stores the original.
    if(!file||!/^image\/(?:jpeg|png|webp|avif|heic|heif|gif|bmp)$/.test(file.type)
      ||file.size>EVIDENCE_MAX_FILE_BYTES||file.size===0)
      throw new Error('Select a supported image under 8 MB. No photo was saved.');
    const url=URL.createObjectURL(file);
    try {
      const image=await new Promise((resolve,reject)=>{
        const element=new Image();
        element.onload=()=>resolve(element);
        element.onerror=()=>reject(new Error('Image cannot be read by this browser. No photo was saved.'));
        element.src=url;
      });
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>20_000_000)
        throw new Error('Photo dimensions are too large. No photo was saved.');
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Image compression is unavailable on this browser.');
      for(const edge of [960,760,600,480,320]){
        const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        for(const quality of [0.72,0.55,0.4]){
          const encoded=canvas.toDataURL('image/jpeg',quality);
          if(encoded.length<=EVIDENCE_MAX_PHOTO_CHARS && /^data:image\/jpeg;base64,/.test(encoded))
            return {image:encoded,width:canvas.width,height:canvas.height};
        }
      }
      throw new Error('Could not make this photo small enough for the offline backup. No photo was saved.');
    } finally {URL.revokeObjectURL(url);}
  }
  async function addEvidencePhotos(files) {
    if(evidenceUploadBusy)throw new Error('Wait for the earlier photo compression to finish.');
    evidenceUploadBusy=true;
    try {
    const choices=Array.from(files||[]);
    if(!choices.length)return;
    if(evidencePhotoCount()+choices.length>EVIDENCE_MAX_PHOTOS)
      throw new Error('Photo limit reached: at most six across saved records and draft. Delete an older record first.');
    if(data.evidence.nextPhotoId+choices.length>999_999_999)
      throw new Error('Photo identifiers exhausted. Export your backup before proceeding.');
    const encoded=[];
    for(const file of choices)encoded.push(await reencodeEvidencePhoto(file));
    const total=encoded.reduce((n,p)=>n+p.image.length,0);
    if(evidencePhotoChars()+total>EVIDENCE_MAX_TOTAL_CHARS)
      throw new Error('Photo storage limit reached. Remove an older photo or record first.');
    const previous=JSON.stringify(data.evidence);
    for(const photo of encoded)data.evidence.draft.photos.push({id:'p-'+data.evidence.nextPhotoId++,...photo});
    if(!save()){
      data.evidence=JSON.parse(previous);
      render();
      throw new Error('Local storage could not save the photo. The existing records are unchanged.');
    }
    render();toast(encoded.length+' compressed photo(s) saved in the private draft. No upload occurred.');
    } finally {evidenceUploadBusy=false;}
  }
  function editEvidence(action,id) {
    const before=JSON.stringify(data.evidence),oldLogs=data.logs.slice();
    const draft=data.evidence.draft;
    if(action==='evidence-save'){
      const note=draft.note.trim();
      if(!note&&!draft.photos.length)return toast('Add an observation or select a photo first.');
      if(data.evidence.entries.length>=EVIDENCE_MAX_RECORDS)return toast('The 12-record limit is reached. Export a backup before deleting a record.');
      if(data.evidence.nextId>999_999_998)return toast('Evidence record identifiers exhausted. Export your backup before proceeding.');
      data.evidence.entries.unshift({id:'e-'+data.evidence.nextId++,at:new Date().toISOString(),note,photos:draft.photos});
      data.evidence.draft={note:'',photos:[]};
      addLog('Private follow-up evidence saved',`User saved a local follow-up record (${data.evidence.entries[0].photos.length} photo(s)); contents unverified, not an official assessment or submission.`,'incident','recorded');
    }else if(action==='evidence-clear'){
      if(!draft.note&&!draft.photos.length)return;
      if(!confirm('Discard your unsent draft notes and photo(s) from this browser?'))return;
      data.evidence.draft={note:'',photos:[]};
    }else if(action==='evidence-remove-photo'){
      if(!draft.photos.some(p=>p.id===id))return;
      draft.photos=draft.photos.filter(p=>p.id!==id);
    }else if(action==='evidence-delete'){
      const found=data.evidence.entries.find(e=>e.id===id);
      if(!found)return;
      if(!confirm('Permanently delete this local evidence record, including its photos? Previously exported backups may still contain it.'))return;
      data.evidence.entries=data.evidence.entries.filter(e=>e.id!==id);
      addLog('Private evidence deleted','User removed a local follow-up record. Any previously exported backups are unchanged.','incident','recorded');
    }else return;
    if(!save()){
      data.evidence=JSON.parse(before);data.logs=oldLogs;render();
      return toast('Could not save this change. Existing records remain unchanged.');
    }
    render();toast(action==='evidence-save'?'Follow-up record saved privately; nothing was submitted.':action==='evidence-delete'?'Local evidence record removed.':'Private draft updated.');
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
  function updatePermissionDisplay() {
    for(const [key,value] of Object.entries(permissionState)){
      for(const el of app.querySelectorAll?.(`[data-permission-status="${key}"]`)||[])
        el.textContent=(el.dataset.permissionPrefix||'')+value;
    }
  }
  async function checkBrowserPermissions() {
    permissionState.location='Checking…';
    permissionState.notification=typeof Notification==='undefined'?'Unavailable (manual only)':Notification.permission;
    permissionState.storage='Checking…';
    updatePermissionDisplay();
    try {
      if(!navigator.permissions?.query)permissionState.location='Status query unavailable';
      else {
        const response=await navigator.permissions.query({name:'geolocation'});
        permissionState.location=['granted','denied','prompt'].includes(response.state)?response.state:'Unknown';
      }
    } catch {permissionState.location='Status query unsupported';}
    try {
      if(!navigator.storage?.persisted)permissionState.storage='Not supported';
      else permissionState.storage=await navigator.storage.persisted()?'Persistent storage granted':'Best-effort storage';
    } catch {permissionState.storage='Storage status unavailable';}
    updatePermissionDisplay();
  }
  function testLocationOnce() {
    if(!navigator.geolocation?.getCurrentPosition){permissionState.locationTest='Location API unavailable; use manual entries.';updatePermissionDisplay();return;}
    permissionState.locationTest='Waiting for browser response…';updatePermissionDisplay();
    try {
      // The position object is deliberately ignored: no coordinates stored,
      // rendered, logged, shared or passed to any other service.
      navigator.geolocation.getCurrentPosition(
        ()=>{permissionState.locationTest='Available now; coordinates discarded.';updatePermissionDisplay();},
        err=>{permissionState.locationTest=err?.code===1?'Denied; manual entry still works.':err?.code===3?'Timed out; manual entry still works.':'Unavailable; manual entry still works.';updatePermissionDisplay();},
        {enableHighAccuracy:false,maximumAge:0,timeout:10000}
      );
    } catch {permissionState.locationTest='Browser blocked location; use manual entries.';updatePermissionDisplay();}
  }
  function requestPersistentStorage() {
    if(!navigator.storage?.persist){permissionState.storage='Not supported';updatePermissionDisplay();return;}
    // Must be called synchronously in the user's click gesture. Permission is
    // browser-managed and is never represented as guaranteed protection.
    let result;
    try {result=navigator.storage.persist();}
    catch {permissionState.storage='Request unavailable';updatePermissionDisplay();return;}
    Promise.resolve(result).then(granted=>{
      permissionState.storage=granted?'Persistent storage granted':'Not granted (best-effort)';updatePermissionDisplay();
    }).catch(()=>{permissionState.storage='Request failed (best-effort)';updatePermissionDisplay();});
  }
  function webCrypto() {
    const c=typeof crypto==='object'?crypto:null;
    if(!c?.subtle?.deriveKey||!c.getRandomValues)throw new Error('Encrypted backups require a secure browser with Web Crypto (HTTPS or localhost).');
    return c;
  }
  function toBase64(bytes) {
    let binary='';
    for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return btoa(binary);
  }
  function fromBase64(value,maxBytes) {
    if(typeof value!=='string'||value.length>Math.ceil(maxBytes/3)*4+4||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
      throw new Error('Damaged encrypted-backup encoding.');
    const bytes=Uint8Array.from(atob(value),x=>x.charCodeAt(0));
    if(bytes.length>maxBytes)throw new Error('Encrypted backup is too large.');
    return bytes;
  }
  async function backupKey(password,salt,iterations) {
    const c=webCrypto(),encoded=new TextEncoder().encode(password);
    try {
      const material=await c.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);
      return await c.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    } finally {encoded.fill(0);}
  }
  async function exportEncryptedBackup() {
    if(recoveryRaw!==null)throw new Error('Current records are unreadable. Download the original records from the recovery banner first.');
    const first=field('p2c-export-password'),second=field('p2c-export-confirm');
    const password=first?.value||'',confirmPassword=second?.value||'';
    if(password.length<12||password.length>256)throw new Error('Choose a password between 12 and 256 characters.');
    if(password!==confirmPassword)throw new Error('Passwords do not match.');
    first.value='';second.value='';
    const c=webCrypto(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
    const key=await backupKey(password,salt,BACKUP_KDF_ITERATIONS);
    const ciphertext=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',iv,tagLength:128},key,new TextEncoder().encode(JSON.stringify(data))));
    const envelope={format:ENCRYPTED_BACKUP_FORMAT,formatVersion:ENCRYPTED_BACKUP_VERSION,schemaVersion:VERSION,
      createdAt:new Date().toISOString(),kdf:{name:'PBKDF2',hash:'SHA-256',iterations:BACKUP_KDF_ITERATIONS,salt:toBase64(salt)},
      cipher:{name:'AES-GCM',iv:toBase64(iv),tagLength:128,ciphertext:toBase64(ciphertext)}};
    downloadBackup(JSON.stringify(envelope,null,2),'disaster-management-encrypted-backup.json');
  }
  function validateEncryptedEnvelope(raw) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!==ENCRYPTED_BACKUP_FORMAT||raw.formatVersion!==ENCRYPTED_BACKUP_VERSION||raw.schemaVersion!==VERSION
      ||raw.kdf?.name!=='PBKDF2'||raw.kdf.hash!=='SHA-256'||!Number.isInteger(raw.kdf.iterations)||raw.kdf.iterations<BACKUP_KDF_ITERATIONS||raw.kdf.iterations>2000000
      ||raw.cipher?.name!=='AES-GCM'||raw.cipher.tagLength!==128)throw new Error('Unsupported encrypted backup format, schema or algorithm.');
    const salt=fromBase64(raw.kdf.salt,16),iv=fromBase64(raw.cipher.iv,12),ciphertext=fromBase64(raw.cipher.ciphertext,MAX_BACKUP_FILE_BYTES);
    if(salt.length!==16||iv.length!==12||ciphertext.length<17)throw new Error('Damaged encrypted backup.');
    return {salt,iv,ciphertext,iterations:raw.kdf.iterations};
  }
  function validateImportCapacity(record) {
    // Reject records that our v1 normalizer would silently trim. This matters
    // when restoring records created by a different or future build.
    if(record.contacts.length>100||record.logs.length>150||record.rules.length>100||
      (Array.isArray(record.readiness?.custom)&&record.readiness.custom.length>30))
      throw new Error('Backup contains more entries than this version can retain. Keep the original file and use a compatible app.');
  }
  async function unlockEncryptedImport() {
    const b=pendingImport;if(!b||b.kind!=='locked')return;
    const entry=field('p2c-unlock-password'),password=entry?.value||'';
    if(!password)throw new Error('Enter the backup password.');
    entry.value='';
    const params=validateEncryptedEnvelope(b.envelope),c=webCrypto();
    const key=await backupKey(password,params.salt,params.iterations);
    let result;
    try {result=await c.subtle.decrypt({name:'AES-GCM',iv:params.iv,tagLength:128},key,params.ciphertext);}
    catch {throw new Error('Wrong password or damaged encrypted file. Current records were not changed.');}
    let raw;
    try {raw=JSON.parse(new TextDecoder().decode(result));}
    catch {throw new Error('Decrypted contents are not a valid JSON backup.');}
    const compatible=migrateRecord(raw);
    if(!compatible)throw new Error('Decrypted backup version or record structure is unsupported. Current records were not changed.');
    validateImportCapacity(compatible);
    pendingImport={kind:'ready',record:normalize(compatible),filename:b.filename,encrypted:true,fromSnapshot:false};
    render();toast('Encrypted backup unlocked locally. Review before restoring.');
  }
  function stageImportedJson(raw,filename) {
    if(raw && typeof raw==='object' && !Array.isArray(raw) && raw.format===ENCRYPTED_BACKUP_FORMAT){
      validateEncryptedEnvelope(raw);
      pendingImport={kind:'locked',envelope:raw,filename,encrypted:true,fromSnapshot:false};
    } else {
      const compatible=migrateRecord(raw);
      if(!compatible)throw new Error('Unsupported backup version or format. The existing records remain untouched.');
      validateImportCapacity(compatible);
      pendingImport={kind:'ready',record:normalize(compatible),filename,encrypted:false,fromSnapshot:false};
    }
    // A recovery-screen import moves to a preview in Settings in memory only.
    // An incompatible KEY remains untouched and quarantined until Apply.
    data.page='settings';render();
  }
  function previewPreviousSnapshot() {
    let rawText;
    try {rawText=localStorage.getItem(PREIMPORT_KEY);}catch {return toast('Previous copy could not be read.');}
    if(rawText===null)return toast('No previous local copy is available.');
    let compatible;
    try {compatible=migrateRecord(JSON.parse(rawText));}catch {compatible=null;}
    pendingImport=compatible
      ? {kind:'ready',record:normalize(compatible),filename:'Previous local copy',encrypted:false,fromSnapshot:true,rawBytes:rawText}
      : {kind:'unreadable',filename:'Previous local copy (unreadable)',encrypted:false,fromSnapshot:true,rawBytes:rawText};
    render();
  }
  function applyStagedImport() {
    const b=pendingImport;if(!b||!['ready','unreadable'].includes(b.kind))return;
    if(!confirm('Replace this browser’s Disaster Management records with the selected backup? A local recovery copy is saved first. This cannot be automatically undone.'))return;
    let current,oldSlot;
    try {current=localStorage.getItem(KEY);oldSlot=localStorage.getItem(PREIMPORT_KEY);}
    catch {return toast('Could not access browser storage. Existing records were not changed.');}
    const replacement=b.fromSnapshot?b.rawBytes:JSON.stringify({...b.record,page:'settings'});
    try {
      if(current!==null)localStorage.setItem(PREIMPORT_KEY,current);
      else localStorage.removeItem(PREIMPORT_KEY);
    } catch {return toast('Could not save the recovery copy. Existing records were not changed.');}
    try {localStorage.setItem(KEY,replacement);}
    catch {
      // A failed setItem is atomic, so KEY remains intact. Restore the previous
      // undo slot best-effort without ever erasing the original record.
      try {if(oldSlot===null)localStorage.removeItem(PREIMPORT_KEY);else localStorage.setItem(PREIMPORT_KEY,oldSlot);}catch {/* retain available recovery bytes */}
      return toast('Browser storage rejected the backup. Existing records were not replaced.');
    }
    recoveryRaw=null;data=load();data.page='settings';pendingImport=null;render();
    toast(b.kind==='unreadable'?'Original bytes restored; app still needs a compatible version.':'Backup restored. Previous local records are available for review.');
  }
  function dispatch(name,button) {
    const id=button.dataset.id,index=Number(button.dataset.index);
    if(['evidence-save','evidence-clear','evidence-remove-photo','evidence-delete'].includes(name))return editEvidence(name,id);
    if(name==='reload-app')return window.location.reload();
    if(name==='defer-update'){
      workerUpdateReady=false;
      document.getElementById('update-notice')?.remove();return;
    }
    if(name==='go') return go(button.dataset.page);
    if(name==='scroll-top')return window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if(name==='check-browser-permissions')return checkBrowserPermissions().catch(()=>toast('Could not check browser permissions. Manual features still work.'));
    if(name==='test-location-once')return testLocationOnce();
    if(name==='request-persistent-storage')return requestPersistentStorage();
    if(name==='export-encrypted')return exportEncryptedBackup().catch(err=>toast('Encrypted export: '+err.message));
    if(name==='unlock-import')return unlockEncryptedImport().catch(err=>toast('Could not unlock: '+err.message));
    if(name==='cancel-import'){pendingImport=null;return render();}
    if(name==='preview-previous')return previewPreviousSnapshot();
    if(name==='download-previous'){
      try {const raw=localStorage.getItem(PREIMPORT_KEY);return raw===null?toast('No previous copy is available.'):downloadBackup(raw,'disaster-management-previous-local-copy.json');}
      catch {return toast('Could not read the previous copy.');}
    }
    if(name==='apply-import')return applyStagedImport();
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
    if(name==='incident-low-power'){
      data.incident.lowPower=!data.incident.lowPower;
      data.incident.active=true;return update();
    }
    if(name==='incident-step-cant'){
      data.incident.stepOutcomes[data.incident.step]='cant';
      data.incident.active=true;return update();
    }
    if(name==='incident-step-skip'){
      if(data.incident.step===1 && !confirm('If there is urgent danger, seek emergency help. Do you still want to leave this step unfinished?'))return;
      data.incident.stepOutcomes[data.incident.step]='skip';
      data.incident.active=true;
      if(data.incident.step<7)data.incident.step++;
      return update();
    }
    if(name==='incident-step-clear'){
      delete data.incident.stepOutcomes[data.incident.step];return update();
    }
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
    if(name==='communication-select'){
      const state=data.incident.communication,contact=data.contacts.find(c=>c.id===id);
      if(!contact)return;
      if(state.pendingId)return toast('First report what happened to the pending SMS draft.');
      if(state.selected.includes(id))state.selected=state.selected.filter(x=>x!==id);
      else {
        if(!phoneForComposer(contact.phone))return toast('Correct this number in Settings before selecting it.');
        state.selected.push(id);communicationEntry(contact);
      }
      data.incident.active=true;return update();
    }
    if(name==='communication-next'){
      const state=data.incident.communication;
      const next=selectedContacts().find(c=>!state.entries[c.id]||
        (state.entries[c.id].status==='unsent'&&!state.entries[c.id].skipped&&!state.entries[c.id].requestedAt));
      return next?openCommunicationDraft(next):toast('No unreviewed selected contact. Reset an entry to retry, if needed.');
    }
    if(name==='communication-confirm-open'||name==='communication-confirm-sent'||name==='communication-no-send'){
      const state=data.incident.communication,entry=state.entries[id];
      if(state.pendingId && state.pendingId!==id)return toast('Resolve the newest SMS draft request first.');
      if(!entry||!entry.requestedAt||!(state.pendingId===id||(!state.pendingId&&entry.status==='draft-opened')))return;
      if(name==='communication-confirm-sent'){
        if(!confirm('Did you personally tap Send for '+entry.name+' ('+entry.phone+') in your SMS app? This records ONLY your report; actual delivery remains UNKNOWN.'))return;
        entry.status='user-confirmed-sent';entry.confirmedAt=new Date().toISOString();entry.openedAt ||= entry.confirmedAt;
        addLog('SMS send reported by user','You reported tapping Send to '+entry.name+'. Delivery and receipt remain unknown. No message was sent by this app.','incident','recorded');
      }else if(name==='communication-confirm-open'){
        entry.status='draft-opened';entry.openedAt=new Date().toISOString();
      }else {
        entry.status='unsent';entry.skipped=true;
      }
      if(state.pendingId===id)state.pendingId='';
      return update();
    }
    if(name==='communication-reset'){
      const state=data.incident.communication,contact=data.contacts.find(c=>c.id===id);
      if(!contact||state.pendingId)return toast('Resolve the pending SMS draft before starting a new one.');
      if(!confirm('Start a new UNSENT draft for '+contact.name+'? This resets the visible attempt for this contact, but does not erase earlier activity-log reports.'))return;
      delete state.entries[id];communicationEntry(contact);return update();
    }
    if(name==='copy-message') {
      const message=safetyMessage();
      if(navigator.clipboard?.writeText) navigator.clipboard.writeText(message).then(()=>toast('Message copied. Review before sharing.')).catch(()=>toast('Copy not available. Select the message text manually.'));
      else toast('Copy not available in this browser.');
      return;
    }
    if(name==='sms-contact')return openCommunicationDraft(data.contacts[index]);
    if(name==='finish-incident'){
      const incident=data.incident;
      if(incident.communication.pendingId && !confirm('An SMS draft request has an unreported outcome. End this guide and clear the active draft? The app cannot tell if it was sent.'))return;
      const done=Object.values(incident.done).reduce((n,entries)=>n+entries.length,0);
      const outcomes=Object.values(incident.outcomes).flatMap(entries=>Object.values(entries));
      const cant=outcomes.filter(v=>v==='cant').length,skipped=outcomes.filter(v=>v==='skip').length;
      const stepGaps=Object.values(incident.stepOutcomes||{});
      const messages=Object.values(incident.communication.entries);
      const sendReports=messages.filter(e=>e.status==='user-confirmed-sent').length;
      const opened=messages.filter(e=>e.status==='draft-opened').length;
      const note=(field('incident-note')?.value || incident.note || '').trim();
      addLog('Incident guide reviewed',`Manual guide review only; ${done} items marked done, ${cant} can’t do, ${skipped} skipped; ${stepGaps.filter(v=>v==='cant').length} whole steps could not be done and ${stepGaps.filter(v=>v==='skip').length} whole steps were skipped. ${sendReports} SMS Send actions reported by user (delivery unknown), ${opened} drafts reported opened (not confirmed sent). Unfinished items are not complete; skipped steps are also unconfirmed.${note?' Note: '+note:''}`,'incident','reviewed');
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
        next.id=data.contacts[contactEditIndex].id;
        data.contacts[contactEditIndex]=next;
      }else{
        if(data.contacts.length>=100)return toast('Maximum number of local contacts reached.');
        next.id='c-'+data.nextContactId++;
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
      if(data.incident.communication.pendingId===c.id)return toast('Resolve the pending SMS draft request in the Incident guide before removing this contact.');
      if(!confirm('Remove '+c.name+' from this device? This also clears its reached mark in the active guide.'))return;
      const state=data.incident.communication;
      state.selected=state.selected.filter(x=>x!==c.id);
      if(state.pendingId===c.id)state.pendingId='';
      delete state.entries[c.id]; // Earlier user-reported Send actions remain in the activity log.
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
        : 'Erase all Disaster Management records AND the local recovery copy on this browser? This cannot be undone without an external backup.';
      if(!confirm(warning))return;
      // Only these two app-owned keys are in scope. Never clear same-origin
      // storage globally: other Celeritas7 apps may live on this origin.
      try {localStorage.removeItem(PREIMPORT_KEY);localStorage.removeItem(KEY);}
      catch {return toast('Could not complete erasure. Review browser site storage if needed.');}
      pendingImport=null;recoveryRaw=null;data=defaults();update();return toast('App records and local recovery copy erased.');
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
    if(event.target.id==='p3c-evidence-note'){
      const previous=data.evidence.draft.note;
      data.evidence.draft.note=String(event.target.value||'').slice(0,1200);
      if(!save())data.evidence.draft.note=previous;
      const button=app.querySelector('[data-action="evidence-save"]');
      if(button)button.disabled=!data.evidence.draft.note.trim()&&!data.evidence.draft.photos.length;
      const clear=app.querySelector('[data-action="evidence-clear"]');
      if(clear)clear.disabled=!data.evidence.draft.note.trim()&&!data.evidence.draft.photos.length;
      return;
    }
    if(event.target.id==='sms-current-location'){
      data.incident.communication.currentLocation=String(event.target.value||'').slice(0,120);
      save();
      const preview=field('p3b-message-preview');if(preview)preview.textContent=safetyMessage();
      return;
    }
    const key=({'home-address':'home','office-address':'office','safe-place':'safePlace',
      'preferred-station':'station','shelter-name':'shelter','shelter-source':'shelter'})[event.target.id];
    if(!key)return;
    const box=field('place-verify-'+key);
    if(box)box.checked=false; // Edits must never retain a stale accuracy claim.
    const status=app.querySelector('[data-place-status="'+key+'"]');
    if(status)status.textContent='Edited · check again before saving';
  });
  document.addEventListener('change',async event=>{
    if(event.target.id==='p3c-photo-file'){
      const files=Array.from(event.target.files||[]);
      event.target.value='';
      try {await addEvidencePhotos(files);}
      catch(err){toast('Photo not saved: '+err.message);}
      return;
    }
    if(event.target.dataset?.communicationTemplate && event.target.matches?.('[data-communication-template]')){
      const value=event.target.dataset.communicationTemplate;
      if(SMS_TEMPLATES.some(t=>t.id===value)){data.incident.communication.template=value;update();}
      return;
    }
    if(event.target.dataset?.communicationLanguage && event.target.matches?.('[data-communication-language]')){
      const value=event.target.dataset.communicationLanguage;
      if(SMS_LANGUAGES.includes(value)){data.incident.communication.language=value;update();}
      return;
    }
    if(event.target.matches?.('[data-contact-role]')){
      const index=Number(event.target.dataset.contactRole),role=event.target.value;
      if(data.contacts[index]&&CONTACT_ROLES.includes(role)){
        data.contacts[index].role=role;update();toast('Contact role saved locally.');
      }
      return;
    }
    if(event.target.id==='import-json'||event.target.id==='import-recovery-json'){
      const file=event.target.files?.[0];if(!file)return;
      // A new selection invalidates the old preview, even when the new file
      // is damaged. Never leave an old "Apply" action pointing at stale data.
      pendingImport=null;
      try {
        if(file.size>MAX_BACKUP_FILE_BYTES)throw new Error('Backup must be smaller than 2 MB.');
        const raw=JSON.parse(await file.text());
        stageImportedJson(raw,(file.name||'Selected JSON backup').slice(0,120));
      } catch(err){render();toast('Could not import: '+err.message);} finally {event.target.value='';}
      return;
    }
    if(event.target.id==='incident-note'){data.incident.note=event.target.value.slice(0,700);save();}
  });
  window.addEventListener('online',()=>{netOnline=true;render();});
  window.addEventListener('offline',()=>{netOnline=false;render();});
  window.addEventListener('scroll',updateScrollTopVisibility,{passive:true});
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
