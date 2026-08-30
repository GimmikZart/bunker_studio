alter table public.review_findings enable row level security;

create policy review_finding_tenant_isolation on public.review_findings
  for all
  using (
    exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and public.is_organization_member(r.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and public.is_organization_member(r.organization_id)
    )
  );
