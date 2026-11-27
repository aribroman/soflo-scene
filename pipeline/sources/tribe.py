
"""The Events Calendar (tribe) WordPress REST feeds — Miami Beach city, Bandshell, Downtown WPB, Wynwood, Frost Science, Arts Garage."""
import sys, os, re, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from common import strip_html, make_event, price_from_text, guess_category, hhmm

SOURCE = "tribe"

SITES = [
  # base, default city, default venue/address for events without a venue, county, ticketed?, filter fn name
  dict(id="miamibeachfl", base="https://events.miamibeachfl.gov", city="Miami Beach", ticketed=False,
       drop_cats={"City Government","Senior Programming","Procurement","Economic Development"},
       drop_title=r"for seniors|\(UN\)|\(FL\)|\(NS\)|water aerobics|homeschool|afterschool|after-school|maker club|enrichment|responses due|rfq|rfp|committee|board\b|workshop|fablab\s*:?\s*$|chair yoga|tai chi|calisthenics|early voting"),
  dict(id="bandshell", base="https://miamibeachbandshell.com", city="Miami Beach", ticketed=True,
       venue=("North Beach Bandshell","7275 Collins Ave, Miami Beach, FL 33141",25.8573,-80.1209)),
  dict(id="downtownwpb", base="https://downtownwpb.com", city="West Palm Beach", ticketed=False,
       drop_title=r"run crew|morning run|run club|bootcamp|boot camp|happy hour|trivia night|karaoke|bingo"),
  dict(id="wynwood", base="https://wynwoodmiami.com", city="Miami", ticketed=False,
       keep_cats={"Art","Family + Community","Festivals + Markets","Music","Fitness + Wellness","Film","Fashion","Nightlife"},
       drop_title=r"taco tuesday|game day|brunch|happy hour|watch party|trivia|karaoke|bottomless|ladies night|industry night|\$\d+ (tacos|margaritas|drinks)"),
  dict(id="frost", base="https://www.frostscience.org", city="Miami", ticketed=True,
       venue=("Frost Museum of Science","1101 Biscayne Blvd, Miami, FL 33132",25.7853,-80.1878),
       drop_title=r"member|tech lab|professional|symposium|designation|camp\b|session \d"),
  dict(id="artsgarage", base="https://www.artsgarage.org", city="Delray Beach", ticketed=True,
       venue=("Arts Garage","94 NE 2nd Ave, Delray Beach, FL 33444",26.4628,-80.0710),
       drop_title=r"senior series"),
]

CATMAP = [(r"music|concert|jazz|tribute|soul|rock|salsa", "Music"), (r"film|movie|cinema", "Film"),
          (r"comedy|theat|open mic|improv|drama|dance", "Comedy & Theater"), (r"market", "Markets"),
          (r"family|kids", "Family & Kids"), (r"food|drink", "Food & Drink"), (r"fitness|wellness|sport|outdoor", "Sports & Fitness"),
          (r"festival|holiday", "Festivals & Fairs"), (r"art|culture|museum|exhibit", "Arts & Culture"), (r"nightlife", "Nightlife")]

def _cat(title, desc, cats):
    g = guess_category(title, "", "")
    if g != "Community": return g
    cs = " ".join(cats).lower()
    for rx, c in CATMAP:
        if re.search(rx, cs): return c
    return guess_category(title, desc)

def _pages(base, start, end, maxpages=14):
    out, p = [], 1
    while p <= maxpages:
        j = common.get(f"{base}/wp-json/tribe/events/v1/events?start_date={start}&end_date={end}&per_page=50&page={p}", as_json=True, timeout=40)
        out += j.get("events", [])
        if p >= int(j.get("total_pages") or 1): break
        p += 1
    return out

