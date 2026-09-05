# Current Project State

## Checkpoint 2026-09-05 — Fase 1: il progetto cammina da solo

Fase 1 del framework di consegna (`docs/product/STUDIO_PLAYBOOKS.md`).

- **`packages/orchestration/src/conductor.ts`** decide ogni avanzamento, in modo
  puro e idempotente: promuove le bozze, rimette in coda cio' che la review ha
  respinto, libera i task le cui dipendenze sono `DONE`, parcheggia dietro le
  dipendenze nominandole, blocca cio' che nessuno puo' fare, ferma cio' che il
  budget residuo non copre — spendendolo una volta sola per passata — e non
  avvia due task che scrivono gli stessi percorsi.
- **Il momento in cui avanza** non e' un timer ma un evento: un piano
  committato, un agente che entra nel progetto, un task che finisce. Un secondo
  passaggio non cambia nulla, quindi tutte queste chiamate convivono.
- **Anche senza browser aperto.** Il worker, finito un task, chiama
  `POST /api/workers/runtime/projects/advance` con la credenziale che ha gia';
  il control plane autentica il nodo e agisce come owner dell'organizzazione
  (DEC-023). Un fallimento della chiamata non fa fallire il task.
- **Le condizioni di avvio sono una sola** (`apps/web/app/api/_queue-gate.ts`):
  agente assegnato, provider configurato, e per un task Codex write scope,
  comandi di verifica con almeno un controllo di sicurezza e repository GitHub
  collegato. Prima vivevano solo dentro la PATCH di un task; ora il conductor
  applica le stesse, quindi nessuna delle due strade puo' avviare cio' che
  l'altra rifiuterebbe.
- **La modalita' di autonomia del progetto e' il gate** (DEC-022): `AUTONOMOUS`
  e `LAB` avanzano fino al prossimo gate umano, `SUPERVISED` e `MANUAL` si
  fermano a `READY`.
- **La card di progetto mostra il cantiere**: cosa e' in volo, cosa aspetta e
  che cosa esattamente sta aspettando, cosa e' fermo e perche', con un pulsante
  `Advance now`. Il numero in testa alla card e' ora `Open`, non "in flight",
  perche' contava anche cio' che sta fermo.

Verificato in esecuzione: un piano di tre task committato su un progetto con
lead e backend avvia il primo e parcheggia gli altri due dietro le rispettive
dipendenze; un task REVIEW su un progetto senza reviewer diventa `BLOCKED` con
la notifica «A REVIEW task can only be done by an agent whose role is
"reviewer", and this project has none», e passa a `QUEUED` assegnato a Kenji nel
momento in cui il reviewer entra nel progetto, senza nessuna altra chiamata.

Nessuna migrazione richiesta.

## Checkpoint 2026-09-05 — Fase 0: un piano ora ha qualcuno che lo esegue

Il disegno completo del framework di consegna e' in
`docs/product/STUDIO_PLAYBOOKS.md`. Questa e' la sua Fase 0, la sola che
sbloccava tutte le altre.

- **Il collo di bottiglia era l'assegnazione.** `POST /api/workflows/plan`
  creava i task senza `assignedAgentId`, ma `/api/workers/runtime/tasks/claim`
  lo richiede per costruire il contesto di esecuzione: un piano generato dal
  Lead non era eseguibile da nessuno. Non esisteva nemmeno un punto
  nell'interfaccia per mettere un agente su un progetto.
- **Router deterministico** (`packages/orchestration/src/assignment.ts`): la
  capacita' richiesta prima, poi il ruolo che possiede quel tipo di lavoro, poi
  il carico piu' leggero, poi un ordine stabile per id. Nessun LLM decide chi
  fa cosa. `REVIEW` e `DESIGN` sono esclusivi — una review scritta da chi ha
  scritto il codice non e' una review — e un task senza candidati non viene
  assegnato a caso: la risposta del piano lo elenca con il motivo.
- **La squadra si gestisce dal progetto.** Nuovo
  `GET/POST/DELETE /api/projects/:id/agents` e pannello nella card: chi c'e',
  chi puo' entrare, `Move to…` per spostare qualcuno su un altro progetto in
  una sola richiesta, e `Remove`. Lo spostamento libera il progetto vecchio solo
  dopo che la nuova assegnazione esiste.
- **Le capacita' del piano sono quelle del progetto.** Il Lead riceveva le skill
  di tutti gli agenti dell'organizzazione, quindi poteva chiedere una capacita'
  di qualcuno che nessuno aveva messo su quel progetto. Ora l'elenco e' quello
  della squadra reale.
