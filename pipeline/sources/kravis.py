
"""Kravis Center (West Palm Beach) — its own performances-by-month JSON API."""
import sys, os, re, json, html, datetime as dt
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from common import make_event, strip_html, guess_category

SOURCE = "kravis"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENUE = ("Kravis Center for the Performing Arts", "701 Okeechobee Blvd, West Palm Beach, FL 33401", 26.7080, -80.0606)

def _known_prices():
    """Prices a person or worker already confirmed on the Kravis pages (picks + research), keyed by URL."""
    known = {}
    for p in [os.path.join(HERE, "picks.json"), os.path.join(HERE, "known_prices.json")]:
        try:
            for e in json.load(open(p)):
                if "kravis.org" in (e.get("url") or ""):
                    known[e["url"].rstrip("/")] = (e.get("free"), e.get("price_min"), e.get("price_max"), e.get("price_text"))
        except Exception: pass
    return known

def _months(start, end):
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield f"{y}-{m:02d}"
        m += 1
        if m > 12: y, m = y + 1, 1

def _page_price(url):
    try:
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", common.get(url, timeout=25))))
    except Exception:
        return None, ""
    if re.search(r"This is a free event", t, re.I): return (True, None, None, "Free"), t
    m = re.search(r"Pricing (.{0,200}?)(Event Time|Share This Event|Group Sales)", t)
    if m:
        pr = common.price_from_text(m.group(1))
        if pr: return pr, t
    return None, t

def fetch(start, end):
    perfs = {}
    for ym in _months(start, end):
        j = common.get(f"https://www.kravis.org/wp-json/kravis/v1/performances-by-month?date={ym}", as_json=True, timeout=30)
        for p in (j.get("data") or {}).get("performances") or []:
            q = perfs.setdefault(p["link"], {"title": p["title"], "loc": p.get("location") or "", "dates": set(), "times": set()})
            for d in p.get("dates") or []:
                m = re.match(r"\w+, (\w+ \d+ \d{4}) @ (\d{1,2}:\d{2}\s*[ap]m)", d.get("date") or "", re.I)
                if not m: continue
                day = dt.datetime.strptime(m.group(1), "%b %d %Y").date()
                if start <= day <= end:
                    q["dates"].add(day.isoformat()); q["times"].add(common.hhmm(m.group(2)))
    known = _known_prices()
    links = [l for l, q in perfs.items() if q["dates"]]
    with ThreadPoolExecutor(8) as ex:
        pages = dict(zip(links, ex.map(_page_price, links)))
    out = []
    for link, q in perfs.items():
        if not q["dates"] or len(q["dates"]) > 20: continue      # daily pop-up series are not single events
        if "Gimelstob" in q["loc"] or "Rehearsal Hall" in q["loc"]: continue   # lecture luncheons / classes
        title = strip_html(html.unescape(q["title"].replace("</br>", " ").replace("<br>", " ")), 140)
        title = re.sub(r"\s+", " ", title).strip()
        if title.isupper(): title = title.title().replace("'S ", "'s ").replace("’S ", "’s ")
        if common.is_junk(title) or re.search(r"gala|luncheon|member|donor|subscription|camp\b|class\b|workshop", title, re.I): continue
        pr, text = pages.get(link, (None, ""))
        if not pr and link.rstrip("/") in known:
            f, a, b, t = known[link.rstrip("/")]
            pr = (bool(f), a, b, t)
        free, pmin, pmax, ptxt = pr if pr else (False, None, None, "See tickets")
        m = re.search(r"(?:Share This Event|Event Time[^.]{0,60}?(?:am|pm))\s*(.{40,400}?)(?:Previous slide|Pricing|$)", text)
        desc = ""
        dm = re.search(r"<meta name=\"description\" content=\"([^\"]+)\"", "")
        times = sorted(t for t in q["times"] if t)
        out.append(make_event(title=title, dates=sorted(q["dates"]), start=times[0] if len(times) == 1 else (times[0] if times else None), end=None,
                              venue=VENUE[0] + (f" · {strip_html(q['loc'])}" if q["loc"] and "Kravis" not in q["loc"] else ""),
                              address=VENUE[1], city="West Palm Beach", lat=VENUE[2], lng=VENUE[3],
                              category=("Music" if "Live & Social" in title else (lambda c: "Comedy & Theater" if c == "Community" else c)(guess_category(title))), free=free, price_min=pmin, price_max=pmax, price_text=ptxt,
                              desc=(f"At the Kravis Center ({strip_html(q['loc'])})." if q["loc"] else "At the Kravis Center.") + (" Several showtimes." if len(times) > 1 else ""),
                              url=link, source="kravis.org", tags=(["free", "outdoor"] if free and "Plaza" in q["loc"] else [])))
    return out
