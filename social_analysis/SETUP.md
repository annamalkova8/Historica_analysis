# Как получить доступ к API для сборщиков данных из соцсетей

Цель: получить 4 значения, чтобы запускались `fb.py` и `linkedin.py`.

| Переменная | Где используется | Где взять |
|---|---|---|
| `FB_PAGE_ID` | fb.py | Часть 1, шаг 4 |
| `FB_PAGE_TOKEN` | fb.py | Часть 1, шаг 4 |
| `LI_TOKEN` | linkedin.py | Часть 2, шаг 5 |
| `LI_ORG_ID` | linkedin.py | Часть 2, шаг 6 |

**Условие:** вы должны быть **администратором** страницы Facebook и **Super admin** страницы LinkedIn. Без этого API не отдаст данные о подписчиках.

Не отправляйте токены в чат, почту или git. Передавайте их через менеджер паролей.

---

## Часть 1 - Facebook (около 20 минут, проверка приложения не нужна)

1. Откройте https://developers.facebook.com/ -> **My Apps** -> **Create App**. Выберите сценарий **Other** -> тип приложения **Business**. Назовите, например, «Historica Analytics».
2. В приложении: **App settings -> Basic**. Запишите **App ID** и **App Secret** (понадобятся на шаге 3).
3. Получите постоянный токен страницы:
   1. Откройте Graph API Explorer: https://developers.facebook.com/tools/explorer/
      - Вверху справа выберите своё приложение.
      - В **Permissions** добавьте: `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `read_insights`.
      - Нажмите **Generate Access Token**, подтвердите и, когда спросят, выберите страницу **Historica**.
      - Вы получите короткоживущий токен **пользователя** (около 1 часа).
   2. Обменяйте его на долгоживущий токен пользователя (откройте в браузере или через curl):
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=КОРОТКИЙ_ТОКЕН`
   3. С полученным долгоживущим токеном выполните запрос:
      `https://graph.facebook.com/v21.0/me/accounts?access_token=ДОЛГОЖИВУЩИЙ_ТОКЕН_ПОЛЬЗОВАТЕЛЯ`
   4. В ответе найдите запись **Historica**. Её `access_token` - это `FB_PAGE_TOKEN` (токены страницы, полученные из долгоживущего токена пользователя, не истекают). Её `id` - это `FB_PAGE_ID`.
4. Быстрая проверка:
   `https://graph.facebook.com/v21.0/PAGE_ID?fields=followers_count&access_token=PAGE_TOKEN`
   Должно вернуться число подписчиков.

Примечания
- Проверка приложения (App Review) не нужна, пока приложение в режиме **Development**, а токен создал администратор или разработчик и приложения, и страницы. Если запускать будет другой человек, добавьте его в **App roles**.
- Facebook отдаёт только **суммарные** данные о подписчиках: возраст/пол, страна и город. Данных об образовании и профессии нет.
- Для демографии нужно примерно 100+ подписчиков.
- Раздел **Integrations / Connect data** в Events Manager (Meta Pixel, Conversions API, Facebook SDK) для этого не нужен: он относится к рекламе.

---

## Часть 2 - LinkedIn (около 30 минут работы, затем ожидание одобрения: от нескольких дней до нескольких недель)

1. Откройте https://www.linkedin.com/developers/apps -> **Create app**.
   - Привяжите приложение к странице компании **Historica Foundation**.
   - Загрузите логотип, примите условия.
2. **Super admin** страницы должен открыть ссылку верификации на вкладке **Settings** приложения и нажать **Approve**. Пока этого нет, приложение использовать нельзя.
3. Вкладка **Products** -> запросите **Community Management API**. Заполните форму доступа (данные организации, цель: «Анализ подписчиков и комментариев нашей собственной страницы компании»). Это самый долгий шаг.
   - LinkedIn требует держать этот продукт в отдельном приложении, поэтому не добавляйте в него другие продукты.
   - Начните с уровня **Development tier**. Для своей страницы его достаточно. Для **Standard tier** проверка дольше.
4. После одобрения откройте вкладку **Auth** и запишите **Client ID** и **Client Secret**. Если хотите пройти OAuth самостоятельно, добавьте redirect URL (например, `http://localhost:8000/callback`).
5. Получите токен (`LI_TOKEN`): используйте генератор OAuth-токенов https://www.linkedin.com/developers/tools/oauth
   - Выберите приложение и отметьте права: `r_organization_social`, `r_organization_followers`, `rw_organization_admin`.
   - Войдите как Super admin страницы и подтвердите.
   - Токен действует **60 дней**, затем шаг нужно повторить. Refresh-токены доступны только одобренным партнёрам.
6. Получите числовой ID организации (`LI_ORG_ID`): откройте админку страницы (linkedin.com/company/historica-foundation/admin/). URL превратится в `linkedin.com/company/<ЧИСЛО>/admin/`. Это число и есть ID.

Примечания
- LinkedIn отдаёт только **суммарные** данные о подписчиках: по стране/региону, стажу (seniority), отрасли, функции и размеру компании. Возраста и образования нет, отдельных подписчиков тоже нет.
- Для демографических разрезов нужно минимум 100 подписчиков.

---

## Переход с соцсетей на сайт

Ни Facebook, ни LinkedIn не отдают данные о посетителях, перешедших на сайт. Чтобы это считать:
- Добавляйте UTM-метки ко всем ссылкам на сайт в постах, например `?utm_source=facebook&utm_medium=social&utm_campaign=...`.
- Визиты считает аналитика сайта. Отчёт по ним строит `web_traffic.py`.

---

## Использование значений

```bash
export FB_PAGE_ID=...
export FB_PAGE_TOKEN=...
export LI_TOKEN=...
export LI_ORG_ID=...

pip install -r requirements.txt
python fb.py
python linkedin.py
```

Результаты сохраняются в `data/social.db` (SQLite).
