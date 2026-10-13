#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 <<'SQL'
insert into public.orders(id,customer_email,discount_code,payment_status,payment_mode,subtotal,discount)
values
 ('00000000-0000-4000-8000-000000000006','race@example.com','WELCOME10','pending','test',100,10),
 ('00000000-0000-4000-8000-000000000007','race@example.com','WELCOME10','pending','test',100,10);
SQL
one="BEGIN; SELECT public.reserve_welcome10_coupon('00000000-0000-4000-8000-000000000006', (select id from public.discounts where code='WELCOME10'), now()+interval '30 minutes','race@example.com'); SELECT pg_sleep(1); COMMIT;"
two="BEGIN; SELECT public.reserve_welcome10_coupon('00000000-0000-4000-8000-000000000007', (select id from public.discounts where code='WELCOME10'), now()+interval '30 minutes','race@example.com'); COMMIT;"
psql -v ON_ERROR_STOP=1 -c "$one" > /tmp/welcome-race-1.log 2>&1 &
pid1=$!
sleep 0.15
psql -v ON_ERROR_STOP=1 -c "$two" > /tmp/welcome-race-2.log 2>&1 &
pid2=$!
set +e
wait "$pid1"
rc1=$?
wait "$pid2"
rc2=$?
set -e
cat /tmp/welcome-race-1.log
cat /tmp/welcome-race-2.log
if [[ "$rc1" -ne 0 || "$rc2" -eq 0 ]] || ! grep -q "WELCOME_ALREADY_RESERVED" /tmp/welcome-race-2.log; then
  echo "FAIL: expected one WELCOME10 reservation and an eligibility rejection for the other"
  exit 1
fi
count="$(psql -At -c "select count(*) from public.order_coupon_reservations where order_id in ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007') and status='active'")"
if [[ "$count" != "1" ]]; then
  echo "FAIL: expected exactly one active reservation; got $count"
  exit 1
fi
echo "PASS: concurrent real migration reservations; one winner, no deadlock"
