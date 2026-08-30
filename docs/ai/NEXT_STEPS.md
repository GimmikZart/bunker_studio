# Next Steps

## Prossima attività

Completare la matrice acceptance AC-001..AC-014 con fixture E2E/integration per workflow persistente, quota/budget, design gate, push, export/import, local worker e isolamento multiutente.

### Area interessata

`tests/e2e/`, `packages/*/src/*.test.ts`, API task/approval/cost/meeting e integrazione quality worker.

### Comportamento atteso

Ogni scenario AC deve avere una verifica automatizzata quando possibile, oppure una procedura manuale ripetibile documentata quando dipende da provider/browser/device esterni; nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
