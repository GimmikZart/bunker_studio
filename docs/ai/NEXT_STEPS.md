# Next Steps

## Completato — UI audit

L’audit funzionale Playwright UI-001–UI-008 passa tutti i 13 checkpoint: CTA home, onboarding, progetto, agente da template/provider, task DRAFT→READY, design gate, Settings/provider, navigazione desktop/mobile, hard refresh e responsive. L’audit attende ora la hydration client prima dei click e usa selettori coerenti con il markup accessibile.

## Prossima attività precisa

Eseguire la prova locale con OpenAI descritta nella sezione "Prima di pubblicare" di [`docs/quality/QUALITY_SETUP_GUIDE.md`](../quality/QUALITY_SETUP_GUIDE.md): creare `.env.local` con `LOCAL_PROVIDER_*`, avviare `pnpm dev` e verificare signup, organizzazione, progetto, agente e chat. Poi passare al test Supabase cloud senza Vercel e solo dopo al deploy Vercel.

Il codice locale, incluso il piano Lead persistito in `POST /api/workflows/plan`, è verificato; dopo AC-001 procedere con AC-006, AC-009 e AC-011. Non cambiare `CURRENT_STATE.md` a `IMPLEMENTAZIONE COMPLETATA` finché queste quattro verifiche esterne e il backup/restore drill non sono concluse. AC-013 local worker è esplicitamente non bloccante: resta pronto per una futura macchina con hardware adeguato.

## Prossima attività

Eseguire nella quality isolata i quattro scenari `PARTIAL` bloccanti della matrice (PC loss cloud, restart multi-processo pg-boss, GitHub/CI protetto e VAPID/device), registrando evidenze e RPO/RTO del backup drill. Non serve predisporre ora Ollama o LM Studio.

### Area interessata

`docs/quality/ACCEPTANCE_MATRIX.md`, `docs/quality/BACKUP_RESTORE_DRILL.md` e `docs/DEPLOYMENT.md`.

### Comportamento atteso

Le richieste production devono usare client Supabase SSR con RLS; lo store in-memory è ammesso solo per fixture non-production. Nessun test deve bypassare autorizzazioni, budget o approval gate.

### Definition of Done locale

AC-001..AC-014 tracciati con esito, test verdi, eventuali blocker esterni separati dal codice e documentazione backup/restore/accessi quality aggiornata. Nessuna modifica al codice è richiesta prima di disporre degli accessi quality/device/runtime indicati.

### Verifica

Eseguire `pnpm verify`, `pnpm test:e2e`, `pnpm audit --audit-level high`, `supabase db reset --local` e il controllo manuale dei flussi che richiedono credenziali/device.
