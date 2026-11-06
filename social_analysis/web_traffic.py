"""Social -> website attribution.

1) `python web_traffic.py tag <url> <facebook|linkedin> <campaign>` prints a UTM-tagged
   link. Use these in every post and in the page's website button so visits are attributable.
2) `python web_traffic.py report visits.csv` counts visits per social source from an export
   of your analytics (Mixpanel/GA/etc.). The CSV needs a `referrer` and/or `utm_source`
   column; extra columns are ignored.
"""
import csv, sys
from collections import Counter
from urllib.parse import urlencode, urlparse, urlsplit, urlunsplit, parse_qsl

SOURCES = {
    "facebook": ("facebook.com", "fb.com", "fb.me", "l.facebook.com", "m.facebook.com"),
    "linkedin": ("linkedin.com", "lnkd.in"),
}


def tag(url, source, campaign):
    p = urlsplit(url)
    q = dict(parse_qsl(p.query)) | {"utm_source": source, "utm_medium": "social", "utm_campaign": campaign}
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(q), p.fragment))


def classify(referrer="", utm_source=""):
    if utm_source.lower() in SOURCES:
        return utm_source.lower()
    host = urlparse(referrer).netloc.lower().removeprefix("www.")
    for name, domains in SOURCES.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return None


def report(path):
    c = Counter()
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            c[classify(row.get("referrer", ""), row.get("utm_source", "")) or "other"] += 1
    for k, v in c.most_common():
        print(f"{k}\t{v}")


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "tag":
        print(tag(*sys.argv[2:5]))
    elif len(sys.argv) == 3 and sys.argv[1] == "report":
        report(sys.argv[2])
    else:
        print(__doc__)
