"""Venue calendars with cheap structure.
  - Vizcaya Museum & Gardens (vizcaya.org/events/ JSON-LD). NOTE: Vizcaya's JSON-LD times are offset-shifted
    (an evening event shows 13:30-05:00), so times are NOT used — dates only.
  - Amerant Bank Arena, Sunrise (same CMS as Kaseya Center: events_ajax list + detail-page Event JSON-LD).
Skipped (see report): Broward Center (no JSON-LD / tribe API returns HTML), Arsht & Norton (/events 404), Fillmore,
Seminole Coconut Creek, Coral Springs, Fort Lauderdale parks (HTML only, no structured data)."""
import sys, os, re, json, html, datetime as dt, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from concurrent.futures import ThreadPoolExecutor

SOURCE = "venues"

def _t(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def _ld_events(page):
    out = []
    for blob in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        try: j = json.loads(blob)
        except Exception: continue
        for x in (j if isinstance(j, list) else [j]):
            if isinstance(x, dict) and x.get("@type") == "Event": out.append(x)
    return out

# ---------------- Vizcaya ----------------
VIZ = dict(venue="Vizcaya Museum & Gardens", address="3251 S Miami Ave, Miami, FL 33129", city="Miami",
           county="Miami-Dade", zip="33129", lat=25.7443, lng=-80.2104)
VIZ_SKIP = re.compile(r"(?i)member|members|donor|patron|private|closed|sold out|staff|volunteer orientation")

def vizcaya(start, end):
    pages = ["https://vizcaya.org/events/"]
    evs = []
    for u in pages:
        evs += _ld_events(common.get(u, timeout=25, tries=2))
    groups = {}
    for x in evs:
        title = _t(x.get("name"))
        offers = x.get("offers") if isinstance(x.get("offers"), dict) else {}
        ptxt_raw = str(offers.get("price") or "").strip()
        if not title or VIZ_SKIP.search(title) or VIZ_SKIP.search(ptxt_raw) or common.is_junk(title): continue
        if re.search(r"(?i)cancel|postpon", x.get("eventStatus") or ""): continue
        try: d = dt.date.fromisoformat(str(x["startDate"])[:10])
        except Exception: continue
        if not (start <= d <= end) or d < dt.date.today(): continue
        url = html.unescape(x.get("url") or "")      # exact URL as published (first occurrence kept per series)
        pr = common.price_from_text(ptxt_raw if re.search(r"(?i)free|\$", ptxt_raw) else (("$" + ptxt_raw) if re.fullmatch(r"\d+(\.\d\d)?", ptxt_raw) else ptxt_raw))
        if pr: free, pmin, pmax, ptxt = pr
        else: free, pmin, pmax, ptxt = False, None, None, "See tickets"
        key = title.lower()
        g = groups.setdefault(key, dict(title=title, url=url, dates=set(), free=free, pmin=pmin, pmax=pmax, ptxt=ptxt,
                                        desc=_t(x.get("description"))))
        g["dates"].add(d.isoformat())
        if d.isoformat() == min(g["dates"]): g["url"] = url
    out = []
    for g in groups.values():
        t = g["title"]
        if re.search(r"(?i)market", t): cat = "Markets"
        elif re.search(r"(?i)yoga|wellness|fitness", t): cat = "Sports & Fitness"
        elif re.search(r"(?i)film|screening|movie", t): cat = "Film"
        elif re.search(r"(?i)garden|orchid|nature|bird", t): cat = "Outdoors & Nature"
        elif re.search(r"(?i)concert|music|jazz", t): cat = "Music"
        elif re.search(r"(?i)kids|family|children", t): cat = "Family & Kids"
        else: cat = "Arts & Culture"
        out.append(common.make_event(title=t, dates=sorted(g["dates"]), start=None, end=None, **VIZ, category=cat,
                   free=g["free"], price_min=g["pmin"], price_max=g["pmax"], price_text=g["ptxt"],
                   desc=g["desc"] or f"{t} at Vizcaya Museum & Gardens.", url=g["url"],
                   source=re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", g["url"]) or "vizcaya.org",
                   tags=(["free"] if g["free"] else []) + (["outdoor"] if cat in ("Markets", "Outdoors & Nature") else [])))
    return out

# ---------------- Amerant Bank Arena (Sunrise) ----------------
ABA = "https://www.amerantbankarena.com"
ABA_V = dict(venue="Amerant Bank Arena", address="1 Panther Pkwy, Sunrise, FL 33323", city="Sunrise", county="Broward",
             zip="33323", lat=26.1584, lng=-80.3256)
ABA_SKIP = re.compile(r"(?i)arena tour|seminar|graduation|commencement|job fair|career fair|parking|suite|private event|"
                      r"conference|business forum|expo\b|preseason open practice|season ticket")

MON = {m: i for i, m in enumerate(["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"], 1)}

def _aba_detail(u):
    try: return u, _t(common.get(u, timeout=20, tries=2))
    except Exception as e:
        print(f"[venues] amerant detail failed {u}: {e}", file=sys.stderr); return u, ""

def _aba_dates(text):
    """'Date Oct 30 , 2026' or 'Date Nov 20 - 21 , 2026' or 'Date Dec 30 - Jan 2 , 2027' (the page's own label)."""
    m = re.search(r"\bDate\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s*-\s*(?:([A-Z][a-z]{2})\s+)?(\d{1,2}))?\s*,\s*(\d{4})", text)
    if not m or m.group(1).lower() not in MON: return []
    y = int(m.group(5)); m1 = MON[m.group(1).lower()]
    try:
        if not m.group(4): return [dt.date(y, m1, int(m.group(2)))]
        m2 = MON.get((m.group(3) or m.group(1)).lower(), m1)
        d2 = dt.date(y, m2, int(m.group(4))); d1 = dt.date(y if m1 <= m2 else y - 1, m1, int(m.group(2)))
        return list(common.daterange(d1, d2)) if (d2 - d1).days <= 7 else []
    except ValueError: return []

def amerant(start, end):
    items = {}
    for page in range(12):
        try: raw = common.get(f"{ABA}/events/events_ajax/{page*12}?category=0&venue=0&team=0&per_page=12&came_from_page=event-list-page", timeout=20, tries=2)
        except Exception as e:
            if page == 0: raise
            break
        try: h = json.loads(raw)
        except Exception: h = raw
        h = h.replace("\\/", "/")
        found = 0
        for it in h.split('class="eventItem')[1:]:
            m = re.search(r'href="(https://www\.amerantbankarena\.com/events/detail/[^"]+)"[^>]*title="More Info for ([^"]+)"', it)
            if not m or m.group(1) in items: continue
            tg = re.search(r'class="tagline"[^>]*>(.*?)</h4>', it, re.S)
            items[m.group(1)] = (html.unescape(m.group(2)).strip(), _t(tg.group(1)) if tg else "", "florida_panthers" in it[:200])
            found += 1
        if not found: break
    with ThreadPoolExecutor(6) as ex: details = dict(ex.map(_aba_detail, list(items)))
    out = []
    for u, (title, tagline, panthers) in items.items():
        text = details.get(u, "")
        if not text or ABA_SKIP.search(title) or common.is_junk(title) or re.search(r"(?i)\b(cancel+ed|postponed)\b", title): continue
        dates = [d.isoformat() for d in _aba_dates(text) if start <= d <= end and d >= dt.date.today()]
        if not dates: continue
        tm = re.search(r"Event Starts\s+(\d{1,2}:\d{2}\s*[AP]M)", text, re.I)
        st = common.hhmm(tm.group(1)) if tm else None
        title = re.sub(r"(?i)\s*[-–]\s*(new date|rescheduled)\s*$", "", title)
        if (panthers or re.search(r"\bvs\b", title)) and re.search(r"(?i)\bvs\b", tagline) and len(tagline) < 70:
            theme = title.split(":", 1)[0].strip() if ":" in title else ""
            title = tagline + (f" ({theme})" if theme else "")
        blob = f"{title} {tagline}"
        if panthers or re.search(r"(?i)\bfla\b|panthers", blob): cat = "Sports & Fitness"
        elif re.search(r"(?i)comed|stand-?up|improv", blob): cat = "Comedy & Theater"
        elif re.search(r"(?i)disney on ice|monster|circus|cirque|paw patrol|sesame|bluey|globetrotters|jam\b", blob): cat = "Family & Kids"
        elif re.search(r"(?i)\bufc\b|wwe|boxing|wrestling|basketball|hockey|tennis|\bvs\.?\b", blob): cat = "Sports & Fitness"
        else: cat = "Music"
        out.append(common.make_event(title=title, dates=dates, start=st, end=None, **ABA_V, category=cat, free=False,
                   price_min=None, price_max=None, price_text="See tickets",
                   desc=(tagline + ". " if tagline else "") + f"At Amerant Bank Arena, Sunrise.", url=u,
                   source="amerantbankarena.com",
                   tags=(["night"] if st and int(st[:2]) >= 18 else []) + (["family"] if cat == "Family & Kids" else [])))
    return out

SUBS = [("vizcaya", vizcaya), ("amerant", amerant)]

def fetch(start, end):
    t0 = time.time(); out = []; ok = 0
    with ThreadPoolExecutor(len(SUBS)) as ex:
        futs = {name: ex.submit(fn, start, end) for name, fn in SUBS}
        for name, f in futs.items():
            try:
                r = f.result(timeout=85); out += r; ok += 1
                print(f"[venues] {name}: {len(r)}", file=sys.stderr)
            except Exception as e:
                print(f"[venues] {name} failed: {e}", file=sys.stderr)
    if ok == 0: raise RuntimeError("venues: every venue failed")
    print(f"[venues] total {len(out)}, {time.time()-t0:.0f}s", file=sys.stderr)
    return out
