
"""SoFlo Scene ingest — shared helpers and the event contract.

Every source module in pipeline/sources/<name>.py exposes:
    SOURCE = "short-id"
    def fetch(start: datetime.date, end: datetime.date) -> list[dict]
returning events in the CONTRACT below. Raise on total failure (the runner catches it and keeps
last-good output for that source); return [] when the source legitimately has nothing.

CONTRACT (one dict per event; a multi-date run may be one dict with several dates):
  title str, dates [YYYY-MM-DD...] (only dates within [start,end]), start "HH:MM"|None, end "HH:MM"|None,
  venue str, address str, city str, county one of Miami-Dade|Broward|Palm Beach, zip str|None,
  lat float|None, lng float|None, category one of CATEGORIES, free bool,
  price_min float|None, price_max float|None, price_text str, desc str (<=300 chars, plain text),
  url str (exact page from the source), source str (domain), tags [str]
Rules: never invent dates or prices. free=True only when the source says free / cost 0.
No stated price on a ticketed event -> free=False, price_min/max None, price_text "See tickets".
No stated price and not clearly ticketed -> free=False, price_text "See details" (runner hides these from Free).
"""
import datetime as dt, html, json, re, time, hashlib
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/New_York")
CATEGORIES = ["Music","Arts & Culture","Festivals & Fairs","Markets","Outdoors & Nature",
              "Food & Drink","Sports & Fitness","Film","Comedy & Theater","Community","Nightlife"]

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

def get(url, *, impersonate=True, timeout=30, tries=2, headers=None, as_json=False):
    """GET with Chrome TLS impersonation (curl_cffi) by default; falls back to requests."""
    last = None
    for i in range(tries):
        try:
            if impersonate:
                from curl_cffi import requests as cr
                r = cr.get(url, impersonate="chrome", timeout=timeout, headers=headers or {})
            else:
                import requests
                r = requests.get(url, timeout=timeout, headers={"user-agent": UA, **(headers or {})})
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code} for {url}")
            return r.json() if as_json else r.text
        except Exception as e:
            last = e; time.sleep(1.5 * (i + 1))
    raise last

def strip_html(s, n=300):
    s = html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > n:
        s = s[:n].rsplit(" ", 1)[0].rstrip(",;:-") + "…"
    return s

JUNK = re.compile(r"\b(city commission|commission meeting|council meeting|board meeting|workshop meeting|"
                  r"advisory (board|committee)|committee meeting|budget hearing|public hearing|planning (board|and zoning)|"
                  r"zoning|closed|closure|cancel+ed|postponed|members[- ]only|member'?s only|staff only|"
                  r"special magistrate|code enforcement|agenda|sunshine meeting|election|early voting|"
                  r"permit|registration deadline|office hours|holiday observed|city hall closed)\b", re.I)

def is_junk(title, desc=""):
    return bool(JUNK.search(title or "")) or bool(re.search(r"\b(cancel+ed|postponed)\b", desc or "", re.I) and re.search(r"cancel+ed|postponed", title or "", re.I))

def daterange(start, end):
    d = start
    while d <= end:
        yield d
        d += dt.timedelta(days=1)

def hhmm(t):
    """'2026-11-03 19:30:00' / datetime / '7:30 pm' -> '19:30' (None if unknown/all-day midnight)."""
    if t is None: return None
    if isinstance(t, dt.datetime): return t.strftime("%H:%M")
    m = re.search(r"(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?", str(t), re.I)
    if not m: 
        m2 = re.search(r"\b(\d{1,2})\s*([ap])\.?m\.?", str(t), re.I)
        if not m2: return None
        h = int(m2.group(1)) % 12 + (12 if m2.group(2).lower()=="p" else 0); return f"{h:02d}:00"
    h, mi = int(m.group(1)), m.group(2)
    if m.group(3):
        h = h % 12 + (12 if m.group(3)[0].lower()=="p" else 0)
    return f"{h:02d}:{mi}"

def price_from_text(s):
    """Parse '$25', '$35 - $120', 'From $29', 'Free'. Returns (free, min, max, text) or None if no info."""
    if s is None: return None
    t = str(s).strip()
    if not t: return None
    if re.fullmatch(r"(?i)\s*(free|free admission|free entry|free event|\$?0(\.00)?)\s*!?", t) or re.match(r"(?i)^free\b", t):
        return (True, None, None, "Free")
    nums = [float(x.replace(",", "")) for x in re.findall(r"\$\s?(\d[\d,]*(?:\.\d{1,2})?)", t)]
    if not nums:
        nums = [float(x) for x in re.findall(r"^\s*(\d+(?:\.\d{1,2})?)\s*(?:[-–]\s*(\d+(?:\.\d{1,2})?))?\s*$", t)[0] if x] if re.match(r"^\s*\d", t) else []
    nums = [n for n in nums if n > 0]
    if not nums: return None
    lo, hi = min(nums), max(nums)
    f = lambda v: ("$%d" % v) if v == int(v) else ("$%.2f" % v)
    txt = f(lo) if lo == hi else f"{f(lo)}–{f(hi)}"
    if re.search(r"(?i)from|starting|start at|\+", t) and lo == hi: txt = "From " + f(lo)
    return (False, lo, hi, txt)