- **La vista `/teams` e' stata rimossa** (DEC-020). La proposta di organico e'
  dentro la card di progetto, dove la domanda e' "chi mi serve per questo
  progetto", e gli assunti vengono messi sul progetto per cui sono stati
  proposti.

Verificato in esecuzione: un piano con un task DOCS e uno REVIEW su un progetto
con frontend e reviewer esce con entrambi assegnati alla persona giusta; lo
stesso piano su un progetto senza reviewer risponde
`A REVIEW task can only be done by an agent whose role is "reviewer"`.

Nessuna migrazione richiesta.

## Checkpoint 2026-09-05 — La vista Agents e' fatta di card, e creare un progetto dice cosa non va

Tre interventi sulla superficie che l'utente tocca ogni giorno.

- **`/agents` e' una directory di card.** Sotto la hero ci sono la select
  dell'organizzazione e il pulsante `Create new agent`, che porta alla vista
  dedicata `/agents/new`. Ogni agente e' una card verticale: avatar, nome,
  ruolo, e la riga `provider | modello | capacita' di reasoning`. In fondo alla
  card `Info` a sinistra e `Talk to them` a destra con un pallino verde; se
  l'agente ha un task in `QUEUED`, `RUNNING` o `VERIFYING` il pulsante diventa
  `Busy`, disabilitato, con il pallino rosso lampeggiante (fermo quando il
  sistema chiede movimento ridotto). L'elenco testuale in fondo alla pagina non
  serve piu' ed e' stato tolto.
- **Parlare con un agente e' una chat, non un campo di testo.** `Talk to them`
  apre un pannello laterale su desktop e a schermo intero su mobile: nome e
  ruolo in alto con l'avatar, lo storico dei messaggi allineato a destra o a
  sinistra secondo chi ha scritto, il compositore in basso con invio a destra
  (Invio manda, Maiusc+Invio va a capo). Lo storico e' reale: nuovo
  `GET /api/agents/:id/chat`, che legge i messaggi in ordine da entrambi i
  modelli di persistenza. La sessione dell'ultimo messaggio viene ripresa, cosi'
  riaprire la chat non azzera il contesto del provider.
- **`Info` apre la scheda completa dell'agente.** Dialog su desktop, schermo
  intero su mobile: ruolo, provider, modello, reasoning, runtime, avatar,
  metriche, e poi Skills, Tools, Permissions e Assignments — questi ultimi con
  il nome del progetto e del team, non l'UUID. Si legge e basta finche' non si
  preme `Edita`; allora tutti i campi diventano modificabili e la coppia di
  pulsanti in fondo diventa `Cancel` / `Save changes`. `Close` resta in basso a
  sinistra.
- **Creare un progetto non risponde piu' "Invalid project payload".** Il nome
  del progetto e' unico per organizzazione attraverso lo slug: un secondo
  "Vrsus App" violava il vincolo `projects_organization_id_slug_key` e la route
  riportava ogni fallimento come payload malformato, mandando l'utente a
  correggere un form corretto. Ora `createProject` alza un `ConflictError` che
  nomina il progetto (409); un payload davvero malformato dice quale campo
  (400); tutto il resto e' un 500 con il motivo. Lo stesso vincolo vale ora
  anche nello store in memoria, cosi' i due modelli di persistenza si comportano
  allo stesso modo.
- **La scelta del repository e' un solo campo.** Il filtro non e' piu' un input
  separato accanto a una select: e' un combobox con autocomplete — si scrive
  dentro il campo che poi contiene la scelta, si naviga con le frecce, si
  conferma con Invio, e il pulsante `Reset` accanto svuota la selezione. Il
  branch di default continua ad arrivare da GitHub.

Correzioni di stile emerse dalla verifica in esecuzione: le checkbox dentro
`.resource-form` non vengono piu' stirate a tutta colonna, un'opzione singola
con la sua etichetta sta su una riga, e i pulsanti delle card si allineano fra
loro anche quando una riga provider va a capo.

Nessuna migrazione richiesta.

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

Correzioni di consegna del 2026-09-05, senza le quali quanto sopra restava
invisibile in esecuzione:

- `pnpm dev` ricompila i pacchetti del workspace prima di avviare web e worker.
  Il web app li importa da `dist/`, quindi un `dist` vecchio faceva girare
  codice vecchio pur avendo sorgenti e typecheck aggiornati.
- La migrazione `31` e' resa ri-eseguibile: una policy gia' presente ma non
  registrata nel ledger bloccava ogni migrazione successiva.
- Un errore non e' piu' un 403. `/api/projects` distingue il rifiuto dal guasto,
  e le route GitHub dicono esplicitamente quando lo schema non e' migrato.

Migrazioni richieste: `supabase db push` (applica `31`-`34`, fra cui
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
