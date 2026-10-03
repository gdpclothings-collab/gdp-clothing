-- Remove unnecessary direct execution access from trigger-only SECURITY DEFINER functions.
-- These functions remain attached to their existing triggers; this only closes the
-- PostgREST/RPC execution path for anonymous and normal authenticated users.

revoke execute on function public.seed_inventory_level_for_variant() from public, anon, authenticated;
revoke execute on function public.seed_inventory_levels_when_tracking_enabled() from public, anon, authenticated;
revoke execute on function public.sync_inventory_level_to_variant_stock() from public, anon, authenticated;
revoke execute on function public.sync_variant_stock_to_inventory_level() from public, anon, authenticated;
