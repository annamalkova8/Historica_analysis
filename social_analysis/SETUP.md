# Getting API access for the social analytics collectors

Goal: get 4 values (plus 1 optional) so `fb.py` and `linkedin.py` can run.

| Variable | Used by | Where it comes from |
|---|---|---|
| `FB_PAGE_ID` | fb.py | Part 1, step 5 |
| `FB_PAGE_TOKEN` | fb.py | Part 1, step 4 |
| `LI_TOKEN` | linkedin.py | Part 2, step 5 |
| `LI_ORG_ID` | linkedin.py | Part 2, step 6 |

**Requirement:** you must be an **Admin** of the Facebook Page and a **Super admin** of the LinkedIn Page. Without that, no API will return follower data.

Never paste tokens into chat, email or git. Send them through a password manager.

---

## Part 1 - Facebook (about 20 minutes, no review needed)

1. Go to https://developers.facebook.com/ -> **My Apps** -> **Create App**. Choose use case **Other** -> app type **Business**. Name it e.g. "Historica Analytics".
2. In the app: **App settings -> Basic**. Note the **App ID** and **App Secret** (needed in step 4).
3. Open the Graph API Explorer: https://developers.facebook.com/tools/explorer/
   - Select your app at the top right.
   - Under **Permissions** add: `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `read_insights`.
   - Click **Generate Access Token** and approve, selecting the **Historica** page when asked.
   - This gives a short-lived **user** token (about 1 hour).
4. Turn it into a permanent **page** token:
   1. Exchange for a long-lived user token (open in a browser or curl):
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN`
   2. Using the long-lived token returned, request:
      `https://graph.facebook.com/v21.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN`
   3. In the response find the entry for **Historica**. Its `access_token` is `FB_PAGE_TOKEN` (page tokens derived from a long-lived user token do not expire). Its `id` is `FB_PAGE_ID`.
5. Quick test:
   `https://graph.facebook.com/v21.0/PAGE_ID?fields=followers_count&access_token=PAGE_TOKEN`
   It should return a follower number.

Notes
- No App Review is required while the app stays in **Development mode**, as long as the person who made the token is an admin/developer of the app and of the page. If someone else will run it, add them under **App roles**.
- Facebook only provides age/gender, country and city **totals** for followers. There is no education or occupation data.
- Demographics need roughly 100+ followers.

---

## Part 2 - LinkedIn (about 30 minutes of work, then waiting for approval: days to weeks)

1. Go to https://www.linkedin.com/developers/apps -> **Create app**.
   - Link it to the **Historica Foundation** company page.
   - Upload a logo, accept terms.
2. The page **Super admin** must open the verification link shown in the app's **Settings** tab and click **Approve**. Until then the app can't be used.
3. **Products** tab -> request **Community Management API**. Fill in the access form (organization details, use case: "Analyzing our own company page followers and comments"). This is the slow step.
   - LinkedIn requires this product on a dedicated app, so don't add other products to it.
   - Start with the **Development tier**. It is enough for your own page. The Standard tier needs a longer review.
4. After approval, open the **Auth** tab and note the **Client ID** and **Client Secret**. Add a redirect URL (e.g. `http://localhost:8000/callback`) if you want to run the OAuth flow yourself.
5. Get the token (`LI_TOKEN`): use the OAuth token generator at https://www.linkedin.com/developers/tools/oauth
   - Select the app and tick scopes: `r_organization_social`, `r_organization_followers`, `rw_organization_admin`.
   - Sign in as the page Super admin and approve.
   - The token lasts **60 days**, so repeat the step then. Refresh tokens are only available to approved partners.
6. Get the numeric organization ID (`LI_ORG_ID`): open the page's admin view (linkedin.com/company/historica-foundation/admin/). The URL becomes `linkedin.com/company/<NUMBER>/admin/`. That number is the ID.

Notes
- LinkedIn only provides follower **totals** by country/region, seniority, industry, job function and company size. There is no age or education data and no individual followers.
- Demographic breakdowns need at least 100 followers.

---

## Using the values

```bash
export FB_PAGE_ID=...
export FB_PAGE_TOKEN=...
export LI_TOKEN=...
export LI_ORG_ID=...

pip install -r requirements.txt
python fb.py
python linkedin.py
```

Results are stored in `data/social.db` (SQLite).
