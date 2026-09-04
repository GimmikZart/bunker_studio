# Current Project State

## Checkpoint 2026-09-04 — GitHub per organizzazione, vista progetti e run reali

Tre correzioni con lo stesso filo conduttore: quello che il sistema sa gia' non
deve essere richiesto di nuovo all'utente, e quello che scrive deve esistere
davvero nel database.

- **Il cost ledger scriveva run inesistenti.** `cost_ledger.run_id` e' una
  foreign key su `agent_runs`, ma cinque route generavano l'id con
  `crypto.randomUUID()` senza inserire la riga: chat, design, review,
  pianificazione e riunioni fallivano tutte con
  `violates foreign key constraint "cost_ledger_run_id_fkey"` dopo aver gia'
  pagato l'inferenza. Ora `startAgentRun` apre la riga in `agent_runs` prima
  della chiamata al provider e `finishAgentRun` la chiude come `COMPLETED` o
  `FAILED`; il ledger cita quell'id. Nella chat un errore di scrittura del costo
  non cancella piu' la risposta: torna con un `warning`.
- **L'account GitHub appartiene all'organizzazione.** Nuova tabella
  `github_connections` (migrazione `00000000000034`), collegata una sola volta
  in Settings. Un'organizzazione puo' averne piu' di uno, quindi repository di
  utenti o organizzazioni GitHub diverse restano raggiungibili. Il token e'
  cifrato con `STUDIO_MASTER_KEY` e non torna mai al browser.
- **Creare un progetto non richiede piu' di ricopiare owner, repo e branch.**
  `GET /api/organizations/:id/github/repositories` elenca cio' che il token
  vede; il progetto sceglie da quella lista e il branch di default arriva da
  GitHub. `POST /api/projects/:id/repository` accetta `githubConnectionId` e
  riusa la credenziale gia' verificata.
- **La pagina Progetti e' una board di card.** `/projects` mostra una card per
  progetto — repository, agenti allocati, task in volo, fatti e bloccati — con
  un dettaglio espandibile; la creazione ha una vista dedicata `/projects/new`.
  Un progetto senza repository puo' collegarlo dalla card stessa.
- **I campi avanzati dell'agente non chiedono piu' di indovinare.** `Role key`
  e' una scelta fra i ruoli che il sistema riconosce davvero (solo `reviewer`
  puo' produrre una review); skills, tools e permissions sono checkbox sul
  vocabolario realmente usato, con la possibilita' di aggiungere valori propri.
  L'aiuto contestuale dice cosa sono davvero: dichiarazioni che accompagnano il
  run, non un controllo di accesso — i limiti effettivi restano lo scope
  read/write del task, gli approval gate e i permessi del token GitHub.

Migrazione richiesta prima dell'uso: `supabase db push` (aggiunge
`github_connections` e `repo_connections.github_connection_id`).

## Checkpoint 2026-09-03 — I sei ruoli sono collegati al provider

Lead, Reviewer, Designer e i partecipanti alle riunioni invocano ora il modello
tramite il binding provider del singolo agente. Ogni transizione di stato resta
deterministica: il modello propone, il motore valida, l'utente accetta.

- Il Lead decompone un obiettivo in un piano. `POST /api/workflows/plan/generate`
  restituisce una proposta e non persiste nulla; `POST /api/workflows/plan` la
  trasforma in task. Entrambi applicano gli stessi gate deterministici, quindi
  un piano che viola le regole non entra nemmeno inviandolo direttamente.
- Le riunioni raccolgono un contributo reale per partecipante e per round con
  digest bounded. Il verbale e' redatto dal Lead ma validato: un action item
  puo' essere assegnato solo a chi era presente e una bozza non utilizzabile
  produce zero decisioni invece di decisioni inventate.
- Il Designer restituisce dati strutturati, mai markup. L'anteprima e'
  renderizzata dallo studio con escaping e colori riconvalidati; se la risposta
  non rispetta il contratto si ricade sul generatore deterministico.
- Il Reviewer legge il diff della PR con la credenziale cifrata e riporta
  finding. `PASS`/`FIX_REQUIRED` e' derivato dai finding e lo SHA e' quello
  inviato: un modello non puo' dichiarare pulito un candidato con finding
  bloccanti.
- Pianificazione, riunioni, design e review passano dalle budget policy prima
  della chiamata provider e scrivono nel cost ledger.
- `.gitattributes` normalizza le fine riga a LF: senza, un checkout Windows con
  `core.autocrlf=true` faceva fallire `prettier --check` su 275 file.
- `docs/GO_LIVE.md` elenca i collegamenti che restano all'utente.

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

