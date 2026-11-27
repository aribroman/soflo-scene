"""Eventbrite city discovery pages -> event ids (JSON-LD + __SERVER_DATA__), then Eventbrite's own
destination API (same one the site uses) for venue + ticket_availability (prices / is_free)."""
import sys, os, re, json, datetime as dt, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from concurrent.futures import ThreadPoolExecutor

SOURCE = "eventbrite"
CITIES = ["fl--miami", "fl--miami-beach", "fl--fort-lauderdale", "fl--hollywood", "fl--west-palm-beach",
          "fl--boca-raton", "fl--delray-beach", "fl--jupiter", "fl--coral-gables", "fl--pompano-beach"]
API = ("https://www.eventbrite.com/api/v3/destination/events/?event_ids={ids}"
       "&expand=event_sales_status,primary_venue,ticket_availability&page_size=50")

def zip_county(z):
    try: z = int(str(z)[:5])
    except Exception: return None
    if z in (33070,) or 33036 <= z <= 33052 or z == 33001: return None          # Monroe (Keys)
    if 33441 <= z <= 33443 or z in (33004, 33009) or 33019 <= z <= 33029 or 33060 <= z <= 33077 \
       or 33081 <= z <= 33084 or 33301 <= z <= 33394: return "Broward"
    if 33401 <= z <= 33499: return "Palm Beach"
    if 33010 <= z <= 33018 or 33030 <= z <= 33035 or 33054 <= z <= 33056 or 33090 <= z <= 33299: return "Miami-Dade"
    return None

SPAM = re.compile(r"(?i)\b(networking|webinar|seminar|real estate|realtor|investor|investing|investment|mlm|"
                  r"speed ?dating|singles mixer|masterclass|master class|business|entrepreneur|startup|start-up|"
                  r"wealth|crypto|bitcoin|forex|trading|passive income|make money|side hustle|career fair|job fair|"
                  r"hiring event|guest ?list|bottle service|vip table|table service|free entry|free admission with rsvp|"
                  r"rsvp (for|to get) free|every (night|friday|saturday|sunday|thursday|week)|ladies free|ladies[\s-]?night|bachelor(ette)?|male revue|dinner with (new )?friends|find my tribe|launch night|"
                  r"open bar|party bus|boat party pass|yacht party|pool party pass|(online)|virtual|zoom|"
                  r"certification|ceu|cpr|license|licensing|credit repair|insurance|medicare|mortgage|home ?buyer|"
                  r"aesthetics|botox|trade mission|prenatal|breastfeeding|room packages?|hotel package|grand opening|hospital|open house|info session|information session|orientation|summit|conference|expo for|leads)\b")
DROP_CATS = {"Business & Professional", "Science & Technology", "Government & Politics"}
DROP_FORMATS = {"Networking event", "Conference", "Convention", "Seminar or Talk"}

CAT_MAP = {"Music": "Music", "Food & Drink": "Food & Drink", "Film, Media & Entertainment": "Film",
           "Sports & Fitness": "Sports & Fitness", "Health & Wellness": "Sports & Fitness",
           "Family & Education": "Family & Kids", "Seasonal & Holiday": "Festivals & Fairs",
           "Community & Culture": "Community", "Charity & Causes": "Community", "Travel & Outdoor": "Outdoors & Nature",
           "Fashion & Beauty": "Arts & Culture"}

