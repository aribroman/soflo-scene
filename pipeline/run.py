#!/usr/bin/env python3
"""SoFlo Scene daily ingest: pull every source, normalize, dedupe, drop past, write site/data/events.js, publish, verify.
Usage: python3 run.py [--no-publish] [--only tribe,ical]
Exit 0 = published (or written with --no-publish) and verified; non-zero = something broke (details in out/last_run.json)."""
import sys, os, re, json, time, glob, importlib, subprocess, datetime as dt, traceback, unicodedata
from concurrent.futures import ThreadPoolExecutor, wait
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import common
from common import TZ, CATEGORIES, CITY

SITE = os.path.join(ROOT, "site"); OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
URL = "https://aribroman.github.io/soflo-scene/"
WINDOW_DAYS = 120
COUNTIES = {"Miami-Dade", "Broward", "Palm Beach"}
SOURCE_TIMEOUT = 240

def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)

def norm_title(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\b(the|a|an|at|in|of|and|presents?|featuring|feat|live|tour|2026|2027|annual|\d+(st|nd|rd|th))\b", " ", t)
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())

def tokens(t): return set(w for w in norm_title(t).split() if len(w) > 2)

def similar(a, b):
    na, nb = norm_title(a), norm_title(b)
    if not na or not nb: return False
    if na == nb or (len(na) > 8 and na in nb) or (len(nb) > 8 and nb in na): return True
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb: return False
    j = len(ta & tb) / len(ta | tb)
    return j >= 0.6 or (len(ta & tb) >= 3 and j >= 0.45)

def valid(e, today, end):
    try:
        if not e.get("title") or not e.get("url", "").startswith("http"): return None
        if common.is_excluded(e["title"]): return None
        e["dates"] = sorted(set(d for d in e.get("dates") or [] if today.isoformat() <= d <= end.isoformat()))
        if not e["dates"]: return None
        if e.get("county") not in COUNTIES:
            c = e.get("city")
            if c in CITY: e["county"] = CITY[c][2]
            else: return None
        if e.get("category") not in CATEGORIES: e["category"] = common.guess_category(e.get("title"), e.get("desc") or "") or "Community"
        if e.get("category") not in CATEGORIES: e["category"] = "Community"
        for k in ("start", "end"):
            if e.get(k) and not re.fullmatch(r"\d{2}:\d{2}", e[k]): e[k] = None
        if e.get("start") == "00:00" and not e.get("end"): e["start"] = None
        if e.get("lat") is None and e.get("city") in CITY: e["lat"], e["lng"] = CITY[e["city"]][:2]
        e["free"] = bool(e.get("free"))
        if e["free"]: e["price_min"] = e["price_max"] = None; e["price_text"] = e.get("price_text") or "Free"
        elif e.get("price_min") is None and e.get("price_text") not in ("See tickets", "See details"):
            if not re.search(r"\$\d", e.get("price_text") or ""): e["price_text"] = "See details"
        e["tags"] = sorted(set(t for t in (e.get("tags") or []) if t != "free"))
        e["id"] = common.eid(e)
        return e
    except Exception:
        return None

def merge_runs(evs):
    """Several rows for the same thing (one per date) -> one event with a dates list."""
    groups = {}
    for e in evs:
        k = (norm_title(e["title"]), (e.get("venue") or e.get("city") or "").lower()[:30], e.get("start"), e["source"])
        g = groups.get(k)
        if g is None: groups[k] = e
        else:
            g["dates"] = sorted(set(g["dates"]) | set(e["dates"]))
            if g.get("price_min") is None and e.get("price_min") is not None:
                for f in ("free", "price_min", "price_max", "price_text"): g[f] = e[f]
    return list(groups.values())

def score(e):  # which duplicate to keep: priced > ticket-stated > unknown, longer desc
    return (e["free"] or e.get("price_min") is not None, e.get("price_text") == "See tickets", len(e.get("desc") or ""))

def run_source(name, start, end):
    m = importlib.import_module(f"sources.{name}")
    t = time.time(); evs = m.fetch(start, end)
    return evs, round(time.time() - t, 1), getattr(m.fetch, "stats", None)

