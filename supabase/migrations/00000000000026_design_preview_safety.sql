-- M7: bounded, tenant-scoped HTML preview artifacts and immutable approved design content.
alter table public.design_versions
  add constraint design_versions_preview_artifact_limit
  check (jsonb_typeof(preview_artifact_ids) = 'array' and jsonb_array_length(preview_artifact_ids) <= 3)
  not valid;

alter table public.design_versions validate constraint design_versions_preview_artifact_limit;

alter table public.artifacts
  add constraint artifacts_metadata_size_limit
  check (octet_length(metadata_json::text) <= 65536)
  not valid;

alter table public.artifacts validate constraint artifacts_metadata_size_limit;

create or replace function public.protect_approved_design_version()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'APPROVED' then
    if new.status <> 'SUPERSEDED'
      or new.design_request_id is distinct from old.design_request_id
      or new.version_number is distinct from old.version_number
      or new.spec_json is distinct from old.spec_json
      or new.rationale is distinct from old.rationale
      or new.preview_artifact_ids is distinct from old.preview_artifact_ids
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at then
      raise exception 'Approved design version content is immutable.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_approved_design_version on public.design_versions;
create trigger protect_approved_design_version
before update on public.design_versions
for each row execute function public.protect_approved_design_version();

create or replace function public.prevent_approved_design_version_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'APPROVED' then
    raise exception 'Approved design versions cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_approved_design_version_delete on public.design_versions;
create trigger prevent_approved_design_version_delete
before delete on public.design_versions
for each row execute function public.prevent_approved_design_version_delete();