def cat_guess(title, desc="", hints=""):
    """common.guess_category with a guard: its 'heat' (Miami Heat) rule also matches 'theater'."""
    t = f"{title} {desc}"
    if re.search(r"(?i)theat|improv|comed|stand-?up|musical|broadway|\bplay(house)?\b|ballet|opera", title):
        return "Comedy & Theater"
    c = common.guess_category(title, desc, hints)
    if c == "Sports & Fitness" and not re.search(r"(?i)\b(5k|10k|run|race|yoga|pilates|fitness|sound bath|meditation|breathwork|"
            r"pickleball|golf|polo|football|soccer|basketball|hockey|baseball|tennis|bowl|panthers|dolphins|heat|walk|"
            r"skate|rollerblad|cycl|bike|hyrox|workout|sculpt|zumba|wellness|match|game)\b", t):
        c = common.guess_category(re.sub(r"(?i)\bvs\.?\b", "", title), re.sub(r"(?i)\bvs\.?\b|theat\w*|heat", "", desc), hints)
        if c == "Sports & Fitness": c = "Community"
    if c == "Festivals & Fairs":
        if re.search(r"(?i)food festival|feast|food fest|wine fest|beer fest", title): c = "Food & Drink"
        elif re.search(r"(?i)bar crawl|party|costume|soir[eé]e|gala|rave|masquerade", title) and not re.search(
                r"(?i)festival|\bfest\b|parade|block party|community|family|kids|haunted house|trunk", title): c = "Nightlife"
    if c == "Sports & Fitness" and re.search(r"(?i)theat", t) and not re.search(r"(?i)\bheat\b", t):
        c = common.guess_category(title.replace("heat", ""), re.sub(r"(?i)theat", "stage", desc), hints)
    return c

def allcaps(t):
    letters = [c for c in t if c.isalpha()]
    return len(letters) >= 12 and sum(c.isupper() for c in letters) / len(letters) > 0.85

def _ids_from_page(html):
    ids = set()
    for blob in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        for m in re.finditer(r'eventbrite\.com/e/[^"?\s]*?-(\d{9,})', blob): ids.add(m.group(1))
    i = html.find("__SERVER_DATA__ = ")
    if i >= 0:
        for m in re.finditer(r'"eventbrite_event_id"\s*:\s*"(\d{9,})"', html[i:i + 3_000_000]): ids.add(m.group(1))
    return ids

_429 = [0]
def _page(url):
    if _429[0] >= 4: return None          # Eventbrite is rate-limiting this box; stop hammering, fail fast
    for i in range(2):
        try: return _ids_from_page(common.get(url, timeout=20, tries=1))
        except Exception as e:
            if "429" in str(e):
                _429[0] += 1
                if i == 0 and _429[0] < 4: time.sleep(6); continue
            print(f"[eventbrite] page failed {url}: {e}", file=sys.stderr); return None

def _api(batch):
    try: return common.get(API.format(ids=",".join(batch)), timeout=25, tries=2, as_json=True).get("events", [])
    except Exception as e:
        print(f"[eventbrite] api failed: {e}", file=sys.stderr); return []

def _money(p):
    if not p or (p.get("currency") or "USD") != "USD": return None
    try: return float(p.get("major_value"))
    except Exception: return None

def _fmt(v): return ("$%d" % v) if v == int(v) else ("$%.2f" % v)

