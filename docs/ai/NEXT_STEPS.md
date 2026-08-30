# Next Steps

## Prossima attività precisa

Eseguire AC-001 in quality con una sessione Supabase cloud da un secondo dispositivo e registrare evidenza di recupero dopo la perdita del PC principale.

Il codice locale è verificato; dopo AC-001 procedere con gli altri scenari `PARTIAL` già elencati nella matrice. Non cambiare `CURRENT_STATE.md` a `IMPLEMENTAZIONE COMPLETATA` finché tali verifiche esterne non sono concluse.

## Prossima attività

Eseguire nella quality isolata i cinque scenari `PARTIAL` della matrice (PC loss cloud, restart multi-processo pg-boss, GitHub/CI protetto, VAPID/device e Ollama/LM Studio), registrando evidenze e RPO/RTO del backup drill.

### Area interessata

`docs/quality/ACCEPTANCE_MATRIX.md`, `docs/quality/BACKUP_RESTORE_DRILL.md` e `docs/DEPLOYMENT.md`.

### Comportamento atteso

Le richieste production devono usare client Supabase SSR con RLS; lo store in-memory è ammesso solo per fixture non-production. Nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata. Nessuna modifica al codice è richiesta prima di disporre degli accessi quality/device/runtime indicati.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
