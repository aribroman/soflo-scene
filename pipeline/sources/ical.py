
"""City iCal feeds (CivicPlus calendars) — community-event categories only."""
import sys, os, re, datetime as dt
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from common import make_event, strip_html, guess_category, TZ

SOURCE = "ical"

FEEDS = [  # host, catID, default city
  ("https://www.hollywoodfl.org", 27, "Hollywood"),
  ("https://www.ppines.com", 27, "Pembroke Pines"),
  ("https://www.deerfield-beach.com", 24, "Deerfield Beach"),
  ("https://www.hallandalebeachfl.gov", 41, "Hallandale Beach"),
  ("https://www.wiltonmanors.gov", 34, "Wilton Manors"),
  ("https://www.oaklandparkfl.gov", 31, "Oakland Park"),
  ("https://www.myboca.us", 45, "Boca Raton"),  # Willow Theatre / Sugar Sand Park: shows+lectures kept, classes dropped
  ("https://www.myboca.us", 48, "Boca Raton"),
  ("https://www.myboca.us", 60, "Boca Raton"),
  ("https://www.boynton-beach.org", 25, "Boynton Beach"),
  ("https://www.village-npb.org", 28, "North Palm Beach"),
  ("https://www.citynmb.com", 14, "North Miami Beach"),
  ("https://www.southmiamifl.gov", 23, "South Miami"),
  ("https://www.northmiamifl.gov", 22, "North Miami"),
]
DROP = re.compile(r"winter break|spring break|\bages? \d|robotics|sluggers|athletes|\bclass(es)?\b|\blab\b|squad|clinic|lesson|\bprogram\b|council|advisory|business & leadership|closed|closure|camp\b|meeting|hearing|board\b|committee|magistrate|outreach|property appraiser|"
                  r"distribution|drive-thru distribution|registration|tutoring|literacy|caregiver|support group|"
                  r"observance|holiday observed|office|early voting|\bbid\b|rfp|rfq|itb", re.I)
FREE_RX = re.compile(r"\bfree (admission|entry|event|concert|movie|show|family|community|and open|to (the public|attend|all))|"
                     r"admission is free|(is|are) free\b|free of charge|no cost|no charge|\bfree!|^free\b", re.I)
TICKET_RX = re.compile(r"ticket|\$\s?\d", re.I)

def _unfold(t): return re.sub(r"\r?\n[ \t]", "", t)
def _unesc(s): return s.replace("\\,", ",").replace("\\;", ";").replace("\\n", " ").replace("\\N", " ").replace("\\\\", "\\")

def _parse(txt):
    out = []
    for blk in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", _unfold(txt), re.S):
        d = {}
        for line in blk.strip().splitlines():
            if ":" not in line: continue
            k, v = line.split(":", 1)
            d.setdefault(k.split(";")[0].upper(), (k, v.strip()))
        out.append(d)
    return out

def _dt(prop):
    if not prop: return None, False
    k, v = prop
    if "VALUE=DATE" in k.upper() or re.fullmatch(r"\d{8}", v):
        return dt.datetime.strptime(v[:8], "%Y%m%d"), True
    x = dt.datetime.strptime(v[:15], "%Y%m%dT%H%M%S")
    if v.endswith("Z"):
        x = x.replace(tzinfo=dt.timezone.utc).astimezone(TZ).replace(tzinfo=None)
    return x, False

def _feed(host, cat, city0, start, end):
    txt = common.get(f"{host}/common/modules/iCalendar/iCalendar.aspx?catID={cat}&feed=calendar", timeout=30)
    if "BEGIN:VCALENDAR" not in txt: raise RuntimeError(f"no calendar at {host} cat {cat}")
    out = []
    for v in _parse(txt):
        title = strip_html(_unesc(v.get("SUMMARY", ("", ""))[1]), 140)
        if not title or DROP.search(title) or common.is_junk(title): continue
        sd, allday = _dt(v.get("DTSTART")); ed, _ = _dt(v.get("DTEND"))
        if not sd: continue
        ed = ed or sd
        if allday and ed > sd: ed = ed - dt.timedelta(days=1)   # DTEND is exclusive for all-day
        if (ed.date() - sd.date()).days > 14: continue
        dates = [d.isoformat() for d in common.daterange(sd.date(), ed.date()) if start <= d <= end]
        if not dates: continue
        raw = _unesc(v.get("DESCRIPTION", ("", ""))[1])
        m = re.search(r"https?://\S+calendar\.aspx\?EID=\d+", raw, re.I)
        url = m.group(0) if m else host + "/calendar.aspx"
        desc = strip_html(raw.replace(m.group(0), "") if m else raw, 300)
        loc = strip_html(_unesc(v.get("LOCATION", ("", ""))[1]), 200).strip(" -")
        venue, addr = (loc.split(" - ", 1) + [""])[:2] if " - " in loc else ("", loc)
        venue = venue.strip(); addr = re.sub(r"\s{2,}", " ", addr).strip()
        addr = re.sub(r"\s+(FL)\s+(\d{5})$", r", \1 \2", addr)
        city = common.city_from_text(addr, loc) or city0
        text = f"{title} {desc}"
        if FREE_RX.search(text): free, ptxt = True, "Free"
        else:
            pr = common.price_from_text(re.search(r"\$\s?\d[\d,.]*(\s*[-–]\s*\$?\s?\d[\d,.]*)?", text).group(0)) if re.search(r"\$\s?\d", text) else None
            if pr: free, ptxt = pr[0], pr[3]
            else: free, ptxt = False, ("See tickets" if TICKET_RX.search(text) else "See details")
        pmin = pmax = None
        if not free and ptxt not in ("See tickets", "See details"):
            pmin, pmax = pr[1], pr[2]
        out.append(make_event(title=title, dates=dates, start=None if allday else sd.strftime("%H:%M"),
                              end=None if (allday or ed == sd) else ed.strftime("%H:%M"), venue=venue or city, address=addr,
                              city=city, category=guess_category(title, desc), free=free, price_min=pmin, price_max=pmax,
                              price_text=ptxt, desc=desc, url=url, source=re.sub(r"^https?://(www\.)?", "", host), tags=[]))
    return out

def fetch(start, end):
    out, errs, stats = [], [], {}
    with ThreadPoolExecutor(8) as ex:
        futs = {(h, c): ex.submit(_feed, h, c, ci, start, end) for h, c, ci in FEEDS}
        for k, f in futs.items():
            try:
                r = f.result(); out += r; stats[f"{k[0].split('//')[1]}#{k[1]}"] = len(r)
            except Exception as e:
                errs.append(f"{k}: {e}"); stats[f"{k[0].split('//')[1]}#{k[1]}"] = "error: " + str(e)[:100]
    fetch.stats = stats
    if errs and not out: raise RuntimeError("; ".join(errs))
    return out