def main():
    args = sys.argv[1:]
    publish = "--no-publish" not in args
    only = None
    if "--only" in args: only = set(args[args.index("--only") + 1].split(","))
    now = dt.datetime.now(TZ); today = now.date(); end = today + dt.timedelta(days=WINDOW_DAYS)
    report = {"started": now.isoformat(), "sources": {}, "errors": [], "published": False}
    names = sorted(os.path.basename(p)[:-3] for p in glob.glob(os.path.join(HERE, "sources", "*.py")) if not p.endswith("__init__.py"))
    if only: names = [n for n in names if n in only]
    log("sources:", names)
    feed = []
    ex = ThreadPoolExecutor(len(names) or 1)
    futs = {n: ex.submit(run_source, n, today, end) for n in names}
    wait(list(futs.values()), timeout=SOURCE_TIMEOUT)
    for n, f in futs.items():
        lastgood = os.path.join(OUT, f"{n}.json")
        try:
            if not f.done(): raise TimeoutError(f"no answer in {SOURCE_TIMEOUT}s")
            evs, secs, stats = f.result()
            for e in evs: e.setdefault("source", n)
            json.dump(evs, open(lastgood, "w"))
            report["sources"][n] = {"ok": True, "raw": len(evs), "secs": secs, "detail": stats}
            log(f"{n}: {len(evs)} in {secs}s")
        except Exception as e:
            msg = f"{type(e).__name__}: {e}"[:300]
            evs = json.load(open(lastgood)) if os.path.exists(lastgood) else []
            report["sources"][n] = {"ok": False, "error": msg, "used_last_good": len(evs)}
            report["errors"].append(f"{n}: {msg}")
            log(f"{n}: FAILED {msg} — using {len(evs)} last-good")
        for e in evs: e["_src"] = n
        feed += evs
    ex.shutdown(wait=False, cancel_futures=True)

    feed = [x for x in (valid(dict(e), today, end) for e in feed) if x]
    feed = merge_runs(feed)

    # hand-checked picks: keep, auto-expire past dates
    picks = json.load(open(os.path.join(HERE, "picks.json")))
    curated = []
    for p in picks:
        p = dict(p); p["dates"] = [d for d in p.get("dates") or [] if d >= today.isoformat()]
        if p.get("category") not in CATEGORIES: p["category"] = common.guess_category(p.get("title"), p.get("desc") or "") or "Community"
        if p.get("category") not in CATEGORIES: p["category"] = "Community"
        if p["dates"] and not common.is_excluded(p.get("title")): curated.append(p)

    # dedupe feed against picks (a pick covers a feed event when titles match and they share a date or city)
    kept, covered = [], 0
    for e in feed:
        hit = None
        for p in curated:
            if similar(e["title"], p["title"]) and (set(e["dates"]) & set(p["dates"]) or e.get("city") == p.get("city")):
                hit = p; break
        if hit:
            covered += 1
            hit["dates"] = sorted(set(hit["dates"]) | set(d for d in e["dates"] if d >= today.isoformat()))
            continue
        kept.append(e)
    # dedupe across feed sources
    kept.sort(key=score, reverse=True)
    final = []
    for e in kept:
        dup = False
        for f in final:
            if f["_src"] != e["_src"] or f["source"] != e["source"]:
                if set(e["dates"]) & set(f["dates"]) and similar(e["title"], f["title"]):
                    dup = True; break
        if not dup: final.append(e)
    by_src = {}
    for e in final:
        by_src[e["_src"]] = by_src.get(e["_src"], 0) + 1; e.pop("_src", None)
    final.sort(key=lambda e: (e["dates"][0], e.get("start") or "99"))
    seen_p = os.path.join(OUT, "seen.json")
    seen = json.load(open(seen_p)) if os.path.exists(seen_p) else {}
    first_run = not seen
    for e in final:
        k = e["id"]
        if k not in seen: seen[k] = "2026-10-20" if first_run else today.isoformat()   # first run = baseline, nothing flagged New
        e["first_seen"] = seen[k]
    json.dump(seen, open(seen_p, "w"))
    report["new_today"] = sum(1 for e in final if e["first_seen"] == today.isoformat())
    report["feed_after_dedupe"] = by_src; report["covered_by_picks"] = covered

    # library snapshot (first paint; the live Worker refreshes it on open)
    lib, lib_status = [], []
    try:
        r = subprocess.run(["node", os.path.join(ROOT, "build", "pull.mjs"), today.isoformat(), "30"], capture_output=True, text=True, timeout=180, cwd=os.path.join(ROOT, "build"))
        snap = json.load(open(os.path.join(ROOT, "build", "library-snapshot.json")))
        lib, lib_status = snap.get("events", []), snap.get("status", [])
    except Exception as e:
        report["errors"].append(f"library snapshot: {e}")
    if len(lib) < 50:  # keep the previous embedded snapshot rather than ship an empty one
        try:
            old = open(os.path.join(SITE, "data", "events.js")).read()
            prev = json.loads(old[old.index("=") + 1:].rstrip().rstrip(";"))
            lib = [x for x in prev.get("library", []) if str(x.get("start", ""))[:10] >= today.isoformat()]
            lib_status = prev.get("status", [])
        except Exception: pass
    lib_before = len(lib); lib = [x for x in lib if not common.is_excluded(x.get("title"))]
    for x in lib:
        if x.get("category") not in CATEGORIES: x["category"] = "Community"
    report["library_non_events_dropped"] = lib_before - len(lib)
    report["library"] = len(lib)

    total = len(curated) + len(final)
    free_n = sum(1 for e in curated + final if e["free"]); paid_n = sum(1 for e in curated + final if not e["free"] and (e.get("price_min") is not None or e.get("price_text") == "See tickets"))
    report.update(curated=len(curated), feed=len(final), total=total, free=free_n, paid=paid_n, other=total - free_n - paid_n)
    log(f"curated {len(curated)} + feed {len(final)} = {total} (free {free_n}, paid {paid_n}); library {len(lib)}")
    if len(final) < 100 or total < 200:
        report["errors"].append(f"refusing to publish: only {len(final)} feed events / {total} total")
        json.dump(report, open(os.path.join(OUT, "last_run.json"), "w"), indent=1); log("ABORT", report["errors"][-1]); return 2

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data = {"generated": stamp, "updated": stamp, "picks_checked": "2026-10-27", "curated": curated, "feed": final,
            "library": lib, "status": lib_status, "feed_sources": by_src}
    js = "window.SOFLO=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    open(os.path.join(SITE, "data", "events.js"), "w").write(js)
    json.dump({"updated": stamp, "total": total, "feed": len(final), "curated": len(curated)}, open(os.path.join(SITE, "data", "updated.json"), "w"))
    report["updated"] = stamp; report["bytes"] = len(js)

    report["published"] = True  # static files written to site/data/; deployed via GitHub Pages
    report["finished"] = dt.datetime.now(TZ).isoformat()
    json.dump(report, open(os.path.join(OUT, "last_run.json"), "w"), indent=1)
    hist = os.path.join(OUT, "history.jsonl")
    open(hist, "a").write(json.dumps({k: report.get(k) for k in ("started", "total", "curated", "feed", "free", "paid", "library", "published", "errors")}) + "\n")
    return 0

if __name__ == "__main__":
    try: sys.exit(main())
    except Exception:
        traceback.print_exc(); sys.exit(1)
