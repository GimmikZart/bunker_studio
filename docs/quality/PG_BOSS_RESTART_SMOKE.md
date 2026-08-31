# pg-boss multi-process restart smoke

This smoke uses two separate Node processes against the configured PostgreSQL
database. The first process claims a job and exits before completing it; after
the one-second lease expires, the second process must claim the same job. The
job is completed only after the restarted process claims it.

Run it against a disposable local or quality database. The connection string is
read only from `BUNKER_PG_BOSS_DATABASE_URL` or `DATABASE_URL` and is never
printed:

```powershell
$env:BUNKER_PG_BOSS_DATABASE_URL = '<disposable-postgres-url>'
pnpm quality:pg-boss-restart
```

The command creates a timestamped queue and emits a final
`pg_boss_restart_smoke` event with `status: PASS`. The quality acceptance for
AC-006 still requires running the same scenario with the isolated quality
deployment and recording the result in the release worklog.
