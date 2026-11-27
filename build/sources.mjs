// SoFlo Scene — live library-event sources (keyless public JSON). Runs in Node 20 and in a Cloudflare Worker.
export const LIB_SOURCES = [
  { id: "mdpl", county: "Miami-Dade", name: "Miami-Dade Public Library", kind: "communico", base: "https://www.mdpls.org", link: "https://mdpls.org/event/",
    types: ["Special Event","Music","Movies","Performances & Presentations","Author Event","Holiday"] },
  { id: "bcl", county: "Broward", name: "Broward County Library", kind: "communico", base: "https://broward.libnet.info", link: "https://broward.libnet.info/event/",
    types: ["Performances - Dance, Concerts & Theater","Movie","Author Events","Fair/Festival","Speaker","Arts & Cultural"] },
  { id: "pbcl", county: "Palm Beach", name: "Palm Beach County Library", kind: "biblio", base: "https://gateway.bibliocommons.com/v2/libraries/pbclibrary", link: "https://pbclibrary.bibliocommons.com/v2/events/",
    types: ["Performance","Film","Black Voices, Culture & History","Christmas","Thanksgiving","Fall","Winter","Diwali","New Years","Jewish American Heritage","American History","Trivia","Anime, Manga & Comics","Food","Hanukkah","Kwanzaa","Halloween"] },
];
const NON_EVENT = /\bFLOW\)|licens(e|ing)\s+on\s+wheels|\b(dmv|driver'?s?\s+licen[cs]e)\b|property\s+appraiser|tax\s+collector|\bTConnect\b|property\s+tax\s+info|congressional\s+district\s+mobile\s+office|mobile\s+office\b|information\s+session\b|contract\s+signing|advisory\s+(committee|board)|quarter(ly)?\s+meeting|food\s+(and\s+nutrition\s+)?distribution|meal\s+kits|bike\s+valet|\bpassport\b|\bnotary\b|tax\s+prep|\bjob\s+fair\b|\bhiring\b|\b(closed|closure|cancel+ed|postponed)\b|office\s+hours|staff\s+meeting|\btest\s+event\b|t-?connect\b|press\s+conference|homebound|e-?waste|shred(ding)?\s+(event|day)|(turkey|thanksgiving|food|toy|grocery)\s+giveaway|giveaway\s+drive|mobile\s+market|(commission|council|board|town\s+hall)\s+meeting|public\s+hearing|flu\s+shots?|vaccin(e|ation)\s+clinic/i; // non-events (services/admin), mirrors pipeline/common.py NON_EVENT
const KIDS = /\bstory\s*-?\s*times?\b|\bstory\s*book\b|\bstor(y|ies)\s+(and|&|n)\s+crafts?\b|\bchildren'?s\s+stories\b|\bbab(y|ies)\b|\btoddlers?\b|\bpre-?school(ers?)?\b|\bpre-?k\b|\blap\s*-?sit\b|\brhyme\s*time\b|\bwiggles?\b|\bplay\s*-?groups?\b|\bmusic\s*(&|and)\s*movement\b|\btots?\b|\bmommy\s*(&|and|n'?)\s*me\b|\b(daddy|parent|caregiver|grownup)\s*(&|and)\s*me\b|\bhomework\b|\bpuppets?\b|\blego\b|\bstea?m\s+(day|lab|spot|saturday|club|camp)\b|\btweens?\b|\bteenie\b|\bmini\s+picassos?\b|\blittle\s+(ones?|monsters?|learners?|explorers?|readers?|artists?|scientists?|chefs?|makers?)\b|\bmonster\s+makers?\b|\bjunior\s+(rangers?|environmental|chefs?|scientists?)\b|\bhandprint\b|\bslime\b|(?<!adult\s)\bcoloring\b|\bmarci\s+poppins?\b|\btalking\s+is\s+teaching\b|\bready,?\s*set,?\s*go\b|\bsigning\s+stories\b|\bharmony\s+hugs\b|\bpopcorn\s+pals\b|\bfairy\s*tale\s+characters?\b|\bnot[-\s](so|too)[-\s]spooky\b|\bfamily\s+(movie|film|fun\s+film|coloring|gardening|craft|game)s?\b|\bmagic\s+school\s+bus\b|\btrunk[-\s]or[-\s]treat\b|\btrick[-\s]or[-\s]treat(?!\s+for\s+teens)|\bbreakfast\s+with\s+santa\b|\bbricks,?\s+bots\b|\bimagination\s+exploration\b|\bpaint-?ology\b|\bscience\s+explorium\b|\b(thanksgiving|halloween|turkey|pumpkin|fall|pizza\s+day|holiday)\s+craft\b|\bcraft\s*time\b|\bcrafternoons?\b|\bpumpkin\s+patty|\baesop\b|\bgrades?\s*(k|pre-?k|[1-5])\b|\bages?\s*[0-9](?![0-9])/i; // young-kids programs (Caz 2026-10-27: no storytimes / little-kid things); mirrors pipeline/common.py KIDS
const KIDWORD = /\bkids?\b|\bkid'?s\b|\bchild(ren)?(['’]?s)?\b/i, KIDKEEP = /\bvs\.?\s|\bfestival\b|\bfair\b|\bparade\b|\bconcert\b|\bsymphony\b/i;
const isKid = (t) => { t = String(t || ""); return KIDS.test(t) || (KIDWORD.test(t) && !KIDKEEP.test(t)); };
const YOUNG_AGES = /early childhood|children|bab(y|ies)|toddler|pre-?school|famil/i, OLDER_AGES = /adult|teen|all ages|senior|older/i;
const youngOnly = (s) => !!s && YOUNG_AGES.test(s) && !OLDER_AGES.test(s); // library audience is only little kids (tween-only 8-12 programs are kept)
const SKIP = /\b(grab ?& ?go|take ?(and|&) ?make|seed library|ESL|GED|tax|resume|citizenship|computer|tech help|notary|blood drive|food pantry|exhibit(ion)?)\b/i;
const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const short = (s, n = 260) => { s = strip(s).replace(/For more information,? please contact[^.]*\.?/i, "").trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; };
function catFor(words, title) {
  const t = (words.join(" ") + " " + title).toLowerCase();
  if (/concert|music|jazz|band|orchestra|choir|piano|guitar/.test(t)) return "Music";
  if (/movie|film|cinema/.test(t)) return "Film";
  if (/theater|theatre|dance|performance|comedy|magic|puppet/.test(t)) return "Comedy & Theater";
  if (/festival|fair\b|celebration|holiday|christmas|hanukkah|kwanzaa|thanksgiving|diwali|halloween|new year/.test(t)) return "Festivals & Fairs";
  if (/food|cook|recipe|tasting/.test(t)) return "Food & Drink";
  if (/art|craft|paint|draw|culture|history|heritage|author|book|poetry|speaker|lecture/.test(t)) return "Arts & Culture";
  return "Community";
}
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
async function getJSON(url, timeoutMs = 25000) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), timeoutMs);
  try { const r = await fetch(url, { signal: ac.signal, ...(globalThis.WebSocketPair ? { cf: { cacheTtl: 10800, cacheEverything: true } } : {}), headers: { "accept": "application/json", "user-agent": "Mozilla/5.0 (compatible; SoFloScene/1.0; +https://sofloscene.sites.tab.bot)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`); return await r.json(); } finally { clearTimeout(tm); }
}
async function communico(src, from, days) {
  const req = JSON.stringify({ private: false, date: from, days, locations: [], ages: [], types: src.types });
  const arr = await getJSON(`${src.base}/eeventcaldata?event_type=0&req=${encodeURIComponent(req)}`);
  const out = [];
  for (const e of arr || []) {
    if (e.event_type && e.event_type !== "INPERSON") continue;
    if (/all day/i.test(e.time_string || "") || /23:59/.test(e.raw_end_time || "") && /00:00:00$/.test(e.raw_start_time || "")) continue;
    if (+e.registration_cost > 0) continue;
    if (e.changed_time_string && /cancel/i.test(e.changed_time_string)) continue;
    if (/cancel+ed/i.test(e.title)) continue;
    if (SKIP.test(e.title) || NON_EVENT.test(e.title) || isKid(e.title + " " + (e.sub_title || "")) || youngOnly((e.agesArray || []).join(" "))) continue;
    if (/online|virtual/i.test(e.library || e.location || "")) continue;
    const tags = [...(e.tagsArray || [])], ages = (e.agesArray || []).join(" ");
    const start = String(e.raw_start_time || e.event_start).replace(" ", "T").slice(0, 16), end = e.raw_end_time ? String(e.raw_end_time).replace(" ", "T").slice(0, 16) : null;
    out.push({ id: `${src.id}-${e.id}`, series: e.recurring_id ? `${src.id}-s${e.recurring_id}` : null, title: strip(e.title) + (e.sub_title ? ` — ${strip(e.sub_title)}` : ""),
      start, end, venue: strip(e.library || e.location), branch: strip(e.library || e.location), county: src.county,
      category: catFor(tags, e.title), free: true, price_text: (+e.allow_reg ? "Free · RSVP" : "Free"),
      desc: short(e.description || e.long_description), url: src.link + e.id, source: new URL(src.link).host, lib: src.name,
      tags: [ /famil|kid|child|toddler|preschool|tween|early childhood/i.test(ages) ? "family" : null, +e.allow_reg ? "rsvp" : null, "library" ].filter(Boolean) });
  }
  return out;
}
async function biblio(src, from, days) {
  const to = ymd(new Date(Date.parse(from + "T12:00:00Z") + days * 864e5));
  const out = []; let page = 1, pages = 1; const types = {}, locs = {}, auds = {};
  do {
    const j = await getJSON(`${src.base}/events/search?startDate=${from}&endDate=${to}&limit=100&page=${page}`);
    pages = Math.min(j.events?.pagination?.pages || 1, 25);
    Object.assign(types, Object.fromEntries(Object.entries(j.entities?.eventTypes || {}).map(([k, v]) => [k, String(v.name || "").trim()])));
    Object.assign(locs, j.entities?.locations || {}); Object.assign(auds, j.entities?.eventAudiences || {});
    for (const id of (j.events?.results || j.events?.items || [])) {
      const ev = j.entities.events[id]; const d = ev?.definition; if (!d || d.isCancelled) continue;
      const tn = (d.typeIds || []).map((t) => types[t]).filter(Boolean);
      if (!tn.some((t) => src.types.includes(t))) continue;
      if (SKIP.test(d.title) || NON_EVENT.test(d.title) || isKid(d.title) || youngOnly((d.audienceIds || []).map((x) => String(auds[x]?.name || "")).join(" "))) continue;
      const L = locs[d.branchLocationId] || {}; const a = L.address || {};
      const addr = [a.number && a.street ? `${a.number} ${a.street}` : (a.street || ""), a.city, a.state || "FL", a.zip].filter(Boolean).join(", ") || strip(d.locationDetails).replace(/\n/g, ", ");
      const ml = L.mapLocation || {};
      out.push({ id: `${src.id}-${ev.id}`, series: ev.seriesId ? `${src.id}-s${ev.seriesId}` : null, title: strip(d.title), start: d.start, end: d.end || null,
        venue: strip(L.name || d.branchLocationId || "Library"), branch: strip(L.name || ""), address: addr, city: a.city || null, zip: a.zip || null, county: src.county,
        lat: ml.lat != null ? +ml.lat : (ml.latitude != null ? +ml.latitude : null), lng: ml.lng != null ? +ml.lng : (ml.longitude != null ? +ml.longitude : null),
        category: catFor(tn, d.title), free: true, price_text: (d.registrationInfo?.enabledMethods?.length ? "Free · RSVP" : "Free"),
        desc: short(d.description), url: src.link + ev.id, source: "pbclibrary.bibliocommons.com", lib: src.name,
        tags: ["library", d.registrationInfo?.enabledMethods?.length ? "rsvp" : null].filter(Boolean) });
    }
    page++;
  } while (page <= pages);
  return out;
}
export async function collectLibraryEvents({ from, days = 30, branches = {} } = {}) {
  const status = [];
  const results = await Promise.all(LIB_SOURCES.map(async (src) => {
    const t0 = Date.now();
    try { const ev = src.kind === "communico" ? await communico(src, from, days) : await biblio(src, from, days);
      status.push({ source: src.name, ok: true, events: ev.length, ms: Date.now() - t0 }); return ev; }
    catch (e) { status.push({ source: src.name, ok: false, error: String(e.message || e), ms: Date.now() - t0 }); return []; }
  }));
  const events = results.flat().map((e) => {
    const b = branches[`${e.county}|${e.branch}`];
    if (b) { e.lat = e.lat ?? b.lat; e.lng = e.lng ?? b.lng; e.city = e.city || b.city; e.address = e.address || b.address; }
    return e;
  });
  return { events, status, fetched_at: new Date().toISOString(), from, days };
}
