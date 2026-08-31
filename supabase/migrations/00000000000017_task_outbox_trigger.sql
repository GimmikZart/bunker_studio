create or replace function public.enqueue_task_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'QUEUED'::public.task_state
    and (tg_op = 'INSERT' or old.state is distinct from new.state)
  then
    insert into public.outbox_events (event_type, payload_json, available_at)
    values (
      'task.run',
      jsonb_build_object(
        'taskId', new.id,
        'organizationId', new.organization_id,
        'projectId', new.project_id,
        'retryCount', new.retry_count
      ),
      now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_task_outbox on public.tasks;
create trigger enqueue_task_outbox
after insert or update of state on public.tasks
for each row execute function public.enqueue_task_outbox();
