"""Hard Rock Live / Seminole Hard Rock Hollywood — events list cards + each show page's "Tickets starting at $X"."""
import sys, os, re, html, datetime as dt, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from concurrent.futures import ThreadPoolExecutor

SOURCE = "hardrock"
BASE = "https://casino.hardrock.com"
LIST = BASE + "/hollywood/events"
ADDR = dict(address="1 Seminole Way, Hollywood, FL 33314", city="Hollywood", county="Broward", zip="33314",
            lat=26.0511, lng=-80.2110)
MONTHS = {m: i for i, m in enumerate(["january","february","march","april","may","june","july","august",
                                      "september","october","november","december"], 1)}
DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]

def _t(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def _date(label, today):
    """'Thursday, November 5 | 7:30PM' -> (date, '19:30'); year chosen so the weekday printed on the page matches."""
    m = re.search(r"(?i)(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+([a-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?", label)
    if not m or m.group(2).lower() not in MONTHS: return None, None
    wd, mo, dd = DAYS.index(m.group(1).lower()), MONTHS[m.group(2).lower()], int(m.group(3))
    years = [int(m.group(4))] if m.group(4) else [today.year, today.year + 1]
    for y in years:
        try: d = dt.date(y, mo, dd)
        except ValueError: continue
        if d.weekday() == wd and d >= today - dt.timedelta(days=1): return d, common.hhmm(label.split("|", 1)[-1])
    return None, None

def _show(slug):
    url = f"{BASE}/en/hollywood/events/{slug}"
    try: s = common.get(url, timeout=20, tries=2)
    except Exception as e:
        print(f"[hardrock] show page failed {slug}: {e}", file=sys.stderr); return slug, None, ""
    m = re.search(r"(?i)tickets?\s+start(?:ing)?\s+(?:at|from)\s+\$\s?(\d[\d,]*(?:\.\d\d)?)", _t(s))
    price = float(m.group(1).replace(",", "")) if m else None
    d = re.search(r'<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"', s)
    return slug, price, _t(d.group(1)) if d else ""

def fetch(start, end):
    t0 = time.time(); today = dt.date.today()
    page = common.get(LIST, timeout=30, tries=2)
    cards = re.split(r'<div class="ccard jsCard eventCard', page)[1:]
    if not cards: raise RuntimeError("hardrock: no event cards on list page")
    shows = {}   # slug -> dict(title, cats, venue, occurrences{date: time}, tm)
    for cd in cards:
        sm = re.search(r'href="/[a-z]{2}(?:-[a-z]{2})?/hollywood/events/([^"/?#]+)"', cd)
        tm = re.search(r'ccard--event__title[^>]*>(.*?)</h2>', cd, re.S)
        wm = re.search(r'ccard--event__time__wrap">(.*?)</div>', cd, re.S)
        if not (sm and tm and wm): continue
        d, hm = _date(_t(wm.group(1)), today)
        if not d or not (start <= d <= end): continue
        s = shows.setdefault(sm.group(1), {"title": _t(tm.group(1)), "occ": {}, "venue": "", "cats": ""})
        s["occ"].setdefault(d, hm)
        v = re.search(r'ccard--event__venue">(.*?)<', cd); c = re.search(r'ccard--event__categories"[^>]*>(.*?)<', cd)
        s["venue"] = s["venue"] or (_t(v.group(1)) if v else "")
        s["cats"] = s["cats"] or (_t(c.group(1)) if c else "")
    with ThreadPoolExecutor(6) as ex:
        details = {slug: (p, desc) for slug, p, desc in ex.map(_show, list(shows))}
    out = []
    for slug, s in shows.items():
        title = s["title"]
        if common.is_junk(title) or not s["occ"]: continue
        cats = s["cats"].lower()
        if "comedy" in cats or re.search(r"(?i)comed", title): cat = "Comedy & Theater"
        elif re.search(r"theat|broadway|musical|family show", cats): cat = "Comedy & Theater"
        elif re.search(r"sport|fight|boxing|mma|wrestling", cats) or re.search(r"(?i)fight|boxing|wrestling", title): cat = "Sports & Fitness"
        elif re.search(r"concert|music|rock|latin|country|pop|classical|r&b|hip", cats): cat = "Music"
        else: cat = common.guess_category(title, details.get(slug, (None, ""))[1], s["cats"])
        price, desc = details.get(slug, (None, ""))
        if price: pmin, ptxt = price, "From " + (("$%d" % price) if price == int(price) else ("$%.2f" % price))
        else: pmin, ptxt = None, "See tickets"
        # one record per distinct start time (usually all the same)
        by_time = {}
        for d, hm in sorted(s["occ"].items()): by_time.setdefault(hm, []).append(d.isoformat())
        for hm, dates in by_time.items():
            out.append(common.make_event(
                title=title, dates=dates, start=hm, end=None, venue=s["venue"] or "Hard Rock Live", **ADDR,
                category=cat, free=False, price_min=pmin, price_max=None, price_text=ptxt,
                desc=desc or f"{title} live at {s['venue'] or 'Hard Rock Live'}, Seminole Hard Rock Hollywood.",
                url=f"{BASE}/en/hollywood/events/{slug}", source="casino.hardrock.com",
                tags=["night"] if hm and int(hm[:2]) >= 18 else []))
    print(f"[hardrock] {len(cards)} cards, {len(shows)} shows, {len(out)} events, {time.time()-t0:.0f}s", file=sys.stderr)
    return out
