/* SoFlo Scene — free & paid things to do in South Florida. Plain JS, no dependencies. */
(function(){
'use strict';
const D=window.SOFLO||{curated:[],feed:[],library:[],generated:'',status:[]};
const TZ='America/New_York';
const fmt=o=>new Intl.DateTimeFormat('en-US',Object.assign({timeZone:TZ},o));
const fD=fmt({weekday:'short',month:'short',day:'numeric'}),fL=fmt({weekday:'long',month:'long',day:'numeric'}),fT=fmt({hour:'numeric',minute:'2-digit'}),fK=new Intl.DateTimeFormat('en-CA',{timeZone:TZ}),fH=fmt({hour:'numeric',hour12:false});
const key=d=>fK.format(d);
const off=ds=>(ds>='2026-03-08'&&ds<'2026-11-01')||(ds>='2027-03-14'&&ds<'2027-11-07')?'-04:00':'-05:00';
const mk=(ds,t)=>new Date(`${ds}T${t||'00:00'}:00${off(ds)}`);
const add=(ds,n)=>{const d=new Date(ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dow=ds=>new Date(ds+'T12:00:00Z').getUTCDay();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);

/* ---------- categories ---------- */
const CATS=[['Music','🎵'],['Arts & Culture','🎨'],['Festivals & Fairs','🎪'],['Markets','🛍️'],['Outdoors & Nature','🌴'],['Food & Drink','🍽️'],['Sports & Fitness','🏟️'],['Film','🎬'],['Comedy & Theater','🎭'],['Community','🤝'],['Nightlife','🌙']];
const EMO=Object.fromEntries(CATS);
const COUNTIES=['Miami-Dade','Broward','Palm Beach'];

/* ---------- places ---------- */
const CITY={};`Miami:25.7617,-80.1918,Miami-Dade;Miami Beach:25.7907,-80.13,Miami-Dade;Coral Gables:25.7215,-80.2684,Miami-Dade;Coconut Grove:25.7280,-80.2430,Miami-Dade;Wynwood:25.8014,-80.1995,Miami-Dade;Little Havana:25.7655,-80.2190,Miami-Dade;Doral:25.8195,-80.3553,Miami-Dade;Hialeah:25.8576,-80.2781,Miami-Dade;Homestead:25.4687,-80.4776,Miami-Dade;Aventura:25.9565,-80.1392,Miami-Dade;North Miami:25.8901,-80.1867,Miami-Dade;North Miami Beach:25.9331,-80.1625,Miami-Dade;Sunny Isles Beach:25.9507,-80.1226,Miami-Dade;Pinecrest:25.667,-80.3081,Miami-Dade;Kendall:25.6793,-80.3173,Miami-Dade;Key Biscayne:25.6937,-80.1628,Miami-Dade;Miami Lakes:25.9087,-80.3087,Miami-Dade;Miami Gardens:25.9420,-80.2456,Miami-Dade;Cutler Bay:25.5808,-80.3468,Miami-Dade;Palmetto Bay:25.6215,-80.3248,Miami-Dade;South Miami:25.7076,-80.2934,Miami-Dade;Fort Lauderdale:26.1224,-80.1373,Broward;Hollywood:26.0112,-80.1495,Broward;Pembroke Pines:26.0078,-80.2963,Broward;Miramar:25.986,-80.3035,Broward;Davie:26.0765,-80.2521,Broward;Weston:26.1004,-80.3998,Broward;Plantation:26.1276,-80.2331,Broward;Sunrise:26.167,-80.2564,Broward;Coral Springs:26.2712,-80.2706,Broward;Parkland:26.3101,-80.2373,Broward;Pompano Beach:26.2379,-80.1248,Broward;Deerfield Beach:26.3184,-80.0998,Broward;Dania Beach:26.0523,-80.1439,Broward;Hallandale Beach:25.9812,-80.1484,Broward;Lauderhill:26.1404,-80.2134,Broward;Lauderdale Lakes:26.1665,-80.2084,Broward;Tamarac:26.2129,-80.2498,Broward;Margate:26.2445,-80.2064,Broward;Coconut Creek:26.2517,-80.1789,Broward;Wilton Manors:26.1604,-80.1389,Broward;Oakland Park:26.1723,-80.132,Broward;Cooper City:26.0573,-80.2717,Broward;West Palm Beach:26.7153,-80.0534,Palm Beach;Palm Beach:26.7056,-80.0364,Palm Beach;Boca Raton:26.3683,-80.1289,Palm Beach;Delray Beach:26.4615,-80.0728,Palm Beach;Boynton Beach:26.5318,-80.0905,Palm Beach;Lake Worth Beach:26.6168,-80.072,Palm Beach;Palm Beach Gardens:26.8234,-80.1387,Palm Beach;Jupiter:26.9342,-80.0942,Palm Beach;Wellington:26.6618,-80.2684,Palm Beach;Royal Palm Beach:26.7084,-80.2306,Palm Beach;Greenacres:26.6276,-80.1353,Palm Beach;Lantana:26.5867,-80.0517,Palm Beach;Belle Glade:26.6845,-80.6676,Palm Beach;Riviera Beach:26.7753,-80.0581,Palm Beach;Loxahatchee:26.6837,-80.2798,Palm Beach`.split(';').forEach(x=>{const[n,r]=x.split(':');const[a,b,c]=r.split(',');CITY[n]=[+a,+b,c]});
const ZIP={};`33101:25.78,-80.19;33109:25.76,-80.14;33122:25.80,-80.32;33125:25.78,-80.23;33126:25.78,-80.3;33127:25.81,-80.2;33128:25.78,-80.2;33129:25.75,-80.2;33130:25.77,-80.2;33131:25.76,-80.19;33132:25.79,-80.18;33133:25.73,-80.24;33134:25.75,-80.27;33135:25.77,-80.24;33136:25.79,-80.2;33137:25.82,-80.18;33138:25.85,-80.18;33139:25.78,-80.14;33140:25.81,-80.13;33141:25.85,-80.14;33142:25.81,-80.24;33143:25.7,-80.3;33144:25.76,-80.31;33145:25.75,-80.23;33146:25.72,-80.28;33147:25.85,-80.24;33149:25.69,-80.16;33150:25.85,-80.21;33154:25.88,-80.13;33155:25.74,-80.31;33156:25.67,-80.3;33157:25.61,-80.35;33158:25.64,-80.32;33160:25.95,-80.13;33161:25.89,-80.17;33162:25.93,-80.18;33165:25.73,-80.36;33166:25.82,-80.32;33167:25.88,-80.23;33168:25.89,-80.21;33169:25.94,-80.21;33170:25.56,-80.45;33172:25.78,-80.37;33173:25.70,-80.36;33174:25.76,-80.36;33175:25.73,-80.41;33176:25.66,-80.36;33177:25.6,-80.4;33178:25.82,-80.35;33179:25.96,-80.2;33180:25.96,-80.14;33181:25.89,-80.16;33183:25.7,-80.41;33184:25.76,-80.4;33185:25.72,-80.45;33186:25.65,-80.4;33187:25.6,-80.5;33189:25.57,-80.34;33190:25.56,-80.35;33193:25.7,-80.44;33196:25.66,-80.44;33010:25.83,-80.28;33012:25.87,-80.3;33013:25.86,-80.27;33014:25.9,-80.31;33015:25.94,-80.31;33016:25.89,-80.33;33018:25.91,-80.36;33030:25.47,-80.46;33031:25.53,-80.5;33032:25.53,-80.39;33033:25.48,-80.42;33034:25.43,-80.5;33035:25.46,-80.44;33054:25.91,-80.26;33055:25.94,-80.27;33056:25.95,-80.24;33009:25.98,-80.15;33019:26.02,-80.12;33020:26.02,-80.15;33021:26.03,-80.18;33023:25.99,-80.22;33024:26.03,-80.24;33025:25.98,-80.24;33026:26.01,-80.28;33027:25.99,-80.34;33028:26.03,-80.33;33029:25.99,-80.38;33004:26.05,-80.15;33060:26.23,-80.12;33062:26.25,-80.09;33063:26.24,-80.2;33064:26.28,-80.11;33065:26.25,-80.26;33066:26.25,-80.18;33067:26.31,-80.23;33068:26.22,-80.21;33069:26.23,-80.16;33071:26.27,-80.25;33073:26.27,-80.17;33076:26.31,-80.27;33301:26.12,-80.12;33304:26.14,-80.12;33305:26.16,-80.14;33306:26.17,-80.11;33308:26.19,-80.1;33309:26.18,-80.17;33311:26.14,-80.17;33312:26.09,-80.17;33313:26.15,-80.21;33314:26.07,-80.22;33315:26.09,-80.17;33316:26.1,-80.13;33317:26.11,-80.22;33319:26.18,-80.22;33321:26.21,-80.27;33322:26.14,-80.26;33323:26.15,-80.32;33324:26.12,-80.26;33325:26.1,-80.28;33326:26.12,-80.36;33327:26.11,-80.41;33328:26.09,-80.26;33330:26.06,-80.33;33331:26.07,-80.39;33332:26.05,-80.4;33334:26.18,-80.13;33351:26.18,-80.28;33441:26.31,-80.1;33442:26.31,-80.14;33401:26.71,-80.06;33403:26.8,-80.07;33404:26.78,-80.06;33405:26.67,-80.05;33406:26.66,-80.09;33407:26.74,-80.07;33408:26.84,-80.06;33409:26.71,-80.09;33410:26.84,-80.14;33411:26.71,-80.23;33412:26.8,-80.24;33413:26.66,-80.12;33414:26.64,-80.25;33415:26.65,-80.15;33418:26.86,-80.17;33426:26.53,-80.07;33428:26.35,-80.21;33430:26.68,-80.67;33431:26.37,-80.1;33432:26.35,-80.08;33433:26.34,-80.16;33434:26.38,-80.17;33435:26.53,-80.07;33436:26.52,-80.14;33437:26.51,-80.15;33444:26.46,-80.08;33445:26.46,-80.11;33446:26.45,-80.19;33449:26.58,-80.26;33458:26.92,-80.1;33460:26.62,-80.06;33461:26.62,-80.09;33462:26.58,-80.07;33463:26.6,-80.13;33467:26.6,-80.18;33469:26.98,-80.11;33470:26.74,-80.29;33472:26.54,-80.18;33473:26.5,-80.19;33477:26.92,-80.08;33478:26.93,-80.21;33480:26.7,-80.04;33483:26.45,-80.07;33484:26.45,-80.12;33486:26.35,-80.11;33487:26.41,-80.09;33496:26.4,-80.16;33498:26.39,-80.22`.split(';').forEach(x=>{const[z,l]=x.split(':');ZIP[z]=l.split(',').map(Number)});

`Brickell:25.7590,-80.1937,Miami-Dade;Downtown Miami:25.7743,-80.1937,Miami-Dade;Little Haiti:25.8300,-80.1950,Miami-Dade;Design District:25.8130,-80.1930,Miami-Dade;Bal Harbour:25.8918,-80.1270,Miami-Dade;Surfside:25.8784,-80.1256,Miami-Dade;Opa-locka:25.9023,-80.2503,Miami-Dade;Sweetwater:25.7634,-80.3731,Miami-Dade;Florida City:25.4479,-80.4792,Miami-Dade;Westchester:25.7548,-80.3270,Miami-Dade;North Bay Village:25.8462,-80.1540,Miami-Dade;Lighthouse Point:26.2756,-80.0873,Broward;Lauderdale-by-the-Sea:26.1920,-80.0965,Broward;Southwest Ranches:26.0587,-80.3373,Broward;North Lauderdale:26.2173,-80.2259,Broward;Pembroke Park:25.9876,-80.1748,Broward;Highland Beach:26.3995,-80.0656,Palm Beach;Juno Beach:26.8798,-80.0534,Palm Beach;Tequesta:26.9709,-80.1281,Palm Beach;North Palm Beach:26.8173,-80.0820,Palm Beach;Palm Springs:26.6359,-80.0962,Palm Beach;Lake Park:26.8000,-80.0664,Palm Beach;Westlake:26.7470,-80.3010,Palm Beach;Lake Clarke Shores:26.6448,-80.0745,Palm Beach;Ocean Ridge:26.5270,-80.0484,Palm Beach;Manalapan:26.5684,-80.0442,Palm Beach;South Palm Beach:26.5895,-80.0389,Palm Beach;Hypoluxo:26.5662,-80.0534,Palm Beach;Pahokee:26.8201,-80.6653,Palm Beach;Stuart:27.1975,-80.2528,Martin`.split(';').forEach(x=>{const[n,r]=x.split(':');const[a,b,c]=r.split(',');CITY[n]=[+a,+b,c]});
const ALIAS={'ft lauderdale':'Fort Lauderdale','ft laud':'Fort Lauderdale','fort laud':'Fort Lauderdale','ftl':'Fort Lauderdale','las olas':'Fort Lauderdale','fll':'Fort Lauderdale','boca':'Boca Raton','wpb':'West Palm Beach','west palm':'West Palm Beach','south beach':'Miami Beach','sobe':'Miami Beach','delray':'Delray Beach','boynton':'Boynton Beach','lake worth':'Lake Worth Beach','hallandale':'Hallandale Beach','pompano':'Pompano Beach','deerfield':'Deerfield Beach','dania':'Dania Beach','sunny isles':'Sunny Isles Beach','pembroke':'Pembroke Pines','pines':'Pembroke Pines','palm beach gardens':'Palm Beach Gardens','pbg':'Palm Beach Gardens','royal palm':'Royal Palm Beach','gables':'Coral Gables','the grove':'Coconut Grove','north miami beach':'North Miami Beach','nmb':'North Miami Beach','downtown':'Downtown Miami','midtown':'Wynwood','edgewater':'Wynwood','key biscayne':'Key Biscayne','kendall':'Kendall','miami lakes':'Miami Lakes','hialeah gardens':'Hialeah','wilton':'Wilton Manors','coconut creek':'Coconut Creek','jupiter':'Jupiter','tamarac':'Tamarac'};
const PLACE={};Object.keys(CITY).forEach(c=>PLACE[c.toLowerCase()]=c);Object.entries(ALIAS).forEach(([a,c])=>PLACE[a]=c);
const normP=t=>String(t||'').toLowerCase().replace(/[.,]/g,' ').replace(/\b(fl|florida|usa)\b/g,' ').replace(/\s+/g,' ').trim();
/* returns [lat,lng,label] or null */
function resolvePlace(t){const raw=String(t||'').trim();if(!raw)return null;const z=raw.match(/\b(\d{5})(?:-\d{4})?\b/);if(z){const c=ZIP[z[1]];return c?[c[0],c[1],'ZIP '+z[1]]:null}
 const k=normP(raw);if(!k)return null;let n=PLACE[k];
 if(!n&&k.length>=3){const ks=Object.keys(PLACE).sort((a,b)=>a.length-b.length);n=PLACE[ks.find(x=>x.startsWith(k))]||PLACE[ks.find(x=>k.includes(x)&&x.length>=4)]}
 return n&&CITY[n]?[CITY[n][0],CITY[n][1],n]:null}

/* ---------- events -> occurrences ---------- */
let OCC=[],EV={};
const NON_EVENT = /\bFLOW\)|licens(e|ing)\s+on\s+wheels|\b(dmv|driver'?s?\s+licen[cs]e)\b|property\s+appraiser|tax\s+collector|\bTConnect\b|property\s+tax\s+info|congressional\s+district\s+mobile\s+office|mobile\s+office\b|information\s+session\b|contract\s+signing|advisory\s+(committee|board)|quarter(ly)?\s+meeting|food\s+(and\s+nutrition\s+)?distribution|meal\s+kits|bike\s+valet|\bpassport\b|\bnotary\b|tax\s+prep|\bjob\s+fair\b|\bhiring\b|\b(closed|closure|cancel+ed|postponed)\b|office\s+hours|staff\s+meeting|\btest\s+event\b|t-?connect\b|press\s+conference|homebound|e-?waste|shred(ding)?\s+(event|day)|(turkey|thanksgiving|food|toy|grocery)\s+giveaway|giveaway\s+drive|mobile\s+market|(commission|council|board|town\s+hall)\s+meeting|public\s+hearing|flu\s+shots?|vaccin(e|ation)\s+clinic/i; // non-events (services/admin), mirrors pipeline/common.py NON_EVENT
const KIDS = /\bstory\s*-?\s*times?\b|\bstory\s*book\b|\bstor(y|ies)\s+(and|&|n)\s+crafts?\b|\bchildren'?s\s+stories\b|\bbab(y|ies)\b|\btoddlers?\b|\bpre-?school(ers?)?\b|\bpre-?k\b|\blap\s*-?sit\b|\brhyme\s*time\b|\bwiggles?\b|\bplay\s*-?groups?\b|\bmusic\s*(&|and)\s*movement\b|\btots?\b|\bmommy\s*(&|and|n'?)\s*me\b|\b(daddy|parent|caregiver|grownup)\s*(&|and)\s*me\b|\bhomework\b|\bpuppets?\b|\blego\b|\bstea?m\s+(day|lab|spot|saturday|club|camp)\b|\btweens?\b|\bteenie\b|\bmini\s+picassos?\b|\blittle\s+(ones?|monsters?|learners?|explorers?|readers?|artists?|scientists?|chefs?|makers?)\b|\bmonster\s+makers?\b|\bjunior\s+(rangers?|environmental|chefs?|scientists?)\b|\bhandprint\b|\bslime\b|(?<!adult\s)\bcoloring\b|\bmarci\s+poppins?\b|\btalking\s+is\s+teaching\b|\bready,?\s*set,?\s*go\b|\bsigning\s+stories\b|\bharmony\s+hugs\b|\bpopcorn\s+pals\b|\bfairy\s*tale\s+characters?\b|\bnot[-\s](so|too)[-\s]spooky\b|\bfamily\s+(movie|film|fun\s+film|coloring|gardening|craft|game)s?\b|\bmagic\s+school\s+bus\b|\btrunk[-\s]or[-\s]treat\b|\btrick[-\s]or[-\s]treat(?!\s+for\s+teens)|\bbreakfast\s+with\s+santa\b|\bbricks,?\s+bots\b|\bimagination\s+exploration\b|\bpaint-?ology\b|\bscience\s+explorium\b|\b(thanksgiving|halloween|turkey|pumpkin|fall|pizza\s+day|holiday)\s+craft\b|\bcraft\s*time\b|\bcrafternoons?\b|\bpumpkin\s+patty|\baesop\b|\bgrades?\s*(k|pre-?k|[1-5])\b|\bages?\s*[0-9](?![0-9])/i; // young-kids programs (Caz 2026-10-27: no storytimes / little-kid things); mirrors pipeline/common.py KIDS
const KIDWORD = /\bkids?\b|\bkid'?s\b|\bchild(ren)?(['’]?s)?\b/i, KIDKEEP = /\bvs\.?\s|\bfestival\b|\bfair\b|\bparade\b|\bconcert\b|\bsymphony\b/i;
const isKid = (t) => { t = String(t || ""); return KIDS.test(t) || (KIDWORD.test(t) && !KIDKEEP.test(t)); };
function build(curated,library){
  const out=[],ev={};const nw=Date.now()-3*864e5;
  for(const e of curated){
    const id='c'+e.id;const E={...e,id,featured:true,kind:'curated'};ev[id]=E;
    for(const d of (e.dates||[])){out.push({e:E,day:d,st:mk(d,e.start||'00:00'),en:e.end?mk(d,e.end):null,allDay:!e.start})}
  }
  for(const e of (D.feed||[])){
    const id='f'+e.id;const E={...e,id,kind:'feed',isNew:!!(e.first_seen&&Date.parse(e.first_seen)>nw)};ev[id]=E;
    for(const d of (e.dates||[])){out.push({e:E,day:d,st:mk(d,e.start||'00:00'),en:e.end?mk(d,e.end):null,allDay:!e.start})}
  }
  for(const x of library){
    const E={...x,kind:'library'};ev[E.id]=E;const d=String(x.start).slice(0,10);
    out.push({e:E,day:d,st:mk(d,String(x.start).slice(11,16)),en:x.end?mk(String(x.end).slice(0,10),String(x.end).slice(11,16)):null});
  }
  // series siblings for library events
  const ser={};for(const o of out){if(o.e.series){(ser[o.e.series]=ser[o.e.series]||[]).push(o)}}
  for(const k in ser){ser[k].sort((a,b)=>a.st-b.st)}
  for(const o of out){o.sib=o.e.series?ser[o.e.series]:null}
  OCC=out.filter(o=>!isNaN(o.st));EV=ev;
}
[D.feed,D.curated,D.library].forEach(a=>(a||[]).forEach(x=>{if(x&&x.category==='Family & Kids')x.category='Community'}));
D.feed=(D.feed||[]).filter(x=>!NON_EVENT.test(x.title||'')&&!isKid(x.title));
build((D.curated||[]).filter(x=>!NON_EVENT.test(x.title||'')&&!isKid(x.title)),(D.library||[]).filter(x=>!NON_EVENT.test(x.title||'')&&!isKid(x.title)));

