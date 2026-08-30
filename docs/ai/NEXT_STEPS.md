# Next Steps

## Prossima attività

Eseguire in quality la verifica degli scenari ancora `PARTIAL`: sessione cloud da secondo device, restart multi-process pg-boss, integrazione GitHub/CI protetta, Web Push su device in background e smoke Ollama/LM Studio.

### Area interessata

`docs/quality/ACCEPTANCE_MATRIX.md`, `docs/quality/BACKUP_RESTORE_DRILL.md`, `docs/DEPLOYMENT.md` e configurazione quality isolata.

### Comportamento atteso

Ogni scenario `PARTIAL` deve avere una verifica manuale ripetibile con credenziali e budget espliciti; nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
