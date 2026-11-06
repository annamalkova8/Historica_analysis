"""Facebook Page collector (Graph API).

Needs a Page access token of a page admin with: pages_read_engagement,
read_insights, pages_show_list. Page: https://www.facebook.com/historica.org/
Facebook only exposes AGGREGATE follower demographics (age/gender, country, city).
It does not expose education or occupation, and never individual followers.

Env: FB_PAGE_ID, FB_PAGE_TOKEN, optional FB_API_VERSION (default v21.0)
Run: python fb.py [--max-posts 50]
"""
import argparse
from common import env, get_json, paginate_graph, db, now, save_demographics, median_from_buckets

# Meta renames/deprecates insight metrics regularly; adjust here if a call errors.
DEMOGRAPHIC_METRICS = {
    "country": "page_follows_country",
    "city": "page_follows_city",
    "gender_age": "page_follows_gender_age",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-posts", type=int, default=50)
    args = ap.parse_args()
    page, token = env("FB_PAGE_ID"), env("FB_PAGE_TOKEN")
    base = f"https://graph.facebook.com/{env('FB_API_VERSION', False) or 'v21.0'}"
    con = db()

    info = get_json(f"{base}/{page}", {"fields": "followers_count,fan_count", "access_token": token})
    con.execute("INSERT INTO follower_counts VALUES ('facebook',?,?)", (now(), info.get("followers_count")))
    print("followers:", info.get("followers_count"))

    for dim, metric in DEMOGRAPHIC_METRICS.items():
        try:
            data = get_json(f"{base}/{page}/insights", {"metric": metric, "period": "day", "access_token": token})
            values = data["data"][0]["values"][-1]["value"] if data.get("data") else {}
        except RuntimeError as e:
            print(f"skip {dim}: {e}")
            continue
        save_demographics(con, "facebook", dim, values)
        if dim == "gender_age":  # keys look like 'F.25-34'
            ages = {}
            for k, v in values.items():
                ages[k.split(".", 1)[1]] = ages.get(k.split(".", 1)[1], 0) + v
            save_demographics(con, "facebook", "age", ages)
            print("estimated median age:", median_from_buckets(ages))

    posts = paginate_graph(f"{base}/{page}/posts",
                           {"fields": "id,message,created_time,permalink_url", "limit": 25, "access_token": token})
    for n, p in enumerate(posts):
        if n >= args.max_posts:
            break
        con.execute("INSERT OR REPLACE INTO posts VALUES ('facebook',?,?,?,?)",
                    (p["id"], p["created_time"], p.get("message"), p.get("permalink_url")))
        comments = paginate_graph(f"{base}/{p['id']}/comments", {
            "fields": "id,message,created_time,from,like_count,parent{id}",
            "filter": "stream", "limit": 100, "access_token": token})
        for c in comments:
            con.execute("INSERT OR REPLACE INTO comments VALUES ('facebook',?,?,?,?,?,?,?)",
                        (c["id"], p["id"], (c.get("parent") or {}).get("id"), c["created_time"],
                         (c.get("from") or {}).get("name"), c.get("message"), c.get("like_count", 0)))
        con.commit()
    print("done ->", con.execute("SELECT count(*) FROM comments WHERE platform='facebook'").fetchone()[0], "comments")


if __name__ == "__main__":
    main()
