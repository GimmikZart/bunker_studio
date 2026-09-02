# Current Project State

## Checkpoint 2026-09-01 — M7 Designer workflow completato localmente

Bunker Studio supporta il percorso iniziale richiesto: web locale o ospitato,
Supabase Cloud come system of record e worker repository sul PC in pull via
HTTPS. Provider, modello, runtime e reasoning sono binding versionati del singolo
agente; non esiste un modello globale negli env. OpenAI e Anthropic sono
opzionali e il runtime locale futuro rimane non bloccante.

Un task `CODEX_SDK` usa un workspace Git isolato e il branch dedicato
`bunker/<task-id>`. Esegue verifiche deterministiche senza shell né secret nel
process environment, poi crea/aggiorna una sola PR GitHub del branch candidato.
Il sistema acquisisce check-runs e commit-status per lo SHA esatto, li conserva
come evidence bounded e non consente merge, deploy, review finale o completion
se verification, CI o reviewer non soddisfano i gate deterministici.

## Implementato e verificato

- Binding per agente provider/modello/runtime/reasoning, catalogo modelli e
  cifratura AES-256-GCM delle credenziali provider/repository.
- Worker locale autenticato con lease rinnovabile, retry durable, capability
  matching, workspace Git effimero, write scope e commit/push solo dopo PASS.
- Piano verification strutturato: `execFile`, no shell interpolation, timeout,
  output bounded, allowlist eseguibili e baseline `SECURITY` obbligatoria per
  task Codex repository.
- PR GitHub idempotente: lookup owner/head/base, aggiornamento/riapertura della
  stessa PR al retry, validazione base/head/SHA ed esclusione di secret da titolo,
  body, errori ed evidence.
- Ingestione CI per SHA candidato: check-runs + commit-status, `PASS`/`FAIL`/
  `PENDING`, massimo 200 evidence idempotenti per ciclo e nessun log remoto
  copiato nel database.
- Task UI con branch/SHA, PR, stato CI, refresh CI protetto server-side e
  script verification; reviewer può completare o richiedere fix solo sullo SHA
  esatto. Fix task conserva le dipendenze del task originale senza deadlock.
- Migrazioni `00000000000024` (evidence PR/CI) e `00000000000025` (correzione
  forward-only del lint della funzione lease). Reset e lint del database sono
  puliti con le migrazioni `00..25`.
- L'E2E funzionale usa il server dev con persistenza in memoria; il p95 misura
  invece la build production. Le due configurazioni impediscono che la
  compilazione lazy di `next dev` falsi la soglia, senza allentare i criteri.
- M7: contratto bounded `designProposalRequest`, preview HTML statiche
  escaped/sandboxed, persistence di rationale/preview/request ID e migrazione
  `00000000000026` con limite metadata/artefatti e immutabilita' SQL per versioni
  approvate.

## Stato milestone

M0–M7 sono implementate e verificate localmente. M7 riceve brief e constraint
associati a un Designer selezionato e genera una–tre varianti versionate con
rationale, stati principali, design spec e preview HTML statico. Le preview sono
artefatti tenant-scoped bounded e vengono mostrate in iframe sandboxed; il brief
viene HTML-escaped. L'Owner può approvare/rifiutare/richiedere modifiche; i
contenuti di una versione APPROVED sono protetti anche da trigger SQL e un task
FRONTEND conserva l'ID esatto di una versione approvata.

Il generatore statico è il fake/adapter v1 del contratto Designer: mantiene il
flusso funzionante senza una chiamata provider o Figma. Un adapter immagine/Figma
o un Designer provider-backed può sostituirlo senza cambiare contratti, gate o
storage.

M8 e' completata localmente: il flusso Teams raccoglie obiettivo, progetto
opzionale, budget, capability e ruoli; restituisce proposte editabili e richiede
binding provider/modello/reasoning e conferma esplicita prima di creare agenti.
Test API e browser E2E passano. La prima attivita' incompleta e' l'audit M9.

M9 e' completata localmente: pagina Meetings operativa per scheduling/run,
con agenda, partecipanti, massimo tre round, contributi, minutes, decisioni,
azioni e costo. Il test di integrazione con tre agenti verifica il round cap.
La prima attivita' incompleta e' l'audit M10 Memory & Search.

M10 e' completata localmente: retrieval bounded, archivio conversazioni e
provenance erano gia' presenti; il pannello Structured Memory ora permette di
scegliere l'organizzazione, creare, cercare e rimuovere memorie. Le azioni sono
disabilitate finche' il contesto tenant non e' pronto. Test API, typecheck web e
browser E2E di salvataggio/ricerca passano senza iniettare l'archivio nel context.
La prima attivita' incompleta e' l'audit M11 Cost, Budget & Reporting.

## Verifiche correnti

- `pnpm verify`: PASS — format, lint 15/15, typecheck 15/15, test 26/26,
  build 15/15 e audit high senza vulnerabilità note.
- `pnpm test:e2e` con `BUNKER_PERSISTENCE_MODE=memory`: PASS — 10 flussi
  funzionali dev + 1 performance p95 su build production.
- Web: 23 file / 41 test PASS; worker: 12 file / 32 test PASS; Git: 12 test
  PASS; orchestration: 23 test PASS; contracts: 5 test PASS.
- Test M7 API/unit: PASS (3/3); E2E M7: PASS - brief, due preview sicure,
  Owner approve e task FRONTEND con riferimento esatto.
- `supabase db reset --local`: PASS con migrazioni `00..26` e seed.
- `supabase db lint --local`: PASS, nessun errore schema.

## Limiti e verifiche esterne pendenti

- Nessuna inferenza OpenAI a pagamento, push su repository reale, merge o
  deploy è stata effettuata automaticamente. Adapter, fake e contract test sono
  verdi; la prova GitHub/CI reale richiede credenziali dell'utente.
- Restano gli scenari quality esterni tracciati nella matrice acceptance:
  recovery cloud/secondo device, pg-boss quality multi-process, GitHub/CI
  protetto reale, VAPID push su device e backup/restore.
- Ollama/LM Studio reale resta esplicitamente differito e non bloccante finché
  non sarà disponibile hardware adeguato.

## Ultimo aggiornamento

2026-09-02