/* ---------- state ---------- */
const DEF={tab:'home',q:'',date:'any',cd:'',cats:[],co:'',rad:0,tod:[],price:'all',max:0,lib:1,sort:'rec',loc:null,saved:[],ints:[],days:[],hide:0,wh:'tonight',wr:15,wm:[],wp:'all',theme:''};
let S={...DEF};
try{Object.assign(S,JSON.parse(localStorage.getItem('soflo1')||'{}'))}catch(e){}
S.tab=S.tab||'home';
const PERSIST=['loc','saved','ints','days','hide','rad','price','lib','theme','max','near','sort'];
if(!S.loc||typeof S.loc.lat!=='number')S.loc=null;if(!S.loc){S.near=false;if(S.sort==='near')S.sort='rec'}
const save=()=>{try{const o={};PERSIST.forEach(k=>o[k]=S[k]);localStorage.setItem('soflo1',JSON.stringify(o))}catch(e){}};
const NOW=()=>new Date();
const hav=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 7917.5*Math.asin(Math.sqrt(x))};
const ll=e=>e.lat!=null&&e.lng!=null?[e.lat,e.lng]:null;
function range(k,now=NOW()){const t=key(now),w=dow(t);const fri=w>=1&&w<=4?add(t,5-w):add(t,-((w+2)%7));
 const wk=n=>{let s=mk(add(fri,7*n),'17:00');if(n===0&&now>s)s=now;return[s,mk(add(fri,7*n+3),'00:00')]};
 switch(k){case'today':return[now,mk(add(t,1),'00:00')];case'tonight':{const s=mk(t,'17:00');return[now>s?now:s,mk(add(t,1),'04:00')]}case'tomorrow':return[mk(add(t,1),'00:00'),mk(add(t,2),'00:00')];case'weekend':return wk(0);case'nextweekend':return wk(1);
 case'week':return[now,mk(add(t,7),'00:00')];case'month':return[now,mk(add(t,31),'00:00')];
 case'custom':return S.cd?[mk(S.cd,'00:00'),mk(add(S.cd,1),'00:00')]:null;default:return null}}