def _build(ev, start, end):
    title = (ev.get("name") or "").strip()
    if not title or ev.get("is_online_event") or ev.get("is_cancelled") or ev.get("status") not in (None, "live", "started"):
        return None
    tags = ev.get("tags") or []
    ebcats = {t.get("display_name") for t in tags if t.get("prefix") == "EventbriteCategory"}
    formats = {t.get("display_name") for t in tags if t.get("prefix") == "EventbriteFormat"}
    summary = ev.get("summary") or ""
    if ebcats & DROP_CATS or formats & DROP_FORMATS: return None
    if SPAM.search(title) or SPAM.search(summary) or allcaps(title) or common.is_junk(title, summary): return None
    if re.search(r"(?i)\bclass\b|workshop|training|course|bootcamp|coaching", title) and not re.search(
            r"(?i)cook|paint|art|dance|yoga|pottery|kids|family|wine|craft|music|candle|flower|floral", title): return None
    v = ev.get("primary_venue") or {}
    a = v.get("address") or {}
    if (a.get("country") or "US") != "US" or (a.get("region") or "FL") != "FL": return None
    county = zip_county(a.get("postal_code"))
    city = common.city_from_text(a.get("city")) or (a.get("city") or "").strip()
    if city in common.CITY: county = county or common.CITY[city][2]
    if county not in ("Miami-Dade", "Broward", "Palm Beach"): return None
    try:
        sd = dt.date.fromisoformat(ev["start_date"]); ed = dt.date.fromisoformat(ev.get("end_date") or ev["start_date"])
    except Exception: return None
    if (ed - sd).days > 30: return None
    st, et = ev.get("start_time"), ev.get("end_time")
    if (ed - sd).days <= 1:      # single day (possibly running past midnight)
        dates = [sd]
    else:
        dates = list(common.daterange(sd, ed))
    dates = [d.isoformat() for d in dates if start <= d <= end and d >= dt.date.today()]
    if not dates: return None
    ta = ev.get("ticket_availability") or {}
    lo, hi = _money(ta.get("minimum_ticket_price")), _money(ta.get("maximum_ticket_price"))
    free, pmin, pmax, ptxt = False, None, None, "See tickets"
    if ta.get("is_free") is True:
        free, ptxt = True, "Free"
    elif hi is not None and hi > 0:
        lo = lo or 0.0
        pmin, pmax = lo, hi
        ptxt = (_fmt(hi) if lo == hi else (f"Free–{_fmt(hi)}" if lo == 0 else f"{_fmt(lo)}–{_fmt(hi)}"))
    if ta.get("is_sold_out"): ptxt += " · Sold out"
    hints = " ".join(ebcats | formats | {t.get("display_name", "") for t in tags if t.get("prefix") == "EventbriteSubCategory"})
    cat = cat_guess(title, summary, hints)
    mapped = next((CAT_MAP[c] for c in ebcats if c in CAT_MAP), None)
    if cat == "Community" and mapped: cat = mapped
    if "Performing & Visual Arts" in ebcats and cat in ("Community", "Nightlife"): cat = "Comedy & Theater" if re.search(r"(?i)comed|theat|play|danc", title + summary) else "Arts & Culture"
    if "Party or Social Gathering" in formats and cat == "Community": cat = "Nightlife"
    etags = []
    if free: etags.append("free")
    if st and int(st[:2]) >= 19: etags.append("night")
    if re.search(r"(?i)21\+|21 and over", title + summary): etags.append("21+")
    if cat == "Family & Kids" or re.search(r"(?i)\bkids?\b|family", title + summary): etags.append("family")
    try: lat, lng = float(a.get("latitude")), float(a.get("longitude"))
    except Exception: lat = lng = None
    return common.make_event(
        title=title, dates=dates, start=common.hhmm(st), end=common.hhmm(et) if et else None,
        venue=(v.get("name") or "").strip(), address=a.get("localized_address_display") or "",
        city=city, county=county, zip=a.get("postal_code"), lat=lat, lng=lng, category=cat,
        free=free, price_min=pmin, price_max=pmax, price_text=ptxt, desc=summary,
        url=(ev.get("url") or "").split("?")[0], source="eventbrite.com", tags=etags)

def fetch(start, end):
    t0 = time.time()
    urls = []
    for c in CITIES:
        base = f"https://www.eventbrite.com/d/{c}/events/"
        urls += [base, base + "?page=2", base + "?page=3", f"https://www.eventbrite.com/d/{c}/free--events/"]
    ids, ok = set(), 0
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(_page, urls):
            if r is not None: ok += 1; ids |= r
    if ok == 0: raise RuntimeError("eventbrite: every discovery page failed")
    ids = sorted(ids)
    batches = [ids[i:i + 40] for i in range(0, len(ids), 40)]
    raw = []
    with ThreadPoolExecutor(6) as ex:
        for evs in ex.map(_api, batches): raw += evs
    if ids and not raw: raise RuntimeError("eventbrite: destination API returned nothing")
    out, seen = [], set()
    for ev in raw:
        e = _build(ev, start, end)
        if not e: continue
        k = (e["title"].lower(), e["dates"][0])
        if k in seen: continue
        seen.add(k); out.append(e)
    print(f"[eventbrite] {ok}/{len(urls)} pages, {len(ids)} ids, {len(raw)} api rows, {len(out)} kept, {time.time()-t0:.0f}s", file=sys.stderr)
    return out
