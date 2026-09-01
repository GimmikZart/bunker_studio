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
4. renew its authenticated lease and verify another node cannot reclaim it;
5. complete it and verify the task is `IMPLEMENTED`, execution evidence is
   persisted atomically, and `active_jobs` returns
   to zero;
6. claim another task with node A, expire its lease, and verify node B can
   reclaim it while the task returns to `QUEUED` before the new claim.

The worker daemon executes a claimed task from the provider/model/runtime
binding of its assigned agent. A Codex task additionally requires a connected
GitHub repository, explicit write scopes, an allowed workspace root, and a
worker advertising the `codex` capability. Credentials are encrypted at rest
and sent only to the authenticated worker over HTTPS (or HTTP loopback during
local development); they are never returned to the browser or agent prompt.