const isFam=e=>e.category==='Family & Kids'||(e.tags||[]).includes('family');
const isPaid=e=>!e.free&&(e.price_min!=null||e.price_text==='See tickets'||/\$\d/.test(e.price_text||''));
function priceOk(e,f){const p=f.price||'all';if(p==='free'&&!e.free)return false;if(p==='paid'&&!isPaid(e))return false;if(f.max&&!e.free&&(e.price_min==null||e.price_min>f.max))return false;return true}
function query(f){const now=NOW(),rg=f.date&&f.date!=='any'?range(f.date,now):null;const q=(f.q||'').toLowerCase().trim();const words=q?q.split(/\s+/):[];
 let L=OCC.filter(o=>{const e=o.e,end=o.en||new Date(o.st.getTime()+2*3600e3);if(end<now)return false;
  if(rg&&!(o.st<rg[1]&&end>rg[0]))return false;
  if(!f.lib&&e.kind==='library')return false;
  if(!priceOk(e,f))return false;
  if(f.cats&&f.cats.length&&!f.cats.some(c=>c===e.category||c==='Family & Kids'/*retired chip: a saved selection is a no-op*/))return false;
  if(f.co&&e.county!==f.co)return false;
  /*place filtering is by distance*/
  if(f.tod&&f.tod.length){const h=+fH.format(o.st)%24,b=h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<21?'evening':'night';if(!f.tod.includes(b))return false}
  if(words.length){const hay=`${e.title} ${e.venue||''} ${e.city||''} ${e.address||''} ${e.desc||''} ${e.category} ${(e.tags||[]).join(' ')} ${e.price_text||''}`.toLowerCase();if(!words.every(w=>hay.includes(w)))return false}
  return true});
 const c=f.center||S.loc;L.forEach(o=>{const p=ll(o.e);o.d=c&&p?hav(c.lat,c.lng,p[0],p[1]):null});
 if(f.rad&&c)L=L.filter(o=>o.d!=null&&o.d<=f.rad);
 const DN=['SUN','MON','TUE','WED','THU','FRI','SAT'];
 const sc=o=>{let s=0;const e=o.e;if(e.featured)s+=18;if(S.ints.includes(e.category))s+=22;s+=o.d==null?6:Math.max(0,22-o.d);s+=Math.max(0,24-(o.st-now)/864e5*2);if(S.days.includes(DN[dow(o.day)]))s+=5;return s};
 const so=f.sort||'rec';
 L.sort((a,b)=>so==='soon'?a.st-b.st:so==='near'?(a.d??1e9)-(b.d??1e9):so==='cheap'?((a.e.free?0:(a.e.price_min??999))-(b.e.free?0:(b.e.price_min??999)))||a.st-b.st:sc(b)-sc(a)||a.st-b.st);
 if(so!=='soon'&&!f.all)L=firstPer(L);
 return L}
