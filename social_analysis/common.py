"""Shared helpers: config, HTTP, SQLite storage, demographic stats."""
import json, os, sqlite3, time
from datetime import datetime, timezone
import requests

DB_PATH = os.environ.get("SOCIAL_DB", os.path.join(os.path.dirname(__file__), "data", "social.db"))


def env(name, required=True):
    v = os.environ.get(name)
    if required and not v:
        raise SystemExit(f"Missing environment variable {name} (see README.md)")
    return v


def get_json(url, params=None, headers=None, retries=3):
    for i in range(retries):
        r = requests.get(url, params=params, headers=headers, timeout=30)
        if r.status_code in (429, 500, 502, 503):
            time.sleep(2 ** i * 5)
            continue
        if not r.ok:
            raise RuntimeError(f"{r.status_code} {url}: {r.text[:500]}")
        return r.json()
    raise RuntimeError(f"Gave up after {retries} retries: {url}")


def paginate_graph(url, params):
    """Follow Facebook Graph API `paging.next` links."""
    while url:
        data = get_json(url, params)
        yield from data.get("data", [])
        url, params = data.get("paging", {}).get("next"), None


def db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    CREATE TABLE IF NOT EXISTS follower_counts(
        platform TEXT, collected_at TEXT, followers INTEGER);
    CREATE TABLE IF NOT EXISTS demographics(
        platform TEXT, collected_at TEXT, dimension TEXT, bucket TEXT, value REAL);
    CREATE TABLE IF NOT EXISTS posts(
        platform TEXT, post_id TEXT PRIMARY KEY, created_at TEXT, text TEXT, url TEXT);
    CREATE TABLE IF NOT EXISTS comments(
        platform TEXT, comment_id TEXT PRIMARY KEY, post_id TEXT, parent_id TEXT,
        created_at TEXT, author TEXT, text TEXT, likes INTEGER);
    """)
    return con


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_demographics(con, platform, dimension, buckets):
    ts = now()
    con.executemany("INSERT INTO demographics VALUES (?,?,?,?,?)",
                    [(platform, ts, dimension, str(k), float(v)) for k, v in buckets.items()])
    con.commit()


def median_from_buckets(buckets):
    """Estimate median age from {'25-34': 120, '65+': 4, ...} by linear interpolation.
    Open-ended top bucket (e.g. '65+') is treated as width 10."""
    rows = []
    for label, n in buckets.items():
        label = label.replace("–", "-")
        if label.endswith("+"):
            lo = int(label[:-1]); hi = lo + 10
        elif "-" in label:
            lo, hi = (int(x) for x in label.split("-"))
            hi += 1
        else:
            continue
        rows.append((lo, hi, n))
    rows.sort()
    total = sum(n for _, _, n in rows)
    if not total:
        return None
    half, cum = total / 2, 0
    for lo, hi, n in rows:
        if cum + n >= half:
            return round(lo + (half - cum) / n * (hi - lo), 1)
        cum += n