# Approximate city centers (fallback coordinates when a source gives no lat/lng).
CITY = {
 "Miami":(25.7743,-80.1937,"Miami-Dade"),"Miami Beach":(25.7907,-80.1300,"Miami-Dade"),"North Miami":(25.8901,-80.1867,"Miami-Dade"),
 "North Miami Beach":(25.9331,-80.1625,"Miami-Dade"),"Coral Gables":(25.7215,-80.2684,"Miami-Dade"),"Doral":(25.8195,-80.3553,"Miami-Dade"),
 "Hialeah":(25.8576,-80.2781,"Miami-Dade"),"Homestead":(25.4687,-80.4776,"Miami-Dade"),"Key Biscayne":(25.6937,-80.1626,"Miami-Dade"),
 "Aventura":(25.9565,-80.1392,"Miami-Dade"),"Miami Gardens":(25.9420,-80.2456,"Miami-Dade"),"Surfside":(25.8785,-80.1256,"Miami-Dade"),
 "Sunny Isles Beach":(25.9506,-80.1229,"Miami-Dade"),"Cutler Bay":(25.5808,-80.3468,"Miami-Dade"),"Palmetto Bay":(25.6217,-80.3248,"Miami-Dade"),
 "Pinecrest":(25.6670,-80.3081,"Miami-Dade"),"South Miami":(25.7076,-80.2934,"Miami-Dade"),"Miami Lakes":(25.9087,-80.3087,"Miami-Dade"),
 "Fort Lauderdale":(26.1224,-80.1373,"Broward"),"Hollywood":(26.0112,-80.1495,"Broward"),"Pembroke Pines":(26.0078,-80.2963,"Broward"),
 "Coral Springs":(26.2712,-80.2706,"Broward"),"Davie":(26.0629,-80.2331,"Broward"),"Plantation":(26.1276,-80.2331,"Broward"),
 "Sunrise":(26.1670,-80.2560,"Broward"),"Miramar":(25.9873,-80.2323,"Broward"),"Pompano Beach":(26.2379,-80.1248,"Broward"),
 "Deerfield Beach":(26.3184,-80.0998,"Broward"),"Weston":(26.1004,-80.3998,"Broward"),"Dania Beach":(26.0523,-80.1439,"Broward"),
 "Hallandale Beach":(25.9812,-80.1484,"Broward"),"Lauderhill":(26.1404,-80.2134,"Broward"),"Tamarac":(26.2129,-80.2498,"Broward"),
 "Margate":(26.2445,-80.2064,"Broward"),"Coconut Creek":(26.2518,-80.1789,"Broward"),"Oakland Park":(26.1723,-80.1320,"Broward"),
 "Wilton Manors":(26.1604,-80.1389,"Broward"),"Lauderdale-by-the-Sea":(26.1920,-80.0964,"Broward"),"Parkland":(26.3101,-80.2373,"Broward"),
 "Cooper City":(26.0573,-80.2717,"Broward"),"Lighthouse Point":(26.2756,-80.0873,"Broward"),"Southwest Ranches":(26.0587,-80.3373,"Broward"),
 "West Palm Beach":(26.7153,-80.0534,"Palm Beach"),"Palm Beach":(26.7056,-80.0364,"Palm Beach"),"Boca Raton":(26.3683,-80.1289,"Palm Beach"),
 "Delray Beach":(26.4615,-80.0728,"Palm Beach"),"Boynton Beach":(26.5318,-80.0905,"Palm Beach"),"Lake Worth Beach":(26.6168,-80.0684,"Palm Beach"),
 "Lake Worth":(26.6168,-80.0684,"Palm Beach"),"Jupiter":(26.9342,-80.0942,"Palm Beach"),"Wellington":(26.6618,-80.2684,"Palm Beach"),
 "Palm Beach Gardens":(26.8234,-80.1387,"Palm Beach"),"Lantana":(26.5867,-80.0517,"Palm Beach"),"Royal Palm Beach":(26.7084,-80.2306,"Palm Beach"),
 "Greenacres":(26.6276,-80.1353,"Palm Beach"),"Riviera Beach":(26.7753,-80.0581,"Palm Beach"),"North Palm Beach":(26.8170,-80.0820,"Palm Beach"),
 "Tequesta":(26.9709,-80.1284,"Palm Beach"),"Juno Beach":(26.8798,-80.0534,"Palm Beach"),"Belle Glade":(26.6845,-80.6676,"Palm Beach"),
 "Loxahatchee":(26.6837,-80.2795,"Palm Beach"),"Palm Springs":(26.6359,-80.0962,"Palm Beach"),"Highland Beach":(26.3995,-80.0656,"Palm Beach"),
}
def city_from_text(*texts):
    """Find a known South Florida city name in address-ish text (longest match wins)."""
    t = " ".join(str(x or "") for x in texts)
    best = None
    for c in CITY:
        if re.search(r"\b" + re.escape(c) + r"\b", t, re.I) and (best is None or len(c) > len(best)):
            best = c
    return best