const firstPer=L=>{const seen=new Set();return L.filter(o=>{const k=o.e.series||o.e.id;if(seen.has(k))return false;seen.add(k);return true})};
function parseQ(t){const l=' '+t.toLowerCase()+' ';const r={date:'',cats:[],city:'',zip:'',rad:0,near:false,price:'',max:0};let s=l;
 const DT=[['next weekend','nextweekend'],['this weekend','weekend'],['weekend','weekend'],['tonight','tonight'],['tomorrow','tomorrow'],['today','today'],['this week','week'],['this month','month']];
 for(const[w,k]of DT)if(s.includes(w)){r.date=k;s=s.replace(w,' ');break}
 const mx=s.match(/under \$?(\d{1,4})|less than \$?(\d{1,4})|\$(\d{1,4}) or less/);if(mx){r.max=+(mx[1]||mx[2]||mx[3]);r.price='paidmax';s=s.replace(mx[0],' ')}
 if(/\bfree\b/.test(s)){r.price='free';s=s.replace(/\bfree\b/,' ')}else if(/\b(paid|ticketed|tickets?)\b/.test(s)){r.price=r.price||'paid';s=s.replace(/\b(paid|ticketed|tickets?)\b/,' ')}
 const z=s.match(/\b3[34]\d{3}\b/);if(z){r.zip=z[0];s=s.replace(z[0],' ')}
 const m=s.match(/(\d{1,2})\s*(miles?|mi)\b/);if(m){r.rad=+m[1];s=s.replace(m[0],' ')}
 if(/near me|nearby|around me|close by/.test(s)){r.near=true;s=s.replace(/near me|nearby|around me|close by/,' ')}
 s=s.replace(/[,!?]/g,' ');for(const alias of Object.keys(PLACE).sort((a,b)=>b.length-a.length))if(alias.length>=4&&s.includes(' '+alias+' ')){r.city=PLACE[alias];s=s.replace(' '+alias+' ',' ');break}
 for(const c of COUNTIES)if(s.includes(c.toLowerCase())){r.co=c;s=s.replace(c.toLowerCase(),' ')}
 const K={'Music':/concerts?|live music|music|jazz|bands?|dj\b/,'Markets':/markets?|farmers/,'Festivals & Fairs':/festivals?|fests?\b|fairs?\b/,'Food & Drink':/\bfood\b|tasting|brunch|wine|beer/,'Arts & Culture':/\bart\b|arts|gallery|museums?/,'Sports & Fitness':/yoga|fitness|workout|run\b|5k|sports?|game\b/,'Outdoors & Nature':/outdoors?|parks?|beach|nature|hike/,'Film':/movies?|films?|cinema/,'Comedy & Theater':/comedy|theater|theatre|shows?|broadway/,'Nightlife':/nightlife|party|club\b|bars?\b/,'Festivals & Fairs ':/halloween|holiday|christmas|thanksgiving/};
 for(const[c,x]of Object.entries(K))if(x.test(s)){r.cats.push(c.trim());s=s.replace(x,' ')}
 r.text=s.replace(/\b(events?|things?|to|do|in|near|me|within|of|the|a|an|for|at|this|and|any|stuff|something|what|whats|is|on|going|show|find)\b/g,' ').replace(/[?!.,]/g,' ').replace(/\s+/g,' ').trim();return r}

