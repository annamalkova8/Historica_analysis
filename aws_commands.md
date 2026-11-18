** Запросы **

За последние N дней. 
Команды для Linux; на macOS вместо -d "$N days ago" пиши -v-${N}d, вместо -d yesterday — -v-1d.

N=30
END=$(date -u +%Y-%m-%dT00:00:00Z)
START=$(date -u -d "$N days ago" +%Y-%m-%dT00:00:00Z)
aws cloudwatch get-metric-data \
  --metric-data-queries file://traffic-queries.json \
  --start-time "$START" --end-time "$END" \
  --scan-by TimestampAscending --output jsonВ ответе MetricDataResults[], у каждого элемента Id и два массива одинаковой длины: Timestamps[] и Values[]. Пропущенного дня в массивах просто нет — ни 0, ни null на его месте не будет.

Чтобы получить таблицу, добавь к команде | jq -r '…':


jq -r '[.MetricDataResults[] | {id: .Id, p: ([.Timestamps, .Values] | transpose)}] as $r
  | ($r[0].p | map(.[0])) as $days
  | ["date","sessions","visitors"], ($days[] as $d | [$d[0:10]] + ($r | map((.p[] | select(.[0]==$d) | .[1]) // null)))
  | @tsv'
date        sessions  visitors
2026-11-15  222.0     190.0
2026-11-16  178.0     156.0
2026-11-17  206.0     215.0


За последний день (вчера по UTC):

aws cloudwatch get-metric-data \
  --metric-data-queries file://traffic-queries.json \
  --start-time "$(date -u -d yesterday +%Y-%m-%dT00:00:00Z)" \
  --end-time   "$(date -u +%Y-%m-%dT00:00:00Z)" \
  --query 'MetricDataResults[].[Id, Timestamps[0], Values[0]]' --output text
sessions  2026-11-17T00:00:00+00:00  206.0
visitors  2026-11-17T00:00:00+00:00  215.0
До 00:05 UTC здесь будет None.

4. Первоначальная загрузка (init)

START=$(date -u -d "450 days ago" +%Y-%m-%dT00:00:00Z)
END=$(date -u +%Y-%m-%dT00:00:00Z)
aws cloudwatch get-metric-data --metric-data-queries file://traffic-queries.json \
  --start-time "$START" --end-time "$END" --scan-by TimestampAscending --output jsonСейчас эта команда возвращает все 205 дней. Страницы CLI листает сам.