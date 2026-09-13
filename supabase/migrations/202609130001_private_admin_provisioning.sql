BEGIN;

create table app.admin_sessions(
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table app.admin_sessions enable row level security;
alter table app.admin_sessions force row level security;
revoke all on app.admin_sessions from public;
grant select,insert,delete on app.admin_sessions to fuelpulse_gateway;

create or replace function app.admin_provision_owner(
  p_org_name text,
  p_slug text,
  p_owner_name text,
  p_owner_code text,
  p_password_hash text
) returns table(organization_id uuid, owner_id uuid, station_slug text, owner_code text)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
  v_org uuid;
  v_owner uuid;
begin
  if p_org_name is null or char_length(trim(p_org_name)) not between 2 and 120 then
    raise exception 'Invalid organization name';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception 'Invalid station ID';
  end if;
  if p_owner_name is null or char_length(trim(p_owner_name)) not between 2 and 120 then
    raise exception 'Invalid owner name';
  end if;
  if p_owner_code is null or p_owner_code !~ '^FP-OWN-[A-Z0-9]{6}$' then
    raise exception 'Invalid owner code';
  end if;
  if p_password_hash is null or char_length(p_password_hash) < 20 then
    raise exception 'Invalid password hash';
  end if;

  insert into app.organizations(slug,name) values(lower(trim(p_slug)),trim(p_org_name)) returning id into v_org;
  insert into app.users(organization_id,code,name,role,active)
    values(v_org,upper(trim(p_owner_code)),trim(p_owner_name),'OWNER',true)
    returning id into v_owner;
  insert into app.credentials(user_id,password_hash) values(v_owner,p_password_hash);

  return query select v_org,v_owner,lower(trim(p_slug)),upper(trim(p_owner_code));
end;
$$;

revoke all on function app.admin_provision_owner(text,text,text,text,text) from public;
grant execute on function app.admin_provision_owner(text,text,text,text,text) to fuelpulse_gateway;

COMMIT;
