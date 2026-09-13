alter table app.organizations add column if not exists active boolean not null default true;

create or replace function app.admin_set_organization_active(p_org_id uuid, p_active boolean)
returns table(organization_id uuid, active boolean)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
  if p_org_id is null then raise exception 'Organization ID is required'; end if;
  update app.organizations set active = p_active where id = p_org_id returning id, app.organizations.active into organization_id, active;
  if organization_id is null then raise exception 'Organization not found'; end if;
  if not p_active then
    delete from app.sessions s using app.users u where s.user_id=u.id and u.organization_id=p_org_id;
  end if;
  return next;
end;
$$;
revoke all on function app.admin_set_organization_active(uuid, boolean) from public;
grant execute on function app.admin_set_organization_active(uuid, boolean) to fuelpulse_gateway;