def _one(site, e, start, end):
    title = strip_html(e.get("title"), 140)
    cats = [strip_html(c.get("name")) for c in (e.get("categories") or [])]
    if site.get("drop_cats") and (set(cats) & site["drop_cats"]): return None
    if site.get("keep_cats") is not None and not (set(cats) & site["keep_cats"]): return None
    if site.get("drop_title") and re.search(site["drop_title"], title, re.I): return None
    if common.is_junk(title, e.get("description", "")): return None
    if (e.get("status") or "publish") != "publish": return None
    sd = dt.datetime.strptime(e["start_date"], "%Y-%m-%d %H:%M:%S"); ed = dt.datetime.strptime(e["end_date"], "%Y-%m-%d %H:%M:%S")
    span = (ed.date() - sd.date()).days
    if span > 14: return None                       # long-running exhibitions/passes are not events
    dates = [d.isoformat() for d in common.daterange(sd.date(), ed.date()) if start <= d <= end]
    if not dates: return None
    allday = bool(e.get("all_day"))
    v = e.get("venue") if isinstance(e.get("venue"), dict) else {}
    venue = strip_html(v.get("venue")) if v else ""
    addr = ", ".join(x for x in [strip_html(v.get("address")), strip_html(v.get("city")), "FL " + (v.get("zip") or "") if v.get("zip") else ""] if x) if v else ""
    city = common.city_from_text(v.get("city"), v.get("address"), venue) if v else None
    lat = lng = None
    try:
        if v.get("geo_lat") and v.get("geo_lng"): lat, lng = float(v["geo_lat"]), float(v["geo_lng"])
    except Exception: pass
    if site.get("venue") and (not venue or site["id"] in ("bandshell","artsgarage","frost")):
        venue0, addr0, la, ln = site["venue"]
        if not venue or site["id"] in ("bandshell","artsgarage"): venue, addr, lat, lng = venue0, addr0, la, ln
        elif not addr: addr, lat, lng = addr0, la, ln
    city = city or common.city_from_text(addr) or site["city"]
    if lat is not None and not (24.9 < lat < 27.2 and -81.0 < lng < -79.9): lat = lng = None
    if city not in common.CITY: return None          # outside the three counties
    cost = strip_html(e.get("cost"))
    vals = [str(x).lower() for x in ((e.get("cost_details") or {}).get("values") or [])]
    pr = price_from_text(cost) or (price_from_text(vals[0]) if vals else None)
    desc = strip_html(e.get("excerpt") or e.get("description"), 300)
    if pr:
        free, pmin, pmax, ptxt = pr
    else:
        free, pmin, pmax = False, None, None
        ptxt = "See tickets" if (site["ticketed"] or re.search(r"ticket", (e.get("description") or ""), re.I)) else "See details"
        if not site["ticketed"] and re.search(r"\bfree (admission|entry|event|and open to the public|to attend)\b|\bis free\b|\bfree,? open to\b", e.get("description") or "", re.I):
            free, ptxt = True, "Free"
    url = (e.get("url") or "").replace("&#038;", "&")
    if site["id"] == "downtownwpb" and e.get("website"): pass
    tags = []
    if free: tags.append("free")
    if e.get("featured"): tags.append("featured")
    return make_event(title=title, dates=dates, start=None if allday else hhmm(sd), end=None if (allday or ed == sd) else hhmm(ed),
                      venue=venue, address=addr, city=city, lat=lat, lng=lng, category=_cat(title, desc, cats), free=free,
                      price_min=pmin, price_max=pmax, price_text=ptxt, desc=desc, url=url,
                      source=re.sub(r"^https?://(www\.)?", "", site["base"]), tags=tags)

def fetch(start, end, only=None):
    out, errs, stats = [], [], {}
    for site in SITES:
        if only and site["id"] not in only: continue
        try:
            raw = _pages(site["base"], start.isoformat(), end.isoformat())
            evs = [x for x in (_one(site, e, start, end) for e in raw) if x]
            stats[site["id"]] = (len(raw), len(evs)); out += evs
        except Exception as ex:
            errs.append(f"{site['id']}: {ex}"); stats[site["id"]] = ("error", str(ex)[:120])
    fetch.stats = stats
    if errs and not out: raise RuntimeError("; ".join(errs))
    return out
