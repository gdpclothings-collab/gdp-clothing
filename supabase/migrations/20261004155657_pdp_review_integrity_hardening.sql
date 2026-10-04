-- PDP review integrity hardening.
-- Keeps the existing storefront submission shape compatible while making all
-- trust-sensitive fields server-derived and limiting customer mutations.

create or replace function public.enforce_review_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_user_meta jsonb := '{}'::jsonb;
  v_product_name text;
begin
  if tg_op = 'INSERT' then
    if v_uid is null then
      raise exception 'authentication required to submit a review' using errcode = '42501';
    end if;

    select
      u.email,
      u.email_confirmed_at,
      coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_email_confirmed_at, v_user_meta
    from auth.users u
    where u.id = v_uid;

    if not found then
      raise exception 'authenticated review customer was not found' using errcode = '42501';
    end if;

    select p.name
    into v_product_name
    from public.products p
    where p.id = new.product_id;

    if not found then
      raise exception 'review product was not found' using errcode = '23503';
    end if;

    new.user_id := v_uid;
    new.product_name := v_product_name;
    new.customer_email := nullif(btrim(v_email), '');
    new.customer_name := coalesce(
      nullif(btrim(v_user_meta ->> 'full_name'), ''),
      nullif(btrim(v_user_meta ->> 'name'), ''),
      nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
      'GDP customer'
    );
    new.title := nullif(btrim(coalesce(new.title, '')), '');
    new.body := btrim(coalesce(new.body, ''));
    new.images := '{}'::text[];
    new.status := 'pending';

    if char_length(new.body) < 1 or char_length(new.body) > 1500 then
      raise exception 'review body must contain between 1 and 1500 characters' using errcode = '22023';
    end if;

    if new.title is not null and char_length(new.title) > 120 then
      raise exception 'review title must not exceed 120 characters' using errcode = '22023';
    end if;

    select exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where oi.product_id = new.product_id
        and coalesce(o.payment_mode, 'live') = 'live'
        and (
          o.payment_status = 'paid'
          or (
            o.status = 'completed'
            and coalesce(o.payment_status, '') not in ('failed', 'pending')
          )
        )
        and (
          o.user_id = v_uid
          or (
            v_email_confirmed_at is not null
            and nullif(btrim(v_email), '') is not null
            and nullif(btrim(o.customer_email), '') is not null
            and lower(btrim(o.customer_email)) = lower(btrim(v_email))
          )
        )
    ) into new.verified;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Review content and trust identity are immutable after submission.
    -- Admin moderation is intentionally status-only.
    new.product_id := old.product_id;
    new.user_id := old.user_id;
    new.product_name := old.product_name;
    new.customer_name := old.customer_name;
    new.customer_email := old.customer_email;
    new.rating := old.rating;
    new.title := old.title;
    new.body := old.body;
    new.images := old.images;
    new.verified := old.verified;
    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_review_integrity() from public, anon, authenticated;

drop trigger if exists reviews_enforce_integrity on public.reviews;
create trigger reviews_enforce_integrity
before insert or update on public.reviews
for each row
execute function public.enforce_review_integrity();

-- Anonymous visitors may read approved reviews, but may never mutate them.
revoke insert, update, delete on table public.reviews from anon;

-- Authenticated customers can submit reviews. Updates are reserved for the
-- existing admin moderation path and limited at the SQL privilege layer to status.
revoke update, delete on table public.reviews from authenticated;
grant select, insert on table public.reviews to authenticated;
grant update (status) on table public.reviews to authenticated;

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_authenticated_insert
on public.reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

drop policy if exists reviews_update_own_pending on public.reviews;
create policy reviews_admin_status_update
on public.reviews
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

comment on function public.enforce_review_integrity() is
  'Server-derives review identity and verified-purchase status; verified purchase requires a matching live paid/completed product order and cannot be supplied or edited by the client.';