M11 e' completata localmente: Cost Center mostra metriche deterministicamente
derivate dal ledger, forecast, policy hard-cap, top cost driver e stato provider;
l'inbox in-app conserva read/unread e deep link. Il budget viene rivalutato nel
claim SQL del worker sotto lock sulle policy/ledger, prima di fornire credenziali
provider: un hard cap blocca il task e crea la notifica. Scheduler report
settimanale, preferenze e adapter Web Push erano gia' presenti e sono testati.
La prima attivita' incompleta e' l'audit M12 Local Worker.

M12 e' completata localmente: il worker PC usa solo connessioni outbound verso
il control plane, con token di registrazione monouso, credenziale persistita con
permessi ristretti, heartbeat, claim/renew/reclaim, capability e scope. Settings
mostra offline un heartbeat assente da tre intervalli e permette a Owner/Admin di
revocare il worker tenant-scoped; la revoca impedisce nuovi claim e il lavoro
attivo torna eleggibile al reclaim alla scadenza del lease. Il supporto generico
OpenAI-compatible copre il futuro collegamento a Ollama/LM Studio senza rendere
un modello locale un requisito. La prima attivita' incompleta e' l'audit M13
Export / Import / Multiuser Foundations.

M13 e' completata localmente: export/import versionato conserva relazioni e
mette le connessioni provider in `REQUIRES_REAUTH`, senza esportare credenziali.
Settings rende disponibili download Owner-only e import controllato; l'import
crea sempre un nuovo tenant. Owner/Admin/Member/Viewer sono presenti in schema,
RLS e API; solo l'Owner puo' esportare, aggiungere/rimuovere collaboratori e non
puo' essere rimosso o declassato neppure tramite la policy RLS diretta. La prima
attivita' incompleta e' l'audit finale della Definition of Done e delle quality
verification esterne.

## Verifiche correnti

- `pnpm verify` (2026-09-03): PASS — format, lint, typecheck, 26 task di test,
  15 build e audit senza vulnerabilità note.
- Orchestration 11 file / 79 test, web 30 file / 65 test, worker 12 file / 32
  test, git 3 file / 14 test: PASS.
- `pnpm test:e2e` con `BUNKER_PERSISTENCE_MODE=memory`: PASS — 10 flussi
  funzionali dev + 1 performance p95 su build production.
- Web: 23 file / 41 test PASS; worker: 12 file / 32 test PASS; Git: 12 test
  PASS; orchestration: 23 test PASS; contracts: 5 test PASS.
- Test M7 API/unit: PASS (3/3); E2E M7: PASS - brief, due preview sicure,
  Owner approve e task FRONTEND con riferimento esatto.
- `supabase db reset --local`: PASS con migrazioni `00..29` e seed.
- `supabase db lint --local`: PASS, nessun errore schema.
- M11: test API budget/task/inbox 8/8, core budget/cost 5/5 e worker report
  scheduler 2/2: PASS; E2E Cost Center + inbox: PASS; lint workspace, typecheck
  web, format e build production: PASS.
- `supabase db reset --local`: PASS con migrazioni `00..29`; `supabase db lint
  --local`: PASS. Smoke transazionale del claim gate: task sopra hard cap ->
  `BLOCKED`, una notifica BUDGET, poi rollback.
- M12: test DB scheduler/heartbeat 4/4 e API revoca Owner 1/1: PASS; format,
  lint workspace 15/15, typecheck 15/15, build production web e `pnpm test:e2e`
  (15 flussi funzionali + smoke p95 production): PASS.
- M13: API membership/export/import 4/4, reset/lint Supabase con migrazioni
  `00..30` e trigger Owner presente: PASS; lint e typecheck workspace 15/15,
  build web e `pnpm test:e2e` (15 flussi funzionali + smoke p95 production):
  PASS.

## Limiti e verifiche esterne pendenti

- Il percorso completo del Reviewer richiede un repository GitHub collegato: in
  modalità memoria l'endpoint risponde 503. I gate di autorizzazione e le regole
  di composizione sono testati; il giro end-to-end ricade sotto AC-009.
- Nessuna inferenza OpenAI a pagamento, push su repository reale, merge o
  deploy è stata effettuata automaticamente. Adapter, fake e contract test sono
  verdi; la prova GitHub/CI reale richiede credenziali dell'utente.
- Restano gli scenari quality esterni tracciati nella matrice acceptance:
  recovery cloud/secondo device, pg-boss quality multi-process, GitHub/CI
  protetto reale, VAPID push su device e backup/restore. Web Push reale richiede
  VAPID e un browser/device supportato; non e' stato simulato con credenziali.
- Ollama/LM Studio reale resta esplicitamente differito e non bloccante finché
  non sarà disponibile hardware adeguato.

## Ultimo aggiornamento

2026-09-04
