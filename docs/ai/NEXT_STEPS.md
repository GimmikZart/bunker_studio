# Next Steps

## Prossima attività

Completare una UI task/workflow con creazione e transizioni controllate, quindi eseguire accessibility/performance smoke e chiudere la matrice quality esterna.

### Area interessata

`apps/web/app/tasks/`, `apps/web/app/api/tasks/`, `packages/orchestration/`, `docs/quality/ACCEPTANCE_MATRIX.md` e `docs/DEPLOYMENT.md`.

### Comportamento atteso

Le richieste production devono usare client Supabase SSR con RLS; lo store in-memory è ammesso solo per fixture non-production. Nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
