-- Increase DTF gang-sheet pricing by exactly 75% while preserving the graduated pricing model.
-- Standard: $0.028 -> $0.049 per in²
-- Volume:   $0.025 -> $0.04375 per in²

update public.store_settings
set dtf_settings = jsonb_set(
  jsonb_set(
    coalesce(dtf_settings, '{}'::jsonb),
    '{standardRate}',
    to_jsonb(0.049::numeric),
    true
  ),
  '{volumeRate}',
  to_jsonb(0.04375::numeric),
  true
)
where id = 1;
