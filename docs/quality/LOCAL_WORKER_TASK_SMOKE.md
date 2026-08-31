# Local worker task smoke

The local control plane is covered by migration
`00000000000016_local_worker_tasks.sql` and the worker client/loop tests.
The PostgreSQL smoke must use only disposable local or quality data and must
rollback its fixture data.

The expected sequence is:

1. register two local nodes with the same capability and allowed workspace
   scope;
2. create a `QUEUED` task with a matching `required_capability` and scopes;
3. claim it with node A and verify the second claim is blocked by capacity;
4. complete it and verify the task is `IMPLEMENTED` and `active_jobs` returns
   to zero;
5. claim another task with node A, expire its lease, and verify node B can
   reclaim it while the task returns to `QUEUED` before the new claim.

The worker daemon executes a claimed task only when
`LOCAL_PROVIDER_ENDPOINT` is configured. Provider credentials remain local to
the daemon and are never returned by the control plane.
