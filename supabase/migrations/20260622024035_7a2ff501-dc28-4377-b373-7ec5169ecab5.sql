
create table public.tenant_member_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_member_id uuid not null references public.tenant_members(id) on delete cascade,
  boost_module_id uuid not null references public.boost_modules(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_member_id, boost_module_id)
);

grant select, insert, update, delete on public.tenant_member_modules to authenticated;
grant all on public.tenant_member_modules to service_role;

alter table public.tenant_member_modules enable row level security;

-- Super admins manage everything
create policy "super_admin manage tenant_member_modules"
  on public.tenant_member_modules for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Tenant admins manage assignments for members of their tenant
create policy "tenant_admin manage tenant_member_modules"
  on public.tenant_member_modules for all
  to authenticated
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.id = tenant_member_modules.tenant_member_id
        and public.has_tenant_role(tm.tenant_id, auth.uid(), 'tenant_admin')
    )
  )
  with check (
    exists (
      select 1 from public.tenant_members tm
      where tm.id = tenant_member_modules.tenant_member_id
        and public.has_tenant_role(tm.tenant_id, auth.uid(), 'tenant_admin')
    )
  );

-- Members can view their own assignments
create policy "members view own module assignments"
  on public.tenant_member_modules for select
  to authenticated
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.id = tenant_member_modules.tenant_member_id
        and tm.user_id = auth.uid()
    )
  );