def make_event(**kw):
    """Fill defaults; fills county/lat/lng from CITY when missing."""
    e = {"title":"","dates":[],"start":None,"end":None,"venue":"","address":"","city":"","county":"","zip":None,
         "lat":None,"lng":None,"category":"Community","free":False,"price_min":None,"price_max":None,
         "price_text":"See details","desc":"","url":"","source":"","tags":[]}
    e.update({k: v for k, v in kw.items() if v is not None or k in ("start","end")})
    if e["city"] in CITY:
        la, ln, co = CITY[e["city"]]
        e["county"] = e["county"] or co
        if e["lat"] is None or e["lng"] is None: e["lat"], e["lng"] = la, ln
    if not e["zip"]:
        m = re.search(r"\b(3[34]\d{3})\b", e.get("address") or "")
        if m: e["zip"] = m.group(1)
    e["title"] = strip_html(e["title"], 140)
    e["desc"] = strip_html(e["desc"], 300)
    return e

CAT_RULES = [
  ("Markets", r"farmers'? market|green ?market|flea market|artisan market|night market|\bmarket\b|bazaar|pop-?up shop"),
  ("Film", r"\bmovies?\b|\bfilms?\b|cinema|screening|picture show"),
  ("Festivals & Fairs", r"festival|\bfest\b|\bfair\b|parade|tree lighting|menorah|holiday|halloween|trunk or treat|thanksgiving|hanukkah|chanukah|christmas|kwanzaa|new year|carnival|boat parade|winter wonderland|lights|d[ií]a de los muertos|day of the dead|celebration"),
  ("Sports & Fitness", r"\b5k\b|\b10k\b|turkey trot|marathon|\brun\b|\bruns\b|yoga|fitness|zumba|pickleball|golf|basketball|football|soccer|hockey|baseball|\bvs\.?\b|panthers|\bheat\b|dolphins|inter miami|tennis|cycling|bike ride|chess tournament|tournament|regatta|race\b"),
  ("Music", r"concert|music|jazz|symphony|orchestra|\bband\b|live music|\bdj\b|tour\b|singer|acoustic|reggae|salsa|\brock\b|hip hop|choir|philharmonic|tribute|piano|guitar|quartet|opera"),
  ("Comedy & Theater", r"comedy|comedian|stand-?up|theat|musical|broadway|\bplay\b|ballet|dance|improv|magic|drama|nutcracker|cirque|letters aloud"),
  ("Food & Drink", r"\bfood\b|wine|beer|tasting|brunch|culinary|chef|taco|bbq|cocktail|seafood|dinner"),
  ("Outdoors & Nature", r"nature|hike|kayak|paddle|garden|bird|beach clean|wildlife|preserve|trail|eco-?tour|sunset"),
  ("Arts & Culture", r"\bart\b|art ?walk|art ?fair|arts\b|gallery|museum|exhibit|artist|craft|paint|poetry|author|book|lecture|history|heritage|culture|graffiti|class\b|workshop"),
  ("Nightlife", r"\bparty\b|nightclub|club night|rooftop|happy hour|bar crawl|21\+"),
  ("Community", r"adoption|volunteer|open house|cleanup|clean-up|blood drive|veterans"),
]
def guess_category(title, desc="", hints=""):
    """Title decides first, then the source's own category words, then the description."""
    for text in (title, hints, desc):
        t = str(text or "").lower()
        if not t: continue
        for cat, rx in CAT_RULES:
            if re.search(rx, t): return cat
    return "Community"

def eid(e):
    return hashlib.sha1((e["title"].lower() + "|" + e["url"]).encode()).hexdigest()[:10]