/* ---------- formatting ---------- */
const dayL=o=>{const t=key(NOW());return o.day===t?'Today':o.day===add(t,1)?'Tomorrow':''};
const timeL=o=>o.allDay?'All day':`${fT.format(o.st)}${o.en?' – '+fT.format(o.en):''}`;
const whenL=o=>`${dayL(o)||fD.format(o.st)} · ${timeL(o)}`;
const dl=d=>d==null?'':d<.3?'Nearby':`${d<10?d.toFixed(1):Math.round(d)} mi`;
const badge=e=>e.free?`<span class="free">${(e.price_text||'Free').toUpperCase()}</span>`:isPaid(e)?`<span class="paid">${esc(e.price_text||'Paid')}</span>`:`<span class="unk">${esc(e.price_text||'See details')}</span>`;
const place=e=>[e.venue,e.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');

function card(o){const e=o.e,sv=S.saved.includes(e.id);
 return `<div class="card" role="button" tabindex="0" data-o="${esc(e.id)}|${o.day}"><div class="th ${e.featured?'feat':''}" aria-hidden="true">${EMO[e.category]||'📍'}</div><div class="b"><div class="badges">${badge(e)}${e.featured?'<span class="tag">★ Pick</span>':e.kind==='library'?'<span class="tag">Library</span>':e.isNew?'<span class="tag new">New</span>':''}<button class="heart ${sv?'on':''}" data-h="${esc(e.id)}" aria-label="${sv?'Remove from saved':'Save'}: ${esc(e.title)}" aria-pressed="${sv}">${sv?'♥':'♡'}</button></div><div class="t">${esc(e.title)}</div><div class="when ell">${whenL(o)}</div><div class="sm mut ell">${o.d!=null?'<b>'+dl(o.d)+'</b> · ':''}${esc(place(e))}</div></div></div>`}
function list(L,group=true,empty=''){
 if(!L.length)return empty||`<div class="note empty"><div class="big">🔍</div><b>Nothing matches yet</b><div class="sm mut">Try another date, switch Free/Paid, or reset filters.</div><p><button class="btn" data-a="reset">Reset filters</button></p></div>`;
 let h='',last='';const MAX=S._more||60;L.slice(0,MAX).forEach(o=>{if(group&&o.day!==last){last=o.day;const dl2=dayL(o);h+=`<div class="day">${dl2?dl2+' · '+fD.format(o.st):fL.format(o.st)}</div>`}h+=card(o)});
 if(L.length>MAX)h+=`<p style="text-align:center"><button class="btn o" data-a="more">Show more (${L.length-MAX} left)</button></p>`;return h}
const chip=(a,l,on,extra='')=>`<button class="chip ${on?'on':''}" ${a} aria-pressed="${!!on}" ${extra}>${l}</button>`;
function seg(){return `<div class="seg" role="group" aria-label="Price">${[['all','All','a'],['free','Free','f'],['paid','Paid','p']].map(([k,l,c])=>`<button class="${c} ${S.price===k?'on':''}" data-p="${k}" aria-pressed="${S.price===k}">${l}</button>`).join('')}</div>`}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;


const RADS=[5,10,15,25,50];
const homeF=()=>({...S,city:'',zip:'',center:S.near&&S.loc?S.loc:null,rad:S.near&&S.loc?S.rad:0});
const townOpts=()=>Object.keys(CITY).sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
function locBlock(){
 if(S.near&&S.loc&&!S._chg)return `<div class="locbar" id="locbar"><div class="row"><span class="grow">📍 <b>${S.rad?S.rad+' mi':'Any distance'}</b> around <b>${esc(S.loc.label)}</b><br><span class="sm mut">Closest events first</span></span><button class="chip" data-a="chgloc">Change</button><button class="chip" data-a="clearloc" aria-label="Stop searching near ${esc(S.loc.label)}">✕</button></div><div class="sc" aria-label="Distance">${RADS.map(n=>chip(`data-r="${n}"`,n+' mi',S.rad===n)).join('')}${chip('data-r="0"','Any distance',!S.rad)}</div></div>`;
 return `<div class="locbar where" id="locbar"><div class="lbl" style="margin-top:0">📍 Events near a ZIP code or town</div><form class="row" data-form="where"><input id="where" placeholder="ZIP or town, e.g. 33139 or Hollywood" aria-label="ZIP code or town" autocomplete="off" enterkeyhint="search" autocapitalize="words"><button class="btn" type="submit">Find</button></form><div id="werr" class="sm werr" role="alert"></div><div class="row" style="margin-top:8px"><select id="townsel" aria-label="Choose a town" class="grow"><option value="">Or choose a town…</option>${townOpts()}</select><button class="btn o" data-a="gps" type="button">📍 Use my location</button></div>${S._chg?'<p class="sm" style="margin:8px 0 0"><button class="chip" data-a="cancelchg">Cancel</button></p>':''}</div>`}
function emptyNear(nf){const nx=RADS.find(n=>n>S.rad);const lab=esc(S.loc.label);
 return `<div class="note empty"><div class="big">📍</div><b>No events ${S.rad?'within '+S.rad+' mi of '+lab:'near '+lab}${nf?' with these filters':''}</b><div class="sm mut">${S.rad?'Try a wider radius':'Try different dates'}${nf?' or clear your other filters':''}.</div><p>${S.rad?`<button class="btn" data-r="${nx||0}">${nx?'Widen to '+nx+' mi':'Show any distance'}</button> `:''}${nf?'<button class="btn o" data-a="clearf">Clear other filters</button>':''}</p></div>`}
function setLoc(lat,lng,label,go=true){S.loc={lat,lng,label};S.near=true;S.sort='near';if(!S.rad)S.rad=15;S._chg=0;S._more=0;save();
 if(go&&S.tab!=='home'){S.tab='home';sheet('')}render();if(go)scrollTo(0,0);
 const n=query(homeF()).length;toast(n?`${n} event${n>1?'s':''} within ${S.rad} mi of ${label}`:`No events within ${S.rad} mi of ${label}. Try a wider radius.`)}
function placeErr(id,raw){const el=$(id);if(el)el.textContent=/^\s*\d{5}\s*$/.test(raw)?`ZIP ${raw.trim()} isn’t in Miami-Dade, Broward or Palm Beach. Try another ZIP or pick a town.`:raw.trim()?`Couldn’t find “${raw.trim()}”. Try a 5-digit ZIP (like 33139) or a town (like Hollywood).`:'Type a ZIP code or a town name.'}
function doGps(go){if(!navigator.geolocation){toast('Location isn’t available on this browser. Type a ZIP or town instead.');return}
 toast('Finding your location…');navigator.geolocation.getCurrentPosition(p=>setLoc(p.coords.latitude,p.coords.longitude,'My location',go),err=>{toast(err&&err.code===1?'Location is blocked for this site. Type a ZIP or town instead.':'Couldn’t get your location. Type a ZIP or town instead.');if(S.tab==='home'){S._chg=S.near?1:0;render();const w=$('where');w&&w.focus()}},{timeout:12000,maximumAge:3e5,enableHighAccuracy:false})}
/* ---------- views ---------- */
function home(){
 const f=homeF();const L=query(f);
 const nf=[S.date!=='any',S.cats.length,S.co,S.tod.length,S.q,S.max,!S.lib].filter(Boolean).length;
 const pickL=firstPer(query({price:S.price,max:S.max,lib:1,sort:'rec',date:'month'}).filter(o=>o.e.featured)).slice(0,8);
 const where=S.near&&S.loc?'📍 '+(S.rad?'Within '+S.rad+' mi of ':'Closest to ')+esc(S.loc.label):'Miami-Dade · Broward · Palm Beach';
 const noun=S.price==='free'?'free':S.price==='paid'?'paid':'';
 return `<h1>${S.price==='free'?'Free things to do':S.price==='paid'?'Tickets & paid events':'Things to do'}</h1><div class="mut">${where}</div>${updLine()?`<div class="mut upd">🔄 ${esc(updLine())}</div>`:''}
 ${!standalone()&&!S.hideInstall?`<div class="install"><span style="font-size:24px" aria-hidden="true">📲</span><div class="grow sm"><b>Get the app</b><br><span class="mut">Add SoFlo Scene to your home screen. It opens full screen, like any app.</span></div><button class="btn sm" data-a="install">Install</button></div>`:''}
 ${seg()}
 <form class="search" role="search" data-form="q"><label for="q" class="skip" style="position:absolute">Search events</label><input id="q" type="search" placeholder="Try “free concerts in Hollywood this weekend”" value="${esc(S.qRaw||S.q)}" enterkeyhint="search" autocomplete="off"><button class="btn" type="submit">Go</button></form>
  ${locBlock()}
 <div class="sc" aria-label="When">${chip('data-a="near"','📍 Near me',S.near)}${[['today','Today'],['tonight','Tonight'],['tomorrow','Tomorrow'],['weekend','This weekend'],['week','Next 7 days'],['nextweekend','Next weekend'],['month','Next 30 days']].map(([k,l])=>chip(`data-d="${k}"`,l,S.date===k)).join('')}${chip('data-a="pick"','📅 Pick a date',S.date==='custom')}</div>
 <div class="sc" aria-label="Category">${CATS.map(c=>chip(`data-c="${c[0]}"`,c[1]+' '+c[0],S.cats.includes(c[0]))).join('')}</div>
 ${S.date==='custom'?`<input type="date" id="cd" aria-label="Date" value="${S.cd}" min="${key(NOW())}" style="margin:6px 0">`:''}
 ${!nf&&!(S.near&&S.loc)&&pickL.length?`<h2>★ Top picks${noun?' · '+noun:''}</h2><div class="feat-row">${pickL.map(o=>`<button class="fcard" data-o="${esc(o.e.id)}|${o.day}"><div class="row"><span class="em" aria-hidden="true">${EMO[o.e.category]||'📍'}</span><span class="grow"></span>${badge(o.e)}</div><div class="t">${esc(o.e.title)}</div><div class="when ell">${whenL(o)}</div><div class="sm mut ell">${esc(o.e.city||o.e.venue||'')}</div></button>`).join('')}</div>`:''}
 <div class="counts"><span class="mut sm cnt"><b>${L.length}</b> ${noun?noun+' ':''}event${L.length==1?'':'s'}${nf?` · ${nf} filter${nf>1?'s':''} <button class="chip" data-a="reset" style="padding:3px 9px;font-size:12px">clear</button>`:''}</span><button class="chip" data-a="filters">⚙ Filters</button><label class="skip" for="sort" style="position:absolute">Sort</label><select id="sort" style="width:auto;padding:8px"><option value="rec" ${S.sort=='rec'?'selected':''}>Recommended</option><option value="soon" ${S.sort=='soon'?'selected':''}>Soonest</option><option value="near" ${S.sort=='near'?'selected':''}>Closest</option><option value="cheap" ${S.sort=='cheap'?'selected':''}>Cheapest</option></select></div>
 ${list(L,S.sort==='soon',S.near&&S.loc?emptyNear(nf):'')}
 <p class="sm mut" style="text-align:center">${liveLine()}</p>`}
function upd(){const g=D.updated||D.generated;return g?new Date(g):null}
function updLine(){const g=upd();return g?`Updated ${fD.format(g)}, ${fT.format(g).toLowerCase()} · new events added daily`:''}
function liveLine(){const lv=S._live;
 return `${updLine()?esc(updLine())+' · ':''}${lv?`<span class="live"><i></i> Library events live ${esc(timeAgo(new Date(lv)))}</span> · `:''}Always confirm with the organizer via “Official page”.`}
function timeAgo(d){const m=Math.round((NOW()-d)/6e4);return m<2?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':fD.format(d)}
function saved(){const L=OCC.filter(o=>S.saved.includes(o.e.id)&&(o.en||new Date(o.st.getTime()+72e5))>NOW()).sort((a,b)=>a.st-b.st);const U=firstPer(L);
 const gone=S.saved.filter(id=>!EV[id]||!L.some(o=>o.e.id===id));
 return `<h1>Saved</h1><div class="mut">Kept on this phone. No account needed.</div>${U.length?U.map(card).join(''):`<div class="note empty"><div class="big">❤️</div><b>Nothing saved yet</b><div class="sm mut">Tap the heart on any event to keep it here.</div></div>`}${gone.length?`<p class="sm mut">${gone.length} saved event${gone.length>1?'s have':' has'} already happened. <button class="chip" data-a="cleansaved" style="padding:3px 9px;font-size:12px">clear</button></p>`:''}`}
function ideas(){const MO={'Music & nights out':['Music','Nightlife','Comedy & Theater'],'Outdoors':['Outdoors & Nature','Sports & Fitness','Markets'],'Food & markets':['Food & Drink','Markets'],'Art & culture':['Arts & Culture','Film'],'Festivals':['Festivals & Fairs','Community']};
 const cats=[...new Set(S.wm.flatMap(m=>MO[m]))];
 const L=firstPer(query({date:S.wh,cats,rad:S.loc?S.wr:0,sort:'rec',price:S.wp,lib:1})).slice(0,6);
 return `<h1>What should I do?</h1><div class="mut">Pick a few things and get your best options.</div>
 <div class="lbl">When?</div><div class="sc">${[['tonight','Tonight'],['tomorrow','Tomorrow'],['weekend','This weekend'],['week','This week']].map(([k,l])=>chip(`data-wh="${k}"`,l,S.wh===k)).join('')}</div>
 <div class="lbl">Budget</div><div class="sc">${[['all','Anything'],['free','Free only'],['paid','Happy to pay']].map(([k,l])=>chip(`data-wp="${k}"`,l,S.wp===k)).join('')}</div>
 <div class="lbl">How far? ${S.loc?'':'<span class="mut sm">(enter a ZIP or town on Explore to use distance)</span>'}</div><div class="sc">${[5,10,15,25,50].map(n=>chip(`data-wr="${n}"`,n+' mi',S.wr===n)).join('')}</div>
 <div class="lbl">In the mood for…</div><div class="sc wrap">${Object.keys(MO).map(m=>chip(`data-wm="${m}"`,m,S.wm.includes(m))).join('')}</div>
 <h2>Best matches</h2>${list(L,false)}${L.length?`<p style="text-align:center"><button class="btn o" data-a="surprise">🎲 Surprise me</button></p>`:''}`}
function more(){const st=D.status||[];
 return `<h1>More</h1>
 <div class="lbl">📲 Install the app</div><div class="note sm">${installText()}</div>
 <div class="lbl">Find events near you <span class="mut sm">(optional, stays on this phone)</span></div><div class="mut sm">${S.near&&S.loc?`Showing events ${S.rad?'within '+S.rad+' mi of':'closest to'} ${esc(S.loc.label)} on Explore.`:S.loc?`Last location: ${esc(S.loc.label)} (not filtering now)`:'No location set'}</div>
 <form class="row" style="margin:8px 0" data-form="zip"><input id="zip" inputmode="numeric" maxlength="5" placeholder="ZIP code (e.g. 33139)" aria-label="ZIP code"><button class="btn" type="submit">Show events</button></form><div id="zerr" class="sm werr" role="alert"></div>
 <select id="cs" aria-label="Choose a town"><option value="">Or choose a town…</option>${townOpts()}</select>
 <div style="margin-top:8px" class="row"><button class="btn o" data-a="gps">📍 Use my location</button>${S.loc?'<button class="btn o" data-a="clearloc">Clear</button>':''}</div>
 <div class="lbl">Interests <span class="mut sm">(boosts Recommended)</span></div><div class="sc wrap">${CATS.map(c=>chip(`data-i="${c[0]}"`,c[1]+' '+c[0],S.ints.includes(c[0]))).join('')}</div>
 <div class="lbl">Favorite days <span class="mut sm">(boosts Recommended)</span></div><div class="sc wrap">${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=>chip(`data-dy="${d}"`,d,S.days.includes(d))).join('')}</div>
 <div class="lbl">Reminders</div><div class="note sm">Tap <b>Add to calendar</b> on any event and your phone will remind you.</div>
 <div class="lbl">Where the events come from</div><div class="sm">
 <p><b>★ Picks</b>: concerts, festivals, markets, games, shows and more across all three counties, each checked against the organizer's own page. Every event links to its official page.</p>
 <p><b>Library events</b> come live from the public calendars of the Miami-Dade, Broward and Palm Beach County library systems. They're always free.</p>
 ${st.length?`<p class="mut">${st.map(x=>`${esc(x.source)}: ${x.ok?x.events+' events':'unavailable'}`).join(' · ')}</p>`:''}
 <p class="mut">“Free” means free general admission. Some free events have paid extras or ask you to RSVP, and the event page says so. Paid prices are the ticket range we saw and can change.</p></div>
 <div class="lbl">Appearance</div><div class="sc">${[['','Auto'],['light','Light'],['dark','Dark']].map(([k,l])=>chip(`data-th="${k}"`,l,S.theme===k)).join('')}</div>
 <p class="sm mut" style="margin-top:20px">SoFlo Scene · formerly FreeSouthFL</p>`}
function installText(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 if(standalone())return 'You’re using the installed app. ✅';
 if(ios)return `<b>On iPhone:</b><ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>`;
 return `${deferredPrompt?'<button class="btn" data-a="doinstall">Install SoFlo Scene</button><br><br>':''}<b>On Android (Chrome):</b> tap the ⋮ menu, then <b>Install app</b> or <b>Add to Home screen</b>.<br><b>On iPhone:</b> Safari → Share → <b>Add to Home Screen</b>.`}
function detail(id,day){const e=EV[id];if(!e)return'';const o=OCC.find(x=>x.e.id===id&&x.day===day)||OCC.find(x=>x.e.id===id);if(!o)return'';
 const p=ll(e),c=S.loc;const d=c&&p?hav(c.lat,c.lng,p[0],p[1]):null;
 const addr=e.address||[e.venue,e.city,'FL'].filter(Boolean).join(', ');const dq=[e.venue,addr].filter(Boolean).join(', ');
 const gdir='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(p&&!e.address?p.join(','):dq);
 const adir='https://maps.apple.com/?daddr='+encodeURIComponent(dq);
 const en=o.en||new Date(o.st.getTime()+2*36e5),z=x=>x.toISOString().replace(/[-:]|\.\d{3}/g,'');
 const gcal='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.title)+'&dates='+z(o.st)+'/'+z(en)+'&location='+encodeURIComponent(dq)+'&details='+encodeURIComponent((e.desc||'')+'\n\n'+(e.price_text||'')+'\nMore: '+e.url);
 const sv=S.saved.includes(e.id);
 const others=(e.kind!=='library'?OCC.filter(x=>x.e.id===id):(o.sib||[])).filter(x=>x.st>NOW()&&x!==o).slice(0,8);
 const kv=[['County',e.county],['Category',e.category],['Price',e.price_text],['Family-friendly',isFam(e)?'Yes':null],['Registration',(e.tags||[]).includes('rsvp')?'RSVP / registration requested':null],['Good to know',(e.tags||[]).filter(t=>!['family','rsvp','library','weekly'].includes(t)).join(', ')||null],['Source',e.kind==='library'?(e.lib||e.source):e.kind==='feed'?e.source+' (auto-updated)':e.source]].filter(x=>x[1]);
 return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(e.title)}"><div class="in"><div class="row"><button class="btn o" data-a="close">← Back</button><span class="grow"></span><button class="heart ${sv?'on':''}" data-h="${esc(e.id)}" style="font-size:28px" aria-label="${sv?'Remove from saved':'Save'}" aria-pressed="${sv}">${sv?'♥':'♡'}</button></div>
 <div class="hero ${e.featured?'th feat':''}" style="width:auto" aria-hidden="true">${EMO[e.category]||'📍'}</div>
 <div class="badges">${badge(e)}${e.featured?'<span class="tag">★ SoFlo Scene pick</span>':e.kind==='library'?'<span class="tag">Library event</span>':''}</div>
 <h1 style="font-size:24px;margin-top:8px">${esc(e.title)}</h1>
 <div style="margin-top:6px"><b>📅 ${fL.format(o.st)}</b><div class="when">⏰ ${timeL(o)}${o.en||o.allDay?'':' (end time not listed)'}</div></div>
 <div style="margin-top:8px"><b>📍 ${esc(e.venue||e.city||'')}</b><div class="mut">${esc(addr)}</div>${d!=null?`<div class="sm mut">${dl(d)} away</div>`:''}</div>
 <div class="ban ${e.free?'':'p'}">${e.free?'🎟️ ':isPaid(e)?'💲 ':'ℹ️ '}${esc(e.price_text||(e.free?'Free':'Paid'))}${e.free?'':isPaid(e)?' · prices can change, check the official page':' · price not listed by the organizer, check the official page'}</div>
 <div class="g2"><a class="btn" href="${esc(e.url)}" target="_blank" rel="noopener">${e.free?'🔗 Official page':'🎟️ Tickets & info'}</a><a class="btn o" href="${gdir}" target="_blank" rel="noopener">🧭 Directions</a><button class="btn o" data-ics="${esc(e.id)}|${o.day}">📅 Add to calendar</button><button class="btn o" data-share="${esc(e.id)}|${o.day}">↗ Share</button></div>
 <div class="sm" style="text-align:center"><a href="${gcal}" target="_blank" rel="noopener">Add to Google Calendar</a> · <a href="${adir}" target="_blank" rel="noopener">Open in Apple Maps</a></div>
 ${e.desc?`<div class="lbl">About</div><div>${esc(e.desc)}</div>`:''}
 ${others.length?`<div class="lbl">More dates</div><div class="sc">${others.map(x=>chip(`data-o="${esc(x.e.id)}|${x.day}"`,fD.format(x.st),false)).join('')}</div>`:''}
 ${kv.length?`<div class="lbl">Details</div><div class="kv">${kv.map(([k,v])=>`<span>${k}</span><span>${esc(v)}</span>`).join('')}</div>`:''}
 <div class="note sm">Details can change. Check the official page before you go.</div></div></div>`}
function filtersSheet(){const o=(a,l,on)=>chip(a,l,on);
 sheet(`<div class="sheet" role="dialog" aria-modal="true" aria-label="Filters"><div class="in"><div class="row"><h1 style="font-size:22px" class="grow">Filters</h1><button class="btn o sm" data-a="close">Done</button></div>
 <div class="lbl">Price</div>${seg()}
 <div class="lbl">Max ticket price</div><div class="sc">${[[0,'Any'],[20,'Under $20'],[50,'Under $50'],[100,'Under $100']].map(([n,l])=>o(`data-mx="${n}"`,l,S.max===n)).join('')}</div>
 <div class="lbl">County</div><div class="sc">${o('data-co=""','All',!S.co)}${COUNTIES.map(c=>o(`data-co="${c}"`,c,S.co===c)).join('')}</div>
 <div class="lbl">Distance ${S.loc?'from '+esc(S.loc.label):'<span class="mut sm">(enter a ZIP or town on Explore first)</span>'}</div><div class="sc">${RADS.map(n=>o(`data-r="${n}"`,n+' mi',S.near&&S.rad===n)).join('')}${o('data-r="0"','Any',S.near&&!S.rad)}</div>
 <div class="lbl">Time of day</div><div class="sc">${['morning','afternoon','evening','night'].map(t=>o(`data-tod="${t}"`,t[0].toUpperCase()+t.slice(1),S.tod.includes(t))).join('')}</div>
 <div class="lbl">Include</div><div class="sc">${o('data-a="lib"','📚 Library events',S.lib)}</div>
 <div class="row" style="margin-top:22px"><button class="btn o" data-a="reset" style="flex:1">Reset</button><button class="btn" data-a="close" style="flex:1">Show ${query(homeF()).length} events</button></div></div></div>`)}

/* ---------- wiring ---------- */
const NAVS=[['home','🏠','Explore'],['ideas','✨','Ideas'],['saved','❤️','Saved'],['more','☰','More']];
function render(){const V={home,saved,ideas,more};$('app').innerHTML=(V[S.tab]||home)();$('nav').innerHTML=NAVS.map(([k,i,l])=>`<button class="${S.tab===k?'on':''}" data-t="${k}" aria-current="${S.tab===k?'page':'false'}"><b aria-hidden="true">${i}</b>${l}</button>`).join('');applyTheme()}
let lastFocus=null;
const sheet=h=>{if(h&&!$('sheet').innerHTML)lastFocus=document.activeElement;$('sheet').innerHTML=h;document.body.style.overflow=h?'hidden':'';if(h){const b=$('sheet').querySelector('button');b&&b.focus({preventScroll:true})}else if(lastFocus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true})};
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),2200)}
function applyTheme(){if(S.theme)document.documentElement.setAttribute('data-theme',S.theme);else document.documentElement.removeAttribute('data-theme')}
function apply(q){
 S.qRaw=q;const p=parseQ(q);S.q=p.text;
 if(p.date)S.date=p.date;if(p.cats.length)S.cats=p.cats;if(p.co)S.co=p.co;
 if(p.price==='free')S.price='free';else if(p.price==='paid')S.price='paid';
 if(p.max){S.max=p.max;if(S.price==='free')S.price='all'}
 let loc=null;
 if(p.zip){const z=ZIP[p.zip];if(z)loc=[z[0],z[1],'ZIP '+p.zip];else toast('That ZIP isn’t in our South Florida list. Try choosing a town.')}
 else if(p.city){const c=CITY[p.city];loc=[c[0],c[1],p.city]}
 else if(p.near){if(S.loc)loc=[S.loc.lat,S.loc.lng,S.loc.label];else {S._chg=1;toast('Choose a ZIP or town below, or use your location')}}
 if(loc){S.loc={lat:loc[0],lng:loc[1],label:loc[2]};S.near=true;S.sort='near';S.rad=p.rad||S.rad||15;S._chg=0;save()}
 else if(p.rad&&S.loc){S.rad=p.rad;S.near=true;S.sort='near';save()}
 S._more=0;render();if(p.near&&!loc){const w=$('where');w&&w.focus()}
}
const eventURL=(id,day)=>location.origin+location.pathname+'#/e/'+encodeURIComponent(id)+'/'+day;
function ics(o){const e=o.e,en=o.en||new Date(o.st.getTime()+2*36e5),z=x=>x.toISOString().replace(/[-:]|\.\d{3}/g,''),t=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SoFlo Scene//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+e.id+'-'+o.day+'@sofloscene','DTSTAMP:'+z(new Date()),'DTSTART:'+z(o.st),'DTEND:'+z(en),'SUMMARY:'+t(e.title),'LOCATION:'+t(e.address||[e.venue,e.city].filter(Boolean).join(', ')),'DESCRIPTION:'+t((e.price_text||'')+'\n'+(e.desc||'')+'\n'+e.url),'URL:'+e.url,'BEGIN:VALARM','TRIGGER:-PT2H','ACTION:DISPLAY','DESCRIPTION:'+t(e.title),'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n')}
const tg=(a,v)=>a.includes(v)?a.filter(x=>x!==v):[...a,v];
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
function installSheet(){sheet(`<div class="sheet" role="dialog" aria-modal="true" aria-label="Install"><div class="in"><div class="row"><h1 style="font-size:22px" class="grow">Install SoFlo Scene</h1><button class="btn o sm" data-a="close">Close</button></div><div class="hero" aria-hidden="true">📲</div><div class="note">${installText()}</div><p class="sm mut">It opens full screen from your home screen and keeps your saved events, even offline.</p><p><button class="chip" data-a="hideinstall">Don’t show the install banner again</button></p></div></div>`)}
document.addEventListener('click',async ev=>{
 const t=ev.target.closest('[data-t],[data-h],[data-o],[data-a],[data-d],[data-c],[data-co],[data-r],[data-tod],[data-wh],[data-wr],[data-wm],[data-wp],[data-i],[data-dy],[data-share],[data-ics],[data-p],[data-mx],[data-th]');if(!t)return;const X=t.dataset;
 if(X.h){ev.stopPropagation();const id=X.h;const on=!S.saved.includes(id);S.saved=on?[...S.saved,id]:S.saved.filter(x=>x!==id);save();toast(on?'Saved ♥':'Removed from saved');if($('sheet').innerHTML){t.classList.toggle('on',on);t.textContent=on?'♥':'♡';t.setAttribute('aria-pressed',on)}if(S.tab!=='home'||!$('sheet').innerHTML)render();return}
 if(X.t){S.tab=X.t;S._more=0;sheet('');if(location.hash)history.replaceState(null,'',location.pathname);render();scrollTo(0,0);return}
 if(X.o){const i=X.o.lastIndexOf('|');openEvent(X.o.slice(0,i),X.o.slice(i+1));return}
 if(X.share){const i=X.share.lastIndexOf('|'),id=X.share.slice(0,i),day=X.share.slice(i+1),o=OCC.find(x=>x.e.id===id&&x.day===day);if(!o)return;const e=o.e,url=eventURL(id,day);
  const txt=`${e.title}\n${fL.format(o.st)}, ${timeL(o)}\n${place(e)}\n${e.free?'FREE':e.price_text}`;
  try{if(navigator.share){await navigator.share({title:e.title,text:txt,url});return}throw 0}catch(x){if(x&&x.name==='AbortError')return;try{await navigator.clipboard.writeText(txt+'\n'+url);toast('Link copied')}catch(y){prompt('Copy this link:',url)}}return}
 if(X.ics){const i=X.ics.lastIndexOf('|'),o=OCC.find(x=>x.e.id===X.ics.slice(0,i)&&x.day===X.ics.slice(i+1));if(!o)return;const b=new Blob([ics(o)],{type:'text/calendar'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(o.e.title.replace(/[^\w]+/g,'-').slice(0,40)||'event')+'.ics';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast('Calendar file ready');return}
 if(X.p){S.price=X.p;save();if($('sheet').innerHTML){filtersSheet();render();return}}
 else if(X.mx!=null&&X.mx!==undefined&&t.hasAttribute('data-mx')){S.max=+X.mx;if(S.max&&S.price==='free')S.price='all';save();filtersSheet();render();return}
 else if(X.th!==undefined&&t.hasAttribute('data-th')){S.theme=X.th;save()}
 else if(X.d){S.date=S.date===X.d?'any':X.d}else if(X.c){S.cats=tg(S.cats,X.c)}
 else if(t.hasAttribute('data-co')){S.co=X.co;filtersSheet();render();return}
 else if(t.hasAttribute('data-r')){if(!S.loc){toast('Set a ZIP or town first');return}S.rad=+X.r;S.near=true;if(S.sort==='rec')S.sort='near';save();if($('sheet').innerHTML)filtersSheet();render();return}
 else if(X.tod){S.tod=tg(S.tod,X.tod);filtersSheet();render();return}
 else if(X.wh){S.wh=X.wh}else if(X.wr){S.wr=+X.wr}else if(X.wm){S.wm=tg(S.wm,X.wm)}else if(X.wp){S.wp=X.wp}
 else if(X.i){S.ints=tg(S.ints,X.i);save()}else if(X.dy){S.days=tg(S.days,X.dy);save()}
 else if(X.a){const a=X.a;
  if(a==='close'){sheet('');if(location.hash.startsWith('#/e/'))history.replaceState(null,'',location.pathname);render();return}
  else if(a==='reset'){Object.assign(S,{q:'',qRaw:'',date:'any',cats:[],co:'',rad:0,tod:[],fcity:'',fzip:'',zc:null,near:false,sort:'rec',max:0,lib:1,_more:0,_chg:0});save();sheet('')}
   else if(a==='clearf'){Object.assign(S,{q:'',qRaw:'',date:'any',cats:[],co:'',tod:[],price:'all',max:0,lib:1,_more:0});save();render();return}
   else if(a==='chgloc'){S._chg=1;render();const w=$('where');w&&w.focus();return}
   else if(a==='cancelchg'){S._chg=0;render();return}
  else if(a==='filters'){filtersSheet();return}
  else if(a==='more'){S._more=(S._more||60)+60}
  else if(a==='lib'){S.lib=S.lib?0:1;save();filtersSheet();render();return}
  else if(a==='pick'){S.date='custom';S.cd=S.cd||key(NOW())}
  else if(a==='install'){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>{deferredPrompt=null;render()});return}installSheet();return}
  else if(a==='doinstall'){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}return}
  else if(a==='hideinstall'){S.hideInstall=1;try{localStorage.setItem('soflo_hideinstall','1')}catch(e){}sheet('')}
  else if(a==='cleansaved'){S.saved=S.saved.filter(id=>OCC.some(o=>o.e.id===id&&(o.en||o.st)>NOW()));save()}
  else if(a==='surprise'){const L=firstPer(query({date:S.wh,price:S.wp,lib:1}));if(L.length){const o=L[Math.floor(Math.random()*Math.min(L.length,25))];openEvent(o.e.id,o.day)}return}
  else if(a==='near'){if(S.near){S.near=false;S.sort='rec';S._chg=0;save()}else if(S.loc){S.near=true;S.sort='near';S.rad=S.rad||15;save()}else{doGps(false);return}}
  else if(a==='gps'){doGps(true);return}
  else if(a==='clearloc'){S.loc=null;S.near=false;S.rad=0;S.sort='rec';S._chg=0;save();toast('Showing all of South Florida')}}
 render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sheet').innerHTML){sheet('');if(location.hash.startsWith('#/e/'))history.replaceState(null,'',location.pathname);render()}else if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('card')){e.preventDefault();e.target.click()}});
document.addEventListener('submit',e=>{const f=e.target.dataset.form;if(!f)return;e.preventDefault();if(f==='q'){apply($('q').value)}else if(f==='zip'||f==='where'){const id=f,raw=$(id).value.trim(),p=resolvePlace(raw);if(p)setLoc(p[0],p[1],p[2]);else placeErr(f==='zip'?'zerr':'werr',raw)}});
document.addEventListener('change',e=>{if(e.target.id==='sort'){S.sort=e.target.value;save();render()}else if(e.target.id==='cd'){S.cd=e.target.value;render()}else if((e.target.id==='cs'||e.target.id==='townsel')&&e.target.value){const c=CITY[e.target.value];setLoc(c[0],c[1],e.target.value)}});
$('themeBtn').addEventListener('click',()=>{const dark=S.theme?S.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;S.theme=dark?'light':'dark';save();applyTheme()});
function openEvent(id,day){const h=detail(id,day);if(!h){toast('That event has ended or moved');return}sheet(h);const want='#/e/'+encodeURIComponent(id)+'/'+day;if(location.hash!==want)history.replaceState(null,'',want)}
function route(){const m=location.hash.match(/^#\/e\/([^/]+)\/(\d{4}-\d{2}-\d{2})/);if(m){const id=decodeURIComponent(m[1]);if(EV[id])openEvent(id,m[2]);else if(!S._liveTried){S._pendingRoute=true}else toast('That event has ended or moved')}}
window.addEventListener('hashchange',route);
try{if(localStorage.getItem('soflo_hideinstall'))S.hideInstall=1}catch(e){}

/* ---------- live library refresh (works on the published site; the bundled snapshot is the fallback) ---------- */
async function live(){
 try{const c=JSON.parse(localStorage.getItem('soflo_live')||'null');if(c&&c.events&&Date.now()-Date.parse(c.fetched_at)<12*36e5){useLive(c)}}catch(e){}
 if(!/sites\.tab\.bot$/.test(location.hostname)){S._liveTried=1;return}
 try{const ac=new AbortController();setTimeout(()=>ac.abort(),12000);const r=await fetch('api/live',{signal:ac.signal});if(!r.ok)throw new Error(r.status);const j=await r.json();
  if(j&&Array.isArray(j.events)&&j.events.length>20){useLive(j);try{localStorage.setItem('soflo_live',JSON.stringify(j))}catch(e){}}}catch(e){}
 S._liveTried=1;if(S._pendingRoute){S._pendingRoute=false;route()}}
function useLive(j){const keep=new Map((D.library||[]).map(x=>[x.id,x]));for(const x of j.events)keep.set(x.id,x);const now=Date.now()-864e5;
 const lib=[...keep.values()].filter(x=>!NON_EVENT.test(x.title||'')&&!isKid(x.title)&&Date.parse(String(x.start).slice(0,10)+'T23:59:00-05:00')>now);
 if(j.status)D.status=j.status;build(D.curated||[],lib);S._live=j.fetched_at;if(!$('sheet').innerHTML)render()}

render();route();live();
if('serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}
})();
