"""Kaseya Center (Miami) — paginated events_ajax list + each detail page's schema.org Event JSON-LD."""
import sys, os, re, json, html, datetime as dt, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import common
from concurrent.futures import ThreadPoolExecutor

SOURCE = "kaseya"
AJAX = "https://www.kaseyacenter.com/events/events_ajax/{off}?category=0&venue=0&team=0&per_page=12&came_from_page=event-list-page"
VENUE = dict(venue="Kaseya Center", address="601 Biscayne Blvd, Miami, FL 33132", city="Miami", county="Miami-Dade",
             zip="33132", lat=25.7814, lng=-80.1870)
SKIP = re.compile(r"(?i)all-access tour|arena tour|tony robbins|unleash the power|seminar|graduation|commencement|"
                  r"business forum|summit of|expo\b|job fair|career fair|parking|suite|private event|conference")

def _t(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def _list():
    urls, sub = [], {}
    for page in range(12):                    # 12 per page; stop when a page is empty
        try: raw = common.get(AJAX.format(off=page * 12), timeout=20, tries=2)
        except Exception as e:
            if page == 0: raise
            print(f"[kaseya] list page {page} failed: {e}", file=sys.stderr); break
        try: h = json.loads(raw)
        except Exception: h = raw
        h = h.replace("\\/", "/")
        found = 0
        for it in h.split('class="eventItem')[1:]:
            m = re.search(r'href="(https://www\.kaseyacenter\.com/events/detail/[^"]+)"', it)
            if not m: continue
            u = m.group(1)
            if u not in urls: urls.append(u); found += 1
            tg = re.search(r'class="tagline"[^>]*>(.*?)</', it, re.S)
            if tg: sub[u] = _t(tg.group(1))
        if not found: break
    return urls, sub

def _detail(u):
    try: s = common.get(u, timeout=20, tries=2)
    except Exception as e:
        print(f"[kaseya] detail failed {u}: {e}", file=sys.stderr); return u, []
    evs = []
    for blob in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', s, re.S):
        try: j = json.loads(blob)
        except Exception: continue
        for x in (j if isinstance(j, list) else [j]):
            if isinstance(x, dict) and x.get("@type") == "Event": evs.append(x)
    return u, evs

def _price(offers):
    offers = offers if isinstance(offers, list) else [offers or {}]
    lo = [float(o[k]) for o in offers for k in ("price", "lowPrice") if isinstance(o, dict) and str(o.get(k, "")).replace(".", "", 1).isdigit()]
    hi = [float(o["highPrice"]) for o in offers if isinstance(o, dict) and str(o.get("highPrice", "")).replace(".", "", 1).isdigit()]
    lo = [v for v in lo if v > 0]
    if not lo: return None
    a, b = min(lo), max(hi + lo)
    f = lambda v: ("$%d" % v) if v == int(v) else ("$%.2f" % v)
    return a, b, (f(a) if a == b else f"{f(a)}–{f(b)}")

def fetch(start, end):
    t0 = time.time()
    urls, sub = _list()
    with ThreadPoolExecutor(6) as ex:
        details = list(ex.map(_detail, urls))
    out = []
    for u, evs in details:
        for x in evs:
            title = html.unescape(x.get("name") or "").strip()
            if not title or SKIP.search(title) or common.is_junk(title): continue
            if re.search(r"(?i)cancel|postpon", x.get("eventStatus") or ""): continue
            try:
                sdt = dt.datetime.fromisoformat(x["startDate"]); edt = dt.datetime.fromisoformat(x.get("endDate") or x["startDate"])
            except Exception: continue
            sd, ed = sdt.date(), edt.date()
            if (ed - sd).days > 7: continue
            dates = [d.isoformat() for d in common.daterange(sd, ed) if start <= d <= end and d >= dt.date.today()]
            if not dates: continue
            heat = bool(re.search(r"(?i)miami heat", title))
            desc = html.unescape(x.get("description") or "") or sub.get(u, "")
            if heat: cat = "Sports & Fitness"
            elif re.search(r"(?i)comed|stand-?up|wild .n out|improv", title + " " + desc): cat = "Comedy & Theater"
            elif re.search(r"(?i)disney on ice|monster jam|circus|cirque|paw patrol|sesame|bluey|harlem globetrotters", title): cat = "Family & Kids"
            elif re.search(r"(?i)\bufc\b|wwe|boxing|wrestling|basketball|hockey|tennis|\bvs\.?\b", title): cat = "Sports & Fitness"
            elif re.search(r"(?i)tour|concert|live|music|singer|band|dj|fest", title + " " + desc + " " + sub.get(u, "")) or \
                 (x.get("performer") or {}).get("@type") in ("Person", "MusicGroup", "PerformingGroup"): cat = "Music"
            else: cat = "Community"
            p = _price(x.get("offers"))
            pmin, pmax, ptxt = (p if p else (None, None, "See tickets"))
            st = common.hhmm(sdt) if sdt.hour or sdt.minute else None
            out.append(common.make_event(
                title=title + (f": {sub[u]}" if u in sub and not heat and sub[u].lower() not in title.lower() and len(sub[u]) < 50 else ""),
                dates=dates, start=st, end=None, **VENUE, category=cat, free=False,
                price_min=pmin, price_max=pmax if p else None, price_text=ptxt, desc=desc, url=u,
                source="kaseyacenter.com", tags=(["night"] if st and int(st[:2]) >= 18 else []) + (["family"] if cat == "Family & Kids" else [])))
    if urls and not out and not any(evs for _, evs in details): raise RuntimeError("kaseya: no JSON-LD events on any detail page")
    print(f"[kaseya] {len(urls)} listed, {len(out)} events, {time.time()-t0:.0f}s", file=sys.stderr)
    return out
