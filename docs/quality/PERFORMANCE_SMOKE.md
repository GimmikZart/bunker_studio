# Performance smoke

The repository-level performance target for normal page responses is p95 `< 800 ms`,
excluding provider calls. The Playwright smoke warms each core route and then records
five `request.get` samples for `/`, `/agents`, `/studio-labs`, `/tasks` and `/settings`.

Run the focused check with:

```bash
pnpm exec playwright test tests/e2e/performance-smoke.spec.ts
```

Run it as part of the complete critical-path suite with:

```bash
pnpm test:e2e
```

This is a local/quality smoke, not a substitute for production observability of p95
realtime updates, task scheduling or approval propagation.