# ---- Non-event exclusion (worker 178f4142, 2026-10-27): services/admin, not things to do ----
NON_EVENT = re.compile(r"""(?ix)
  \bFLOW\)|licens(e|ing)\s+on\s+wheels|\b(dmv|driver'?s?\s+licen[cs]e)\b|
  property\s+appraiser|tax\s+collector|\bTConnect\b|property\s+tax\s+info|
  congressional\s+district\s+mobile\s+office|mobile\s+office\b|information\s+session\b|
  contract\s+signing|advisory\s+(committee|board)|quarter(ly)?\s+meeting|
  food\s+(and\s+nutrition\s+)?distribution|meal\s+kits|bike\s+valet|
  \bpassport\b|\bnotary\b|tax\s+prep|\bjob\s+fair\b|\bhiring\b|\b(closed|closure|cancel+ed|postponed)\b|
  office\s+hours|staff\s+meeting|\btest\s+event\b
  |t-?connect\b|press\s+conference|homebound|e-?waste|shred(ding)?\s+(event|day)|(turkey|thanksgiving|food|toy|grocery)\s+giveaway|giveaway\s+drive|mobile\s+market|
  (commission|council|board|town\s+hall)\s+meeting|public\s+hearing|flu\s+shots?|vaccin(e|ation)\s+clinic
""")
def is_non_event(title):
    t = (title or "").strip()
    return (not t) or bool(NON_EVENT.search(t))


# Young-kids programs (storytimes, toddler/baby/preschool, kids' crafts...). Caz 2026-10-27: "no story times or little kid things".
# Mirrored verbatim as KIDS/KIDWORD/KIDKEEP in site/worker.mjs, build/sources.mjs and site/app.js.
KIDS = re.compile(r"""\bstory\s*-?\s*times?\b|\bstory\s*book\b|\bstor(y|ies)\s+(and|&|n)\s+crafts?\b|\bchildren'?s\s+stories\b|\bbab(y|ies)\b|\btoddlers?\b|\bpre-?school(ers?)?\b|\bpre-?k\b|\blap\s*-?sit\b|\brhyme\s*time\b|\bwiggles?\b|\bplay\s*-?groups?\b|\bmusic\s*(&|and)\s*movement\b|\btots?\b|\bmommy\s*(&|and|n'?)\s*me\b|\b(daddy|parent|caregiver|grownup)\s*(&|and)\s*me\b|\bhomework\b|\bpuppets?\b|\blego\b|\bstea?m\s+(day|lab|spot|saturday|club|camp)\b|\btweens?\b|\bteenie\b|\bmini\s+picassos?\b|\blittle\s+(ones?|monsters?|learners?|explorers?|readers?|artists?|scientists?|chefs?|makers?)\b|\bmonster\s+makers?\b|\bjunior\s+(rangers?|environmental|chefs?|scientists?)\b|\bhandprint\b|\bslime\b|(?<!adult\s)\bcoloring\b|\bmarci\s+poppins?\b|\btalking\s+is\s+teaching\b|\bready,?\s*set,?\s*go\b|\bsigning\s+stories\b|\bharmony\s+hugs\b|\bpopcorn\s+pals\b|\bfairy\s*tale\s+characters?\b|\bnot[-\s](so|too)[-\s]spooky\b|\bfamily\s+(movie|film|fun\s+film|coloring|gardening|craft|game)s?\b|\bmagic\s+school\s+bus\b|\btrunk[-\s]or[-\s]treat\b|\btrick[-\s]or[-\s]treat(?!\s+for\s+teens)|\bbreakfast\s+with\s+santa\b|\bbricks,?\s+bots\b|\bimagination\s+exploration\b|\bpaint-?ology\b|\bscience\s+explorium\b|\b(thanksgiving|halloween|turkey|pumpkin|fall|pizza\s+day|holiday)\s+craft\b|\bcraft\s*time\b|\bcrafternoons?\b|\bpumpkin\s+patty|\baesop\b|\bgrades?\s*(k|pre-?k|[1-5])\b|\bages?\s*[0-9](?![0-9])""", re.I)
KIDWORD = re.compile(r"""\bkids?\b|\bkid'?s\b|\bchild(ren)?(['’]?s)?\b""", re.I)
KIDKEEP = re.compile(r"""\bvs\.?\s|\bfestival\b|\bfair\b|\bparade\b|\bconcert\b|\bsymphony\b""", re.I)
def is_young_kids(title):
    t = str(title or "")
    return bool(KIDS.search(t) or (KIDWORD.search(t) and not KIDKEEP.search(t)))
def is_excluded(title):
    return is_non_event(title) or is_young_kids(title)
