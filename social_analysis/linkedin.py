"""LinkedIn Company Page collector (Community Management API, versioned REST).

Needs an OAuth token of a page admin with r_organization_social,
r_organization_followers (and rw_organization_admin). Requires approval of the
Community Management API product in the LinkedIn developer portal.
Page: https://www.linkedin.com/company/historica-foundation/
LinkedIn gives AGGREGATE follower demographics: country/region, seniority,
industry, job function, company size. It does not expose education or
individual follower profiles, and no age.

Env: LI_TOKEN, LI_ORG_ID (numeric id of the company), optional LI_VERSION (YYYYMM)
Run: python linkedin.py [--max-posts 50]
"""
import argparse
from urllib.parse import quote
from common import env, get_json, db, now, save_demographics

API = "https://api.linkedin.com/rest"
FACETS = {  # response field -> dimension name; values are URNs, kept raw
    "followerCountsByGeoCountry": "country",
    "followerCountsByRegion": "region",
    "followerCountsBySeniority": "seniority",
    "followerCountsByIndustry": "industry",
    "followerCountsByFunction": "job_function",
    "followerCountsByStaffCountRange": "company_size",
}


def headers():
    return {"Authorization": f"Bearer {env('LI_TOKEN')}",
            "LinkedIn-Version": env("LI_VERSION", False) or "202511",
            "X-Restli-Protocol-Version": "2.0.0"}


def elements(url, params=None):
    start = 0
    while True:
        data = get_json(url, {**(params or {}), "start": start, "count": 50}, headers())
        els = data.get("elements", [])
        yield from els
        if len(els) < 50:
            return
        start += 50


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-posts", type=int, default=50)
    args = ap.parse_args()
    org = f"urn:li:organization:{env('LI_ORG_ID')}"
    con = db()

    total = get_json(f"{API}/networkSizes/{quote(org, safe='')}", {"edgeType": "COMPANY_FOLLOWED_BY_MEMBER"}, headers())
    con.execute("INSERT INTO follower_counts VALUES ('linkedin',?,?)", (now(), total.get("firstDegreeSize")))
    print("followers:", total.get("firstDegreeSize"))

    stats = get_json(f"{API}/organizationalEntityFollowerStatistics",
                     {"q": "organizationalEntity", "organizationalEntity": org}, headers())
    for el in stats.get("elements", []):
        for field, dim in FACETS.items():
            buckets = {}
            for row in el.get(field, []):
                key = next((v for k, v in row.items() if k.endswith(("Country", "region", "seniority", "industry", "function", "staffCountRange")) and isinstance(v, str)), None)
                c = row["followerCounts"]
                buckets[key] = c.get("organicFollowerCount", 0) + c.get("paidFollowerCount", 0)
            if buckets:
                save_demographics(con, "linkedin", dim, buckets)

    n = 0
    for p in elements(f"{API}/posts", {"q": "author", "author": org}):
        if n >= args.max_posts:
            break
        n += 1
        urn = p["id"]
        con.execute("INSERT OR REPLACE INTO posts VALUES ('linkedin',?,?,?,?)",
                    (urn, str(p.get("publishedAt")), p.get("commentary"),
                     f"https://www.linkedin.com/feed/update/{urn}"))
        for c in elements(f"{API}/socialActions/{quote(urn, safe='')}/comments"):
            con.execute("INSERT OR REPLACE INTO comments VALUES ('linkedin',?,?,?,?,?,?,?)",
                        (c["id"], urn, c.get("parentComment"), str(c.get("created", {}).get("time")),
                         c.get("actor"), (c.get("message") or {}).get("text"),
                         (c.get("likesSummary") or {}).get("totalLikes", 0)))
        con.commit()
    print("done ->", con.execute("SELECT count(*) FROM comments WHERE platform='linkedin'").fetchone()[0], "comments")


if __name__ == "__main__":
    main()
