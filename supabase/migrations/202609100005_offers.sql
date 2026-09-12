BEGIN;
create table app.offers(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references app.organizations,
 title text not null check(char_length(title) between 2 and 120),
 description text not null default '' check(char_length(description)<=500),
 festival text not null default '' check(char_length(festival)<=60),
 offer_type text not null check(offer_type in ('PERCENT','AMOUNT','FREE_FUEL','BONUS_POINTS')),
 value integer not null check(value>0),
 min_amount_paise bigint not null default 0 check(min_amount_paise>=0),
 fuel_name text,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 active boolean not null default true,
 created_by uuid not null references app.users(id),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check((offer_type='PERCENT' and value between 1 and 100) or offer_type<>'PERCENT'),
 unique(organization_id,id)
);
create index offers_public_window on app.offers(organization_id,active,starts_at,ends_at);
create index offers_recent on app.offers(organization_id,created_at desc);
alter table app.offers enable row level security;
alter table app.offers force row level security;
create policy offer_read on app.offers for select to fuelpulse_app using(organization_id=app.org());
create policy offer_manage on app.offers for all to fuelpulse_app using(organization_id=app.org() and app.role() in ('OWNER','MANAGER')) with check(organization_id=app.org() and app.role() in ('OWNER','MANAGER') and created_by=app.actor());
create policy offer_gateway_read on app.offers for select to fuelpulse_gateway using(current_user='fuelpulse_gateway' and active=true);
grant select,insert,update,delete on app.offers to fuelpulse_app;
grant select on app.offers to fuelpulse_gateway;
COMMIT;
