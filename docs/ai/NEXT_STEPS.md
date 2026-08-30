# Next Steps

## Prossima attività

Collegare il runtime provider configurato alla chat production e persistere conversazioni/messaggi con RLS; mantenere `FakeRuntime` solo per fixture locali e aggiungere contract test per il percorso provider-independent.

### Area interessata

`packages/agent-runtime/src/`, `packages/config/src/`, `apps/web/app/api/`, `supabase/migrations/` e `docs/quality/ACCEPTANCE_MATRIX.md`.

### Comportamento atteso

Le richieste production devono usare client Supabase SSR con RLS; lo store in-memory è ammesso solo per fixture non-production. Nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
