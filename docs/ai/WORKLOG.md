# Development Worklog

## 2026-09-05 — Fase 3 del framework: capire e costruire si toccano

### Lavoro svolto

- `packages/orchestration/src/stage.ts`: la fase del progetto derivata dai fatti,
  mai memorizzata (DEC-026). Fasi opzionali `SKIPPED` finche' non servono. 11 test.
- `GET /api/projects/:id/stages`: dove si trova il progetto e cosa lo tiene fermo.
- `POST /api/projects/:id/stages/spec`: il brief approvato diventa un task `DOCS`
  con write scope `docs/`, assegnato a un agente che raggiunge davvero il
  repository; rifiuta con il motivo quando manca il repository, il writer o il
  controllo di sicurezza (DEC-027).
- `POST /api/workflows/plan/generate` accetta `goal` opzionale e usa il brief
  approvato quando manca, esclusioni comprese.
- `project-stages-panel.tsx` nella card di progetto.

### Verifiche

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: PASS.
- `pnpm test`: PASS — orchestration 125 test, worker 34, web 40 file / 127 test.
- `pnpm build`: PASS 15/15. `pnpm security`: nessuna vulnerabilita' nota.
- Verifica in esecuzione (memory mode): progetto nuovo su `discovery`, passaggio
  a `spec` all'approvazione del brief, rifiuto della spec senza repository,
  generazione del piano dal brief approvato e messaggio esplicito quando non c'e'
  ne' goal ne' brief.

### Stato finale

Checkpoint stabile. Prossima attivita': Fase 4, mockup reali in sandbox
(`docs/ai/NEXT_STEPS.md`).

## 2026-09-05 — Fase 2 del framework: il Lead capisce prima di costruire

### Lavoro svolto

- `packages/orchestration/src/playbooks.ts`: tre processi tipizzati composti
  dalle stesse fasi, con `requires` per dichiarare cio' che il studio non sa
  ancora fare (DEC-024).
- `packages/orchestration/src/engagement.ts`: prompt limitato agli ultimi turni e
  lettura della risposta strutturata del Lead. Una chiave di playbook inesistente
  viene corretta al default e la sostituzione e' riportata;
  `readyForApproval` viene forzato a `false` se restano domande aperte.
- `GET/POST /api/projects/:id/engagement` e
  `POST /api/projects/:id/engagement/approve`. Il brief approvato diventa memoria
  di progetto `PINNED`, cosi' viaggia con ogni run successivo.
- `project-engagement-drawer.tsx` e il pulsante `Talk to the Lead` nella card.
- DEC-025: nessun agente ha strumenti; gli adapter non inviano `tools` e cio'
  che serve verra' eseguito dal server con allowlist.

### Verifiche

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: PASS.
- `pnpm test`: PASS — orchestration 114 test, worker 34, web 39 file / 117 test.
- `pnpm build`: PASS 15/15. `pnpm security`: nessuna vulnerabilita' nota.
- Verifica in esecuzione (memory mode): un Lead che si dichiara pronto avendo una
  domanda aperta viene riportato a non pronto; l'approvazione di un brief con
  domande aperte risponde 409; il brief approvato ricompare alla riapertura ed e'
  memoria `PINNED` del progetto.

### Stato finale

Checkpoint stabile. Prossima attivita': Fase 3, dal brief approvato al documento
tecnico e al piano (`docs/ai/NEXT_STEPS.md`).

## 2026-09-05 — Fase 1 del framework: il progetto avanza da solo

### Lavoro svolto

- `packages/orchestration/src/conductor.ts`: funzione pura e idempotente che
  decide ogni avanzamento — bozze, rilascio delle dipendenze, parcheggio con il
  nome di cio' che si aspetta, blocco motivato, budget speso una volta sola per
  passata, scope di scrittura disgiunti, limite di concorrenza. 14 test.
- `apps/web/app/api/_conductor.ts` applica le decisioni: riassegna gli orfani con
  il router della Fase 0, scrive activity e notifica solo cio' che richiede una
  persona.
- Nuovo `POST /api/projects/:projectId/advance`, e avanzamento automatico dopo:
  piano committato, agente aggiunto al progetto, task terminato
  (`DONE`/`CANCELED`/`FAILED_FINAL` soltanto, per non sovrascrivere una
  transizione impostata a mano).
- Nuovo `POST /api/workers/runtime/projects/advance`: il worker, finito un task,
  chiede al control plane di proseguire con la credenziale che ha gia'; il
  control plane agisce come owner dell'organizzazione (DEC-023).
- `apps/web/app/api/_queue-gate.ts`: le condizioni di avvio estratte dalla PATCH
  di un task e condivise con il conductor, cosi' le due strade non possono
  divergere.
- `project-delivery-panel.tsx`: il cantiere nella card di progetto, con
  `Advance now`. Metrica di testa rinominata `Open`.
- DEC-022 (l'autonomia del progetto e' il gate) e DEC-023 (il worker chiede di
  proseguire).

### Verifiche

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: PASS.
- `pnpm test`: PASS — orchestration 102 test, worker 34, web 38 file / 109 test.
- `pnpm build`: PASS 15/15. `pnpm security`: nessuna vulnerabilita' nota.
- Verifica in esecuzione (memory mode): piano di tre task che avvia il primo e
  parcheggia gli altri due dietro le dipendenze giuste; task REVIEW senza
  reviewer che diventa `BLOCKED` con la notifica che nomina il ruolo mancante e
  passa a `QUEUED` assegnato appena il reviewer entra nel progetto.

### Stato finale

Checkpoint stabile. Prossima attivita': Fase 2, ingaggio del Lead e documento
tecnico nel repository (`docs/ai/NEXT_STEPS.md`).

## 2026-09-05 — Fase 0 del framework: chi esegue un piano

### Lavoro svolto

- `packages/orchestration/src/assignment.ts`: router deterministico task →
  agente. Capacita' richiesta, poi ruolo che possiede il tipo di lavoro, poi
  carico, poi ordine stabile per id. `REVIEW` e `DESIGN` sono esclusivi del
  ruolo corrispondente; un task senza candidati non viene assegnato e il motivo
  viene riportato.
- `POST /api/workflows/plan` assegna ogni task alla creazione e restituisce
  `unassigned` con titolo e motivo per quelli che nessuno puo' prendere. Le
  `teamCapabilities` offerte al Lead sono ora quelle degli agenti assegnati al
  progetto, non di tutta l'organizzazione.
- Nuovo `GET/POST/DELETE /api/projects/:projectId/agents` e
  `project-team-panel.tsx` dentro la card di progetto: membri, agenti
  disponibili, spostamento su un altro progetto in una richiesta sola,
  rimozione.
- `TeamBuilderPanel` accetta organizzazione e progetto come props, vive dentro
  la card di progetto e mette sul progetto gli agenti appena assunti.
- Rimossi la vista `/teams`, `team-crud-panel.tsx` e la voce di navigazione
  (DEC-020). Aggiornato il test E2E che ci passava.
- `docs/product/STUDIO_PLAYBOOKS.md` con il disegno del framework di consegna;
  DEC-020 (Team fuori dall'interfaccia) e DEC-021 (mockup reali in sandbox).

### Verifiche

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: PASS.
- `pnpm test`: PASS — 26 task, orchestration 88 test (8 nuovi sul router), web
  37 file / 104 test (6 nuovi su squadra di progetto e assegnazione del piano).
- `pnpm build`: PASS 15/15. `pnpm security`: nessuna vulnerabilita' nota.
- Verifica in esecuzione (memory mode): assegnazione, spostamento fra progetti
  con l'agente su un solo progetto alla fine, rimozione; piano DOCS+REVIEW su un
  progetto con frontend e reviewer che esce interamente assegnato; stesso piano
  su un progetto senza reviewer che risponde con il motivo.

### Stato finale

Checkpoint stabile. Prossima attivita': Fase 1, il Conductor
(`docs/ai/NEXT_STEPS.md`).

## 2026-09-05 — Directory agenti a card, chat con storico, creazione progetto onesta

### Lavoro svolto

- Riscritta `/agents` come directory di card (`agent-directory.tsx`): select
  organizzazione e `Create new agent` sotto la hero, una card verticale per
  agente con avatar, nome, ruolo e `provider | modello | reasoning`, `Info` in
  basso a sinistra e `Talk to them` in basso a destra con pallino di stato.
  `Busy` disabilitato con pallino rosso lampeggiante quando l'agente ha un task
  in `QUEUED`, `RUNNING` o `VERIFYING`. Rimosso l'elenco testuale in fondo.
- Aggiunti `agent-chat-drawer.tsx` (pannello laterale su desktop, schermo intero
  su mobile, bolle destra/sinistra, Invio manda) e `agent-info-dialog.tsx`
  (scheda completa in sola lettura, `Edita` per rendere modificabili tutti i
  campi, `Close`/`Cancel` a sinistra e `Edit`/`Save changes` a destra).
- Estratti in `agent-shared.tsx` avatar, etichette provider/reasoning, scelte di
  runtime e `CapabilityPicker`, condivisi fra creazione e modifica.
- `agent-crud-panel.tsx` e' ora solo creazione e vive su `/agents/new`;
  `agent-detail-panel.tsx` e' stato rimosso.
- Nuovo `GET /api/agents/:id/chat` con `listAgentChatMessages` su entrambi i
  modelli di persistenza: la chat riapre sullo storico reale, ordinato, e riusa
  la sessione dell'ultimo messaggio.
- `createProject` alza `ConflictError` (nuova classe in `@bunker-studio/core`)
  quando lo slug e' gia' preso, con lo stesso controllo nello store in memoria;
  la route distingue 409, 400 con il campo in errore, 403 e 500 con il motivo.
- Il repository di un progetto si sceglie da un combobox con autocomplete e
  pulsante `Reset`, al posto di filtro e select separati.

### Verifiche

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: PASS.
- `pnpm test`: PASS — 26 task, web 36 file / 98 test, incluse le nuove prove sul
  conflitto di nome progetto (memoria e Supabase) e sullo storico chat.
- `pnpm build`: PASS 15/15. `pnpm security`: nessuna vulnerabilita' nota.
- Verifica in esecuzione su un'istanza in memory mode: card e stato Busy, chat
  con invio e riapertura sullo storico, dialog Info con modifica e salvataggio,
  combobox repository (filtro, tastiera, reset, avviso read-only), creazione
  progetto duplicato che risponde 409 con il nome. Desktop e mobile.

### Stato finale

Checkpoint stabile. Resta aperta una decisione di prodotto: se mantenere il
concetto di Team, oggi solo un raggruppamento senza effetti sull'esecuzione
(vedi `docs/ai/NEXT_STEPS.md`).

## 2026-09-01 — Binding per-agent e worker Codex/GitHub locale

### Lavoro svolto

- Sostituita la configurazione provider/modello globale via env con account
  provider cifrati, catalogo automatico e binding provider/model/runtime/
  reasoning per agente.
- Aggiunti persistence mode esplicito, Settings provider, assegnazione agente
  ai task e gate queue per repository Codex.
- Integrati Codex SDK, identita' worker persistente, workspace Git isolato,
  branch/commit/push scoped, lease renewal e risultato atomico con evidenza
  dei comandi.
- Aggiunta verifica GitHub repository/branch/permesso push e protezione HTTPS
  del control plane remoto.
- Aggiornate migrazioni `20..22`, guide local-first, deployment e smoke worker.

### Verifiche

- `pnpm verify`: PASS (format, lint, typecheck, 26 task test, build 15/15,
  audit high).
- `pnpm test:e2e`: PASS 11/11 dopo aggiornamento del contratto agente.
- `supabase db reset --local`: PASS con migrazioni `00000000000000..22` e seed.
- Web 37/37, worker 22/22, Git 8/8, DB 14/14 e provider contract test PASS.

### Stato finale

Checkpoint stabile e riprendibile. Prossima attivita' unica: verifica
deterministica bounded del branch candidato come descritta in
`docs/ai/NEXT_STEPS.md`. Le prove OpenAI/GitHub/VAPID reali richiedono account
esterni ma non bloccano l'implementazione indipendente.

## 2026-08-31 — Modalita' locale OpenAI opt-in

### Lavoro svolto

- Aggiunta una modalita' locale esplicita tramite `LOCAL_PROVIDER_TYPE`, `LOCAL_PROVIDER_ENDPOINT`, `LOCAL_PROVIDER_API_KEY` e `LOCAL_PROVIDER_MODEL`.
- `pnpm dev` continua a usare il fake runtime quando il provider locale non e' configurato; quando e' configurato usa l'adapter OpenAI/Anthropic/OpenAI-compatible reale.
- Aggiornata la schermata Settings per mostrare il runtime locale configurato senza chiavi e aggiornata `.env.example`.
- Aggiornata la guida per provare web, agenti e chat sul PC prima di Supabase cloud e Vercel.

### Verifiche

- `pnpm verify`: PASS; format, lint 15/15, typecheck 15/15, test 25 task, build 15/15 e audit high senza vulnerabilita' note.

### Stato finale

Checkpoint locale stabile. Prossima attivita': compilare `.env.local` senza condividerlo, avviare `pnpm dev` e verificare manualmente un agente OpenAI.

## 2026-08-31 — Guida online e provider runtime configurato

### Lavoro svolto

- Consolidata `docs/quality/QUALITY_SETUP_GUIDE.md` in un percorso unico e semplice per Supabase cloud, OpenAI API, Vercel e verifica online.
- Documentati i punti esatti della dashboard in cui trovare URL, Reference ID, chiavi Supabase e connection string, senza chiedere all'utente di condividere segreti.
- Chiarito che `.env.prod` non viene caricato automaticamente, che `localhost` va sostituito dopo il primo deploy Vercel e che il worker persistente richiede un servizio separato.
- Aggiunto il provider runtime configurato a `/api/settings` in produzione quando non esiste ancora un provider persistito READY, mantenendo le chiavi server-only.
- Aggiunti test per configurazione, modello obbligatorio e assenza di leakage della chiave.

### Verifiche

- `pnpm format:check`: PASS.
- `pnpm lint`: PASS, 15 package task.
- `pnpm typecheck`: PASS, 15 package task.
- `pnpm test`: PASS, 25 task; web 20 file / 37 test.
- `pnpm build`: PASS, 15 package task.
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilita' nota.

### Stato finale

Checkpoint locale stabile. Prossimo passo unico: seguire la sezione A della guida e creare il progetto Supabase cloud; poi proseguire con OpenAI, Vercel e smoke test. Non segnare la Definition of Done come completata prima delle verifiche quality esterne e del backup/restore.

## 2026-08-31 — UI audit e runtime locale non bloccante

- Corretto l'audit Playwright funzionale: attende la hydration client di Next, coordina click e navigazione con `Promise.all` e usa il selettore accessibile del menu mobile. Tutti i 13 checkpoint UI-001--UI-008 passano: CTA, onboarding, progetto, agente da template/provider, task DRAFT->READY, design gate, Settings/provider, navigazione, hard refresh e responsive.
- `pnpm verify`: PASS; format, lint 15/15, typecheck 15/15, test 25 task, build 15/15 e audit sicurezza pnpm senza vulnerabilita' note. `pnpm test:e2e`: PASS, 11/11.
- Decisione utente registrata in DEC-014: Ollama/LM Studio resta una capacita' futura opzionale. AC-013 e' `PARTIAL (non-blocking)` e non e' piu' un blocker di release; i blocker esterni restano AC-001, AC-006, AC-009, AC-011 e il backup/restore drill.
- Aggiunta la guida per principianti `docs/quality/QUALITY_SETUP_GUIDE.md`, senza credenziali, con i passaggi e le regole di sicurezza per i quattro controlli quality bloccanti.

## 2026-08-31 — Security scan sul checkpoint corrente

- Gitleaks Docker ha analizzato 60 commit e circa 1,07 MB senza trovare leak.
- Il container Semgrep JavaScript è rimasto attivo senza output utile per oltre cinque minuti ed è stato interrotto controllatamente; non viene considerato un risultato positivo.

## 2026-08-31 — Audit dei prerequisiti quality

- `supabase db lint --local`: PASS; `pnpm quality:pg-boss-restart` con DSN temporaneo del database locale `55422`: PASS.
- Il controllo dell’ambiente conferma che non sono disponibili DSN Supabase/PostgreSQL quality, credenziali GitHub/VAPID o un endpoint Ollama/LM Studio; i cinque criteri `PARTIAL` restano correttamente non dichiarati conclusi.

## 2026-08-31 — Generazione persistente dei report settimanali

- Aggiunta migration `00000000000019_budget_reports.sql` con storico report tenant-scoped, RLS, vincoli temporali, trigger activity e unique key per deduplicare la stessa finestra schedulata.
- Il worker processa le schedulazioni scadute, calcola il report deterministico sugli ultimi sette giorni, persiste il risultato e avanza `next_run_at` con update condizionale; il dispatcher è idempotente anche in caso di due worker concorrenti.
- L’API budget espone gli ultimi report generati; aggiunti source Supabase, adapter locale e test scheduler 2/2.
- Verifiche: worker 12/12, web 35/35, typecheck worker/web/db PASS, `supabase db reset --local` e `supabase db lint --local` PASS.

## 2026-08-31 — Budget gate e cost ledger per chat diretta

- La chat diretta ora esegue il preflight `evaluateBudgetPolicies` prima del runtime: hard-stop e richiesta di approvazione producono risposta `409`, notifica tenant-scoped e nessuna invocazione provider; la soglia soft produce una notifica informativa.
- Le run chat riuscite registrano `runId`, agent, provider, modello, input/output token e stima configurabile `AGENT_CHAT_ESTIMATED_COST` nel cost ledger; il mapping Supabase gestisce anche i valori numerici restituiti come stringhe.
- Verifiche: test mirati chat 2/2, web 35/35, `pnpm verify` PASS, E2E acceptance 5/5 e working tree in stabilizzazione.

## 2026-08-31 — Budget gate persistito e soglia soft

- Corretto il gate di `PATCH /api/tasks`: `HARD_STOP` persiste il task in `BLOCKED`, `WAITING_BUDGET_APPROVAL` persiste lo stato omonimo; entrambi emettono una notifica tenant-scoped e non invocano il provider.
- Aggiunta notifica informativa quando una task supera la soglia soft ma resta autorizzata all’avvio; il comportamento è coperto da test route insieme al caso hard-stop.
- Verifiche: test mirati orchestration/web, suite E2E 11/11 e `pnpm verify` completo PASS; working tree pulito.

## 2026-08-31 - Cost Center, design resolution ed escalation

- Aggiunte budget policy tenant-scoped per run/task/daily/monthly con hard/soft limit, azioni deterministic, fallback consent ed escalation threshold; Settings espone policy e report weekly configurabile.
- Aggiunta persistenza Supabase `report_schedules` con RLS, next-run UTC e test route locale; migration `00000000000018_budget_reports.sql` applicata e lintata localmente.
- Il design gate supporta owner-only Approve/Reject/Changes; i task possono referenziare una versione design approvata; le review registrano `TASK_ESCALATION_REQUESTED` nel ledger quando le soglie deterministiche sono raggiunte.
- Verifiche: typecheck/lint/test web PASS; route web 17 file/29 test PASS; test mirati design, review ed budgets PASS.

## 2026-08-31 — Smoke performance pagine core

- Aggiunto `tests/e2e/performance-smoke.spec.ts`: warm-up e cinque richieste per ciascuna pagina core, con calcolo p95 e target server-side `< 800 ms` definito dalla specifica, senza chiamate provider.
- Smoke Playwright mirato: `1 passed`; il p95 misurato resta sotto il target. La suite completa successiva ha chiuso con `11 passed (3.1m)`.

## 2026-08-31 — Dataset demo Supabase locale

- Sostituito il seed vuoto con un dataset deterministico e idempotente per `supabase db reset`: utente Auth tecnico senza password, organizzazione, team, progetto, tre agenti con binding fake, workflow Lead con dipendenza, memoria e decisione.
- Il seed non contiene credential o secret provider; la documentazione indica l'uso dell'header fixture solo in sviluppo e mantiene il signup Auth per i flussi reali.
- `supabase db reset --local`: PASS; conteggi verificati (1 utente, 1 organizzazione, 3 agenti, 2 task, 1 memoria). `supabase db lint --local`: PASS.

## 2026-08-31 — Outbox transazionale per task accodati

- Aggiunta migration `00000000000017_task_outbox_trigger.sql`: ogni transizione Supabase verso `QUEUED` crea nello stesso commit un evento `task.run` con task/organization/project/retry metadata.
- Il trigger è limitato alla transizione di stato, non duplica update non pertinenti e non modifica i gate RLS; il dispatcher asincrono può inoltrare l’evento al queue adapter già esistente.
- `supabase db reset --local`, `supabase db lint --local` e smoke SQL transazionale con rollback (prima coda, update non di stato, retry `RUNNING → QUEUED`): PASS; nessun handler worker implicito o no-op è stato introdotto.

## 2026-08-31 — Recovery pg-boss dopo crash di processo

- Corretto `startPgBoss`: i job mantengono retry broker-side per timeout/crash; i retry applicativi restano espliciti perché `PgBossQueue.release()` rimuove il job attivo prima di crearne uno deterministico.
- Aggiunto `pnpm quality:pg-boss-restart`, smoke con due processi Node separati, timeout reale e completamento del job recuperato.
- Verifica locale: PASS su PostgreSQL Supabase locale; `supabase db lint --local`: PASS; `pnpm verify`: PASS; `pnpm test:e2e`: 10/10 PASS. Il test quality multi-processo con database isolato resta richiesto da AC-006.

## 2026-08-31 — Verifica completa del checkpoint locale

- `pnpm verify`: PASS sul commit `6acf82d`; formatting, lint 15/15, typecheck 15/15, test 25/25, build 15/15 con 50 route/pagine e `pnpm audit --audit-level high` senza vulnerabilità note.
- `pnpm test:e2e`: PASS 10/10; smoke SQL locale del worker e `supabase db lint --local`: PASS.

La Definition of Done resta aperta soltanto per gli scenari quality esterni già tracciati nella matrice acceptance: cloud/secondo device e backup/restore, pg-boss multi-process, GitHub/CI reale, VAPID/device reale e runtime Ollama/LM Studio con quality node.

## 2026-08-31 — GitHub/CI e Web Push VAPID adapter

- Aggiunto `@bunker-studio/git` adapter HTTP GitHub con branch creation, check-run CI normalizzati (`PASS`/`FAIL`/`PENDING`) e apertura di pull request; il token è iniettato solo negli header e non compare negli errori.
- Aggiunti test contract con trasporto `fetch` fake per branch, CI pending, pull request e sanitizzazione degli errori.
- Aggiunto `@bunker-studio/notifications` adapter server-only basato su `web-push` con VAPID runtime config, TTL/urgency deterministici e test senza rete.
- Aggiunto endpoint controllato per la VAPID public key e flusso Settings browser → service worker → `/api/notifications/subscribe`.
- Aggiunte variabili opzionali di configurazione per GitHub e Web Push; nessuna chiave è stata inserita nel repository.
- Verifiche mirate: Git 7 test/typecheck, Notifications 3 test/typecheck, Config test/typecheck, Web typecheck/build PASS.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Local worker task pull, lease e completion

### Lavoro svolto

- Aggiunta migration `00000000000016_local_worker_tasks.sql` con `required_capability`, tabella lease server-side, claim atomico autenticato, reclaim delle lease scadute e completion con retry/failure state.
- Aggiunti endpoint control-plane per claim/completion, client daemon, loop di esecuzione verso runtime OpenAI-compatible configurato localmente e configurazione env dedicata.
- Preservato il gate di stato: il worker può reclamare solo task `QUEUED`, verifica capability, scope, dipendenze completate e concurrency; una lease scaduta riporta il task a `QUEUED`.
- Esteso export/import e Lead/task contract per conservare la capability richiesta.

### Verifiche

- `supabase db reset --local`: PASS fino alla migration 16.
- Smoke SQL con rollback: PASS per claim/capacity/completion e reassignment dopo scadenza lease.
- Worker: 10/10 test PASS; contracts: 4/4 test PASS; typecheck worker/web: PASS.

### Stato

AC-013 resta `PARTIAL` solo per lo smoke con runtime Ollama/LM Studio e quality node reale; il protocollo locale di pull/lease è ora implementato e verificato.

## 2026-08-31 — Secret scan sul checkpoint corrente

- Gitleaks Docker: PASS, 41 commit e circa 884 KB scansionati, nessun leak trovato.
- `pnpm audit --audit-level high`: PASS già incluso nella verifica completa.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Dispatcher persistente notifiche

- Aggiunto il dispatcher provider-neutral per notifiche pending: applica preferenze/severità, invia a tutte le subscription, marca delivery, differisce errori transitori e revoca endpoint 404/410.
- Aggiunta migrazione `00000000000015_notification_delivery.sql` con stato delivery/retry persistente e indice pending.
- Il worker avvia il polling solo quando sono configurati service-role Supabase e VAPID server-side; nessun segreto viene incluso nei log o nel bundle browser.
- Aggiunto source Supabase service-role per notifiche, subscription e preferenze; reset Supabase locale con migrazioni 00–15: PASS.
- Test notifications: 4/4 PASS; worker typecheck/test/build: PASS.

Prossimo passo: eseguire AC-011 con VAPID configurato e un browser/device reale.

## 2026-08-31 — Protocollo credenziale local worker

- Aggiunta migrazione `00000000000014_worker_registration.sql` con token monouso, scadenza, scope/concurrency, RPC `exchange_worker_registration_token` e RPC `heartbeat_local_worker`.
- Aggiunti endpoint amministrativo per emettere il token e endpoint runtime separati per exchange e heartbeat con `Bearer` credential; il database conserva solo hash SHA-256 della credenziale.
- Aggiunti contratti Zod e test di validazione; il reset Supabase locale applica la migrazione senza errori.
- Smoke SQL locale: exchange token restituisce la credenziale una sola volta e heartbeat autenticato mantiene il nodo `ONLINE`; dati di prova rollbackati.

Prossimo passo: eseguire in quality il flusso AC-013 con un runtime Ollama/LM Studio e verificare assignment/offline reassignment.

## 2026-08-31 — Scheduler locale fail-closed

- Aggiunto `WorkerTaskScheduler` nel package DB: capability, read/write scope, concurrency e online eligibility sono verificati prima di incrementare `activeJobs`.
- Scope vuoti o non autorizzati e nodi offline non ricevono nuovi task; il completamento rilascia il contatore in modo deterministico.
- Aggiunta copertura test per assegnazione, capienza, scope denial e offline denial.

Prossimo passo: eseguire in quality il flusso AC-013 con un runtime Ollama/LM Studio e verificare assignment/offline reassignment.

## 2026-08-31 — Verifica sicurezza dopo le integrazioni

- `pnpm verify`: PASS completo sul tree corrente; installazione frozen, format, lint, typecheck, 24 task test, build e audit.
- `pnpm test:e2e`: 10/10 PASS in circa 3 minuti.
- Gitleaks Docker: PASS, 39 commit scansionati, nessun leak trovato.
- Semgrep Docker con ruleset JavaScript esplicito: nessun risultato terminale utile entro la finestra quality; resta `inconclusive`, non viene conteggiato come PASS.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Daemon control-plane local worker

- Aggiunto `apps/worker/src/runtime-client.ts` con register tramite token monouso e heartbeat autenticato via `Bearer` credential.
- L’entrypoint worker usa il control plane quando configurato (`WORKER_CONTROL_PLANE_URL`, token oppure `WORKER_NODE_ID` + `WORKER_CREDENTIAL`) e conserva il comportamento heartbeat locale quando non configurato.
- Aggiunti test client e variabili Zod; Worker 7 test, typecheck e build PASS.

Prossimo passo: eseguire in quality il flusso AC-013 con un runtime Ollama/LM Studio e verificare assignment/offline reassignment.

Storico append-only.

## 2026-08-31 — Persistenza completa dei metadati Lead e usage SSE

### Lavoro svolto

- Persistiti `readScope` e `parallelGroupId` nei task locali/Supabase e nel percorso Lead; export/import mantiene i metadati con compatibilità per pacchetti precedenti.
- Corretto il mapper Supabase che leggeva erroneamente `write_scope_json` come read scope.
- Il runtime HTTP ora emette anche eventi SSE senza testo ma con usage; l’adapter Anthropic ricompone input/output usage provenienti da eventi distinti.

### Verifiche

- Test Lead workflow plan: 2/2 PASS.
- AgentRuntime: 6/6 PASS.
- Anthropic adapter: 2/2 PASS.
- Typecheck: 15/15 task PASS.

### Prossimo passo

Completare gli smoke quality esterni ancora `PARTIAL` quando saranno disponibili Supabase cloud, secondo device, GitHub/CI, VAPID/Web Push, pg-boss multi-process e runtime Ollama/LM Studio.

## 2026-08-31 — OpenAI-compatible SSE contract

### Verifiche

- Corretto l’adapter OpenAI-compatible per dichiarare e gestire realmente gli stream SSE; aggiunto contract test con chunk `delta` e terminazione `[DONE]`.
- Typecheck, lint, build e 3 test del package OpenAI-compatible: PASS.

### Prossimo passo

Eseguire smoke su Ollama/LM Studio in quality quando il runtime locale è disponibile.

## 2026-08-31 — Adapter provider nativi e streaming normalizzato

### Lavoro svolto

- Collegati al runtime web gli adapter OpenAI, Anthropic e OpenAI-compatible in base a `AGENT_PROVIDER_TYPE`.
- Implementati payload/header nativi, parsing delle risposte e stream SSE normalizzato in `AgentRuntime`, con usage provider-reported quando disponibile.
- Mantenuta la capability `resume` esplicita: il resume nativo viene usato solo quando l’adapter lo dichiara supportato; altrimenti il percorso quota riparte con una nuova sessione.

### Verifiche

- Contract test OpenAI, Anthropic e OpenAI-compatible: PASS.
- Test SSE/usage runtime: PASS.
- `pnpm verify`: PASS, lint/typecheck/test/build/audit; 24 task Turborepo.

### Prossimo passo

Eseguire gli smoke reali con credenziali provider e runtime quality; gli scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Verifica E2E completa aggiornata

### Verifiche

- `pnpm test:e2e`: PASS, 10/10 scenari, inclusi lo smoke responsive/accessibility e tutti i flussi API/UI precedenti.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i cinque scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Quality smoke responsive/accessibility

### Lavoro svolto

- Aggiunto `tests/e2e/quality-smoke.spec.ts` per verificare rendering, controlli interattivi nominati, assenza di errori pagina e overflow alle viewport desktop/mobile sulle pagine core.

### Verifiche

- `pnpm exec playwright test tests/e2e/quality-smoke.spec.ts`: PASS, 1/1.

### Prossimo passo

Eseguire l’audit manuale WCAG/device e gli scenari quality esterni quando saranno disponibili le risorse richieste.

## 2026-08-31 — Runner concorrente e resume sessione provider

### Lavoro svolto

- `WorkflowRunner` ora esegue in parallelo i task con scope disgiunti, applica il limite di concorrenza e serializza automaticamente i gruppi con scope sovrapposti.
- Gli errori quota che arrivano dopo `SESSION_STARTED` conservano il `sessionId`; il resume usa `AgentRuntime.resume`, con fallback a `start` quando la quota fallisce prima dell’apertura della sessione.
- Aggiunti test di concorrenza/scope e test di resume post-sessione.

### Verifiche

- `@bunker-studio/orchestration`: 19 test PASS.
- `@bunker-studio/agent-runtime`: typecheck, lint e test PASS.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i cinque scenari `PARTIAL` restano vincolati a risorse esterne.

## 2026-08-31 — Lead workflow plan persistito

### Lavoro svolto

- Aggiunto il contratto `leadPlanSubmissionSchema` e l’endpoint tenant-scoped `POST/GET /api/workflows/plan`.
- Validato il DAG Lead prima della materializzazione; le dipendenze vengono rimappate agli UUID persistiti in ordine topologico.
- Persistiti workflow, task DRAFT, `workflow_id` e Definition of Done strutturata nell’adapter locale e nel repository Supabase; aggiunta la migration `00000000000013_workflow_plan.sql`.

### Verifiche

- Test mirati workflow: PASS, 2 test.
- `pnpm verify`: PASS, format/lint/typecheck/test/build/audit.
- `supabase db reset --local`: PASS fino alla migration `00000000000013`.
- `pnpm test:e2e`: PASS, 9/9.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; le verifiche `PARTIAL` restano bloccate da credenziali/runtime/device esterni.

## 2026-08-31 — Agent detail, activity e Studio Labs protetto

### Lavoro svolto

- Aggiunti assegnamenti agenti tenant-scoped con vincoli RLS su organizzazione, team, progetto e reporting agent; export/import conserva le relazioni con ID rimappati.
- Aggiunti endpoint e UI per dettaglio agente, assegnamenti, metriche deterministiche e activity append-only; gli eventi Supabase sono garantiti da trigger sulle tabelle di dominio.
- Aggiunto Studio Labs con inizializzazione Owner-only di Studio Core, analisi segnali, proposta selezionabile, task+approval persistiti e gate server-side reviewer/CI/Owner/human senza deploy production.

### Verifiche

- `pnpm verify`: PASS, format, lint/typecheck 15/15, 21 task test, build Next e audit high verdi.
- `supabase db reset --local`: PASS fino alle migration 00000000000012.
- `pnpm exec playwright test tests/e2e/api-acceptance.spec.ts`: PASS 5/5; suite E2E completa precedente 8/9 per un’aspettativa activity obsoleta, poi caso corretto e mirato verificato.

### Prossimo passo

Eseguire AC-001 in quality con Supabase cloud e secondo dispositivo; i restanti quattro scenari `PARTIAL` restano bloccati da credenziali/runtime/device esterni.

## 2026-08-30 — Capability envelope e progetti multi-team

### Lavoro svolto

- Estesa l’identità persistita degli agenti con avatar, skills, tools e permissions; la chat inoltra al runtime solo il capability envelope autorizzato e la portabilità conserva questi metadati senza provider secrets.
- Aggiunta la migrazione Supabase `00000000000009_agent_capabilities.sql`, con default e vincoli JSON compatibili con i record esistenti.
- Completato il supporto a progetti associati a più team tramite `teamIds`/`project_teams`, validazione tenant-aware e import/export; aggiunta la migrazione RLS `00000000000010_project_team_rls.sql` per impedire relazioni cross-organization.
- Aggiornati UI e test del registry agenti e tenancy.

### Verifiche

- `pnpm verify`: PASS dopo l’incremento multi-team; lint/typecheck 15 package task, test 21 task, build Next 41 route e audit verde.
- `pnpm test:e2e`: PASS dopo l’incremento multi-team, 9 scenari; reset Supabase locale PASS fino alla migration 10.

### Prossimo passo

Ripetere la verifica monorepo/E2E dopo il consolidamento del supporto multi-team, poi mantenere aperte soltanto le verifiche quality esterne già registrate come `PARTIAL`.

## 2026-08-30 — Hardening multi-team e runtime capabilities

### Lavoro svolto

- Reso l’aggiornamento delle associazioni `project_teams` tenant-aware e coerente tra adapter locale e Supabase, con sostituzione controllata dell’insieme di team.
- Aggiunto il test HTTP del runtime che verifica il capability envelope effettivamente serializzato verso il provider.

### Verifiche

- Test runtime: PASS, 4 test.
- Typecheck db/web: PASS.
- Test tenancy: PASS, 2 test.
- Il checkpoint precedente resta coperto da `pnpm verify`, `pnpm test:e2e` 9/9 e reset Supabase locale fino alla migration 10.

### Stato

Repository stabile e riprendibile; restano soltanto i blocker quality esterni già riportati nella matrice acceptance.

## 2026-08-30 — Persistenza production dei verticali

### Lavoro svolto

- Aggiunto adapter Supabase SSR/RLS-aware per design versions, memorie, meetings/minutes, approval, cost ledger, notifiche/push, repository metadata e worker registry.
- Corretto il bypass production nei PATCH di team/progetto e nella staffing confirmation.
- Aggiunti vincoli SQL per costo meeting, capacità/concorrenza worker, upsert push/repository e isolamento tenant delle design versions.

### Verifiche

- `pnpm typecheck`: PASS, 15 package task.
- `pnpm lint`: PASS, 15 package task.
- `supabase db reset --local`: PASS, migrations 00000000000000..06.
- `pnpm exec playwright test tests/e2e/api-acceptance.spec.ts`: PASS, 4 scenari.

### Prossimo passo

Comporre il provider runtime production e persistere conversations/messages con RLS; i provider reali restano subordinati a credenziali quality.

## 2026-08-30 — Office e pannelli operativi live

### Lavoro svolto

- Sostituiti i placeholder statici di Office, Agents, Meetings, Approvals e Costs con pannelli client che selezionano l'organizzazione e leggono le API tenant-scoped.
- Aggiunte azioni Approve/Reject nell'inbox e visualizzazione deterministica degli agenti nelle aree dell'Office.
- Mantenuti stati di caricamento, empty state ed error state senza introdurre decisioni LLM lato client.

### Verifiche

- `pnpm --filter @bunker-studio/web lint`: PASS.
- `pnpm --filter @bunker-studio/web typecheck`: PASS.
- `pnpm exec playwright test tests/e2e/studio.spec.ts`: PASS, 3 scenari.

### Prossimo passo

Completare Projects, Teams, Settings e Activity con viste client collegate alle rispettive API.

## 2026-08-30 — Acceptance E2E e operational API slices

### Lavoro svolto

- Reso lo store fixture condiviso tra i route bundle Next tramite `globalThis`, mantenendo la separazione tenant.
- Aggiunte API per meeting/minutes, approvals, cost ledger/report, notification inbox/subscription e repository metadata.
- Aggiunti contratti Zod, E2E API per tenancy, design, staffing, memory, worker e operations.
- Rafforzato il workflow con budget cumulativo sui task concorrenti.
- Aggiunti trigger Supabase per profilo utente e membership Owner, contesto Docker workspace e runbook quality/production.
- Aggiunto `SupabaseTenancyRepository` con client SSR/RLS-aware e fallback fixture limitato a non-production per organizzazioni, team, progetti e membri.
- Aggiunto `SupabaseAgentRepository`, RPC atomiche per creazione/switch binding provider e route agenti production-aware.

### Verifiche

- `pnpm verify`: PASS; formatter, lint, typecheck, 21 task di test, build e audit.
- `pnpm test:e2e`: PASS, 8 scenari.
- `supabase db reset --local`: PASS; migration trigger applicata.
- Query locale: 45 policy pubbliche, 38 tabelle RLS-enabled, trigger tenancy e funzione claim outbox presenti.

### Stato finale della sessione

Acceptance locale stabilizzata. Prossimo passo: eseguire in quality le righe `PARTIAL` della matrice con credenziali/device/runtime espliciti.

Nota di handoff: gli endpoint web sono ancora in-memory in sviluppo e devono
essere cablati al repository Supabase autenticato prima della verifica
multi-processo quality.

## 2026-08-30 — Sessione 1 — Product & architecture definition

### Lavoro svolto

- Definito il prodotto Bunker Studio.
- Definiti requisiti UX e organizzativi.
- Definita architettura tecnica cloud-first e provider-independent.
- Definito runtime agentico durable con resume automatico.
- Definite policy di costo, memoria, approvazione, self-improvement e portabilità.
- Specializzato lo scaffolding AI-first per l'implementazione.

### File principali modificati

- `AGENTS.md`
- `README.md`
- `docs/product/PRODUCT_UX.md`
- `docs/technical/TECHNICAL_SPECIFICATION.md`
- `docs/technical/ARCHITECTURE.md`
- `docs/technical/AGENT_RUNTIME.md`
- `docs/technical/DATA_MODEL.md`
- `docs/technical/SECURITY_AND_OPERATIONS.md`
- `docs/ai/*`

### Verifiche

- Coerenza documentale: da verificare prima del handoff definitivo.
- Build/test applicativi: N/A.

### Problemi emersi

Nessuno.

## 2026-08-30 — Acceptance smoke, persistent outbox e worker composition

### Lavoro svolto

- Aggiunti `SupabaseOutboxRepository` e funzione SQL atomica `claim_outbox_event` con `FOR UPDATE SKIP LOCKED`.
- Collegati `PgBossQueue`, `AsyncOutboxDispatcher` e composition root `createPersistentWorker`.
- Aggiunti direct chat fake/runtime endpoint, memory delete, weekly cost report, design max 3 versioni e test reviewer fix loop.
- Aggiunti E2E browser per onboarding, login/signup, manifest/service worker oltre all'health check.

### Verifiche

- Format, lint, typecheck, unit/integration test e build: PASS.
- Playwright: 4 test PASS.
- Supabase `db reset --local`: PASS; query schema: 45 policy pubbliche, 38 tabelle RLS-enabled, funzione outbox presente.
- `pnpm audit --audit-level high`: PASS.

### Problemi emersi

- Il client pg-boss concrete e le credenziali cloud/provider/VAPID/GitHub restano configurazione quality; la composition root accetta client iniettati e non contiene secret.
- La matrice acceptance AC-001..AC-014 va ancora chiusa con fixture E2E/integration e procedura manuale per le parti esterne.

## 2026-08-30 — M4-M14 vertical slices e hardening

### Lavoro svolto

- Aggiunti lease/reclaim, adapter pg-boss contract-first, outbox dispatcher, worker loop e workflow DAG deterministico con hard budget gate.
- Aggiunti contratti Lead/verification/review, Git workspace/artifact adapter, bounded meeting runner e worker registry con capability/concurrency.
- Aggiunti API design/owner approval, staffing proposal/confirmation, membri/CRUD tenancy, memory bounded search, PWA service worker e push adapter con deep-link.
- Corretto onboarding per non usare fixture identity in produzione; aggiunta policy RLS service-role-only per outbox.

### Verifiche

- Typecheck, test mirati e lint: PASS dopo le correzioni.
- Supabase `db reset --local`: PASS con tutte le migration.
- Playwright health E2E: PASS.
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.

### Problemi emersi

- Il client pg-boss/Supabase persistente deve ancora essere cablato nell'app worker; gli adapter sono pronti e testabili con fake.
- La suite E2E completa AC-001..AC-014 e le integrazioni cloud quality richiedono ulteriori implementazioni/credenziali.

### Stato finale della sessione

Specifiche pronte. Prossimo passo: Milestone M0.

## 2026-08-30 — Bootstrap M0

### Lavoro svolto

- Creato monorepo pnpm/Turborepo con app web e worker.
- Aggiunti package condivisi, configurazione TypeScript strict, ESLint, Prettier, Vitest e Playwright.
- Aggiunti env schema Zod, scaffold Supabase, Dockerfile e CI.
- Creata shell Office responsive e health endpoint web; worker con heartbeat.

### File principali modificati

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`
- `apps/web/**`, `apps/worker/**`, `packages/**`
- `supabase/**`, `.github/workflows/ci.yml`, `docs/SETUP.md`

### Verifiche

- Format check, lint, typecheck, unit test e build: PASS.
- Playwright health E2E: PASS.
- Smoke web health e worker heartbeat: PASS.

### Stato finale della sessione

M0 completata. Prossimo passo: M1 — Auth, Tenancy & Core Data.

## 2026-08-30 — M1–M4 foundations e hardening domain

### Lavoro svolto

- Implementati tenancy store autorizzato, agent registry, binding-preserving identity, API organizations/agents e onboarding.
- Aggiunte migrazioni Supabase per tenancy, domain tables, pgvector-ready memory e RLS policies.
- Implementati runtime contract, fake quota-aware, HTTP normalized runtime e adapter contract tests.
- Implementati task transitions, dependency scheduler, safe parallelism, quota retry/resume, bounded meeting context e review/design/HR gates.
- Implementati bounded memory retrieval, cost forecast, push policy, worker registration/eligibility, export/import ID remap, provider secret encryption e protected self-improvement policy.
- Aggiunte pagine web base per agents, projects, teams, approvals, meetings, costs, activity e settings.

### File principali modificati

- `packages/core/**`, `packages/contracts/**`, `packages/db/**`, `packages/agent-runtime/**`
- `packages/orchestration/**`, `packages/git/**`, `packages/notifications/**`, `packages/observability/**`
- `packages/provider-*/*`, `apps/web/app/**`, `supabase/migrations/**`
- `docs/ai/CURRENT_STATE.md`, `docs/ai/NEXT_STEPS.md`

### Verifiche

- Format check: PASS.
- Lint: PASS dopo ignore dei file generati Next/dist.
- Typecheck: PASS.
- Test package: PASS; 20 task Turborepo, inclusi quota, tenancy, encryption, memory, export/import e provider contracts.
- Build: PASS; Next routes `/`, `/onboarding`, `/api/health`, `/api/organizations`, `/api/agents` generate correttamente.
- Supabase locale: migrazioni reset/start applicate e stack avviato su porte dedicate.

### Problemi emersi

- Supabase ha richiesto porte locali dedicate perché altri progetti Docker occupavano i default; configurato 55421–55427.
- Mancano ancora queue pg-boss/outbox dispatch, auth UI/sessione completa, CRUD end-to-end restante, workflow UI e suite E2E completa.

### Stato finale della sessione

Fondamenti M1–M4 e policy trasversali stabilizzati. Riprendere da `docs/ai/NEXT_STEPS.md` per completare Auth/sessione Supabase e CRUD tenancy.

## 2026-08-30 — Operational UI and Settings

### Lavoro svolto

- Aggiunti endpoint e adapter tenant-scoped per task/activity e pannelli live per il control plane.
- Projects e Teams ora supportano creazione e modifica dalla UI con organization selector e ruoli API invariati.
- Settings ora mostra runtime configurato, provider e catalogo modelli, worker, capabilities e heartbeat senza restituire segreti.
- Aggiunta copertura route per Settings e aggiornata la build E2E per compilare i package condivisi prima di Playwright.

### Verifiche

- `pnpm verify`: PASS; 21 test task, build Next.js e audit sicurezza verdi.
- `pnpm test:e2e`: PASS; 8/8 scenari.
- `pnpm --filter @bunker-studio/web test`: PASS; 9 test.

### Stato finale della sessione

UI tenancy/operational e task/workflow aggiornati; repository stabile. Prossimo passo: eseguire i cinque scenari quality `PARTIAL` e il backup/restore drill quando saranno disponibili gli accessi esterni.

## 2026-08-30 — Agent registry e notification preferences

### Lavoro svolto

- Aggiunta UI Agents per create/edit/archive tenant-scoped, con provider binding label e credenziali sempre server-side.
- Aggiunta archiviazione reversibile per team e progetti tramite DELETE semantico, con protezione del progetto Studio core e test di isolamento.
- Aggiunte preferenze notifiche per categoria (`APPROVAL`, `SECURITY`, `BUDGET`, `QUOTA`, `WORKFLOW`) con route GET/PATCH, stato locale e persistenza Supabase/RLS.
- Estesa la policy push provider-neutral per rispettare le preferenze categoria quando il dispatcher viene configurato.

### Verifiche

- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next e audit sicurezza.
- `pnpm test:e2e`: PASS; 8/8 scenari.
- `supabase db reset --local`: PASS; migration `00000000000007_notification_preferences.sql` applicata.

### Stato finale della sessione

Checkpoint stabile nei commit `4e1a5b3`, `65884f7` e `9853717`. Restano i cinque scenari quality `PARTIAL` e il backup/restore drill con accessi esterni.

## 2026-08-30 — Organization portability and persisted review outcomes

### Lavoro svolto

- Aggiunte route tenant-scoped per export/import organizzazione con formato versionato, remap degli ID di organizzazione/task/dipendenze, esclusione dei secret e stato provider `REQUIRES_REAUTH`.
- Aggiunta persistenza conversazioni necessaria alla portabilità chat, sia nello store locale di test sia nell'adapter Supabase.
- Aggiunti endpoint per registrare/listare verifiche di task e report di review, con findings protetti da RLS e fix task creati solo dal risultato deterministico della policy.

### Verifiche

- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next a 41 route e audit sicurezza.
- `pnpm test:e2e`: PASS; 9/9 scenari.
- `supabase db reset --local`: PASS; migration `00000000000008_review_findings_rls.sql` applicata.
- Test web: 11 file, 17 test passati, inclusi portabilità, verifica e review.

### Stato finale della sessione

Checkpoint stabile nei commit `0ab5f46`, `2de5113`, `322acb2`, `79967bf` e `26b4f76`. Restano le verifiche quality `PARTIAL` dipendenti da Supabase/GitHub/VAPID/provider/multiprocess e il backup/restore drill con accessi esterni.

## 2026-08-30 — Virgin template and verification evidence completion

### Lavoro svolto

- Aggiunto endpoint pubblico di virgin template export con manifest versionato, configurazione supportata e role templates, senza tenant data o secret.
- I verification runs inclusi nei review report vengono ora persistiti insieme al report; gli artifact ID sono validati come UUID coerenti con lo schema Supabase.

### Verifiche

- Test route review e template: PASS.
- `pnpm verify`: PASS; format, lint, typecheck, 21 task di test, build Next a 41 route e audit sicurezza.
- `pnpm test:e2e`: PASS; 9/9 scenari, inclusi review/verifica, portabilità E2E e virgin template.

### Stato finale della sessione

Restano le verifiche quality `PARTIAL` dipendenti da accessi esterni e il backup/restore drill.

## 2026-08-31 — Re-verifica schema Supabase locale

### Verifiche

- `supabase db reset --local`: PASS.
- Migration `00000000000000..00000000000013`, seed e restart dei container locali completati senza errori.

### Stato

- Nessuna variazione sui blocker: AC-001, AC-006, AC-009, AC-011 e AC-013 richiedono rispettivamente quality cloud/device, pg-boss multi-processo, GitHub/CI, VAPID/device e runtime Ollama/LM Studio.

## 2026-08-31 — Adapter pg-boss concreto e worker persistente

### Lavoro svolto

- Aggiunta la dipendenza `pg-boss` e l’adapter di processo che normalizza i job batch v12 nel contratto interno.
- Aggiunto `startPersistentWorker` con polling della coda, dispatch periodico dell’outbox e shutdown ordinato; gli handler restano obbligatori e iniettati.
- Mantenuta la compatibilità dell’orchestrazione con client fake e con client pg-boss che restituiscono un singolo job o una lista.

### Verifiche

- Queue orchestration: 20/20 test PASS.
- Worker: 5/5 test PASS.
- Typecheck e build worker: PASS.

### Stato

- AC-006 e AC-013 restano `PARTIAL` fino al test multi-processo con database quality e allo smoke di un runtime Ollama/LM Studio; non vengono simulati come completati.

## 2026-08-31 — Smoke pg-boss PostgreSQL locale

### Verifiche

- Avviato `pg-boss` v12 contro il PostgreSQL Supabase locale.
- Creazione queue, `send`, `fetch` batch e `complete`: PASS.
- Il controllo ha rilevato e corretto la necessità di creare esplicitamente la queue prima del primo invio.

### Stato

- La prova conferma l’integrazione single-process locale; non sostituisce il test di restart multi-processo su quality richiesto da AC-006.

## 2026-08-31 — Security scan locale

### Verifiche

- Gitleaks Docker: PASS, 38 commit scansionati, nessun leak trovato.
- `pnpm audit --audit-level high`: PASS, nessuna vulnerabilità nota.
- Semgrep auto-scan Docker è stato limitato a `apps`, `packages` e `supabase`, ma non ha raggiunto uno stato terminale utile e non viene conteggiato come PASS.
- `osv-scanner` non è disponibile nell’host.

## 2026-08-31 — Retry pg-boss senza duplicazioni

### Lavoro svolto

- Configurato il queue bootstrap con `retryLimit: 0` per evitare il doppio retry implicito + esplicito.
- Mantenuto il retry esplicito Bunker con operation key derivata dal tentativo e relativa copertura nel contratto orchestration.

### Verifiche

- Queue orchestration: 21/21 test PASS.
- Smoke PostgreSQL locale ripetuto dopo l’inizializzazione queue: PASS.

## 2026-08-31 — Verifica E2E dopo dispatcher push

- `pnpm test:e2e`: 10/10 test PASS in circa 3,7 minuti sul tree corrente, inclusi tenancy/isolation, worker, operations, PWA e responsive/accessibility smoke.
- `pnpm verify`: PASS sul tree corrente; test Turborepo 25 task e build web 48 route/pagine.

Prossimo passo: eseguire gli scenari quality esterni `PARTIAL` con credenziali, device e runtime dedicati.

## 2026-08-31 — Archivio conversazioni e gate design sui task frontend

### Lavoro svolto

- Aggiunto `GET /api/conversations` con isolamento tenant, ricerca case-insensitive su sessione/messaggi, filtro agente e limite massimo bounded.
- Aggiunta pagina `/conversations` con selezione organizzazione e ricerca dello storico, collegata alla navigazione Office.
- Aggiunto gate server-side e UI per richiedere un `approvedDesignVersionId` sui task `FRONTEND`; i piani Lead applicano lo stesso vincolo e persistono il riferimento esatto.
- Aggiunti test route e flusso E2E per la ricerca conversazioni e i gate task/design/budget.

### Verifiche

- `pnpm verify`: PASS; format, lint 15/15, typecheck 15/15, test 25 task/33 test web, build 15/15, audit high PASS.
- `pnpm test:e2e`: PASS, 11/11 test in 3,1 minuti.

### Stato finale

Checkpoint locale stabile. Restano soltanto le verifiche quality esterne già tracciate in `ACCEPTANCE_MATRIX.md`.

## 2026-08-31 — Verifica infrastrutturale del checkpoint finale locale

### Verifiche

- `supabase db reset --local`: PASS con tutte le migration `00000000000000..00000000000018` e seed demo idempotente.
- `supabase db lint --local`: PASS, nessun errore di schema.
- `pnpm quality:pg-boss-restart`: PASS; il job `d6212dc1-7ec9-416d-b6d0-966933b012f1` è stato recuperato e completato dopo il crash/restart simulato di due processi.

### Stato finale

Working tree pulito. La Definition of Done resta aperta esclusivamente per AC-001, AC-006, AC-009, AC-011 e AC-013 in quality esterna, come indicato nella matrice acceptance.

## 2026-08-31 — Budget gate con stato persistito e notifica

### Lavoro svolto

- Corretto il percorso `PATCH /api/tasks`: quando il preflight budget non consente l’avvio, il task passa deterministicamente a `BLOCKED` per `HARD_STOP` oppure a `WAITING_BUDGET_APPROVAL` per una policy che richiede approvazione.
- Aggiunta notifica BUDGET tenant-scoped con deep link al task; la chiamata resta compatibile con repository locale sincrono e Supabase asincrono.
- Allineate macchina a stati, UI e test per impedire l’invocazione del provider prima del gate.

### Verifiche

- Test mirati task/orchestration: PASS.
- `pnpm verify`: PASS; 15/15 package, 25 task, 33 test web, build e audit high verdi.
- `pnpm test:e2e`: PASS, 11/11 test in 2,7 minuti.

### Stato finale

Checkpoint locale stabile; restano i cinque scenari quality esterni già documentati.
## 2026-08-31 — Audit funzionale UI con Playwright

### Lavoro svolto

- Eseguito `scripts/ui-functional-audit.mjs` contro una nuova istanza Next.js del tree corrente su `http://localhost:3000`.
- Percorsi UI-001–UI-008 provati click-by-click a 1280px e 390px.
- Prodotti 49 screenshot e `artifacts/ui-audit-2026-08-31/results.json` con URL, risultati, console, pageerror e request failure per checkpoint.
- Aggiornato `docs/ai/UX_FUNCTIONAL_AUDIT_2026-08-31.md` con esiti e bug riproducibili.

### Verifiche

- `pageerror`: 0; `requestfailed`: 0.
- Console: 4 errori React hydration mismatch su Agents/Tasks/Projects (diff con `style={{caret-color:"transparent"}}`).
- Bug confermati: CTA home senza handler, onboarding senza next step, provider setup non operabile, link Projects come anchor, nav mobile non raggiungibile, design gate senza CTA di recupero.

### Stato finale

Audit interattivo completato con evidenze. Definition of Done invariata: restano aperte le correzioni UX e le verifiche quality esterne.

## 2026-08-31 — Correzione UX audit (checkpoint parziale)

### Lavoro svolto

- Aggiunti AppShell e navigazione desktop/mobile accessibile, CTA home funzionali e onboarding con next step.
- Ridisegnato il form agente con template, preset sicuri, provider/modello selezionabili e Advanced per gli identificatori tecnici.
- Aggiunti task description/scope/dependencies, recovery design, pagina design, spiegazioni provider sicure e chat nel dettaglio agente.
- Riscritto il runner Playwright UI-001–UI-008 per i nuovi flussi.

### Verifiche

- `pnpm format`: PASS.
- `pnpm typecheck`: PASS (15/15 package).
- `pnpm lint`: avviato dopo typecheck; completamento da rieseguire nel prossimo checkpoint.
- Playwright aggiornato: BLOCCATO da bootstrap/hydration client nel runner headless; i submit form non emettono POST. Esito documentato in `UX_FUNCTIONAL_AUDIT_2026-08-31.md` e artifacts aggiornati.

### Stato finale

Checkpoint compilabile ma audit UI non ancora chiuso. Priorità: isolare e correggere l'aggancio degli handler client nel runner, quindi rieseguire UI-001–UI-008 e le verifiche complete.

## 2026-09-01 — Verifica deterministica pre-push del worker Codex

### Lavoro svolto

- Aggiunto un piano di verifica strutturato per task con kind, eseguibile,
  argomenti bounded e timeout; persistenza Supabase, import/export e Lead plan
  conservano il piano.
- Il queue gate Codex richiede almeno un controllo deterministico. Il worker lo
  esegue nel workspace candidato prima di commit/push tramite `execFile`, senza
  shell, con ambiente allowlist e limite output.
- Aggiunta risoluzione sicura degli shim package-manager Windows tramite i file
  JavaScript ufficiali eseguiti con Node.
- Separata l'evidenza dei comandi osservati dall'LLM (`agentCommands`) dai
  risultati autorevoli (`verification`). Failure e timeout bloccano la
  pubblicazione e seguono il retry deterministico.
- Aggiunta migrazione 23: il completamento lease registra automaticamente le
  evidence bounded in `verification_runs`; nessun stdout/stderr o argomento
  potenzialmente sensibile viene duplicato.
- UI task aggiornata con package manager, script e stato verification.

### Verifiche

- `pnpm verify`: PASS; format, lint/typecheck/build 15/15, test Turbo 26/26,
  web 22 file/38 test, worker 11 file/28 test, audit high senza vulnerabilita'.
- `pnpm test:e2e` in memory mode: PASS, 11/11.
- `supabase db reset --local`: PASS con migrazioni 00..23 e seed.
- Smoke runner reale Windows `pnpm --version`: PASS senza shell.
- Trigger verification SQL: PASS in transazione locale, poi rollback.
- Dev web/worker riavviati; `/api/health` restituisce `status: ok`.

### Stato finale

Checkpoint stabile. Prossima attivita' unica: PR GitHub e ingestione CI
idempotenti di M6; nessun push, merge o chiamata provider reale eseguiti.

## 2026-09-01 — M6 PR GitHub/CI idempotenti e gate completion

### Lavoro svolto

- Aggiunta preparazione PR GitHub idempotente per task/branch/base: lookup,
  aggiornamento/riapertura e controllo dello SHA candidato prima della review.
- Normalizzati check-run e commit-status GitHub in evidence CI per SHA esatto,
  bounded a 200, senza persistere log/output remoti o credenziali.
- Persistiti branch/SHA/PR/CI nel task; UI task mostra PR, CI e refresh CI
  protetto server-side.
- Applicati gate condivisi: verification deterministica, CI exact-SHA e
  reviewer exact-SHA sono necessari per review/complete/fix; il queue Codex
  richiede inoltre una verifica `SECURITY`.
- Corretto con migrazione forward-only il lint della funzione SQL di rinnovo
  lease (`00000000000025`). Separato l'E2E funzionale dev dal p95 production,
  senza modificare la soglia di 800 ms.

## 2026-09-01 - M7 Designer con preview statiche sicure

### Lavoro svolto

- Aggiunto il contratto di richiesta Designer bounded: agent ID, brief,
  constraint, project/task opzionali e una-tre varianti.
- Implementato il fallback v1 statico: spec, rationale, stati principali e HTML
  prodotto solo da template con dati escaped; nessuna inferenza provider o Figma
  e' necessaria per provare il flusso.
- Salvati request ID, rationale e ID preview nella persistenza in-memory;
  Supabase crea la design request, artefatti `DESIGN_PREVIEW_HTML` tenant-scoped
  e collega gli ID alla versione.
- UI `/designs`: scelta esplicita dell'agente, constraint, numero varianti e
  iframe `sandbox` per ogni preview.
- Migrazione `00000000000026`: massimo tre preview, metadata bounded a 64 KiB e
  trigger che rende contenuti/approvazione delle versioni APPROVED immutabili
  (ammesso soltanto `SUPERSEDED`).

### Verifiche

- Contract/core test: PASS; test API Designer 3/3 PASS.
- E2E Playwright M7: PASS - due preview sicure, approvazione Owner e task
  FRONTEND con ID design approvato esatto.
- `pnpm format:check`: PASS; `pnpm lint`: PASS 15/15; typecheck web: PASS.
- `supabase db reset --local`: PASS con migrazioni `00..26` e seed;
  `supabase db lint --local`: PASS.
- Build web production: completata localmente senza errori.

### Stato finale

M7 completata localmente. Prossima attivita' unica: audit M8 HR + Team Builder.
Adapter immagine/Figma e Designer provider-backed restano integrazioni esterne
non bloccanti, dietro il contratto ora persistito.

## 2026-09-02 - M8 Team Builder (checkpoint in corso)

- Esteso il contratto staffing con obiettivo e project ID opzionale; la route
  verifica l'appartenenza del progetto all'organizzazione.
- Aggiunto Team Builder alla pagina Teams: proposta da ruolo/budget/capability,
  modifiche per ogni hire, scelta provider/modello/reasoning e conferma esplicita.
- Nessuna proposta persiste agenti prima di `Confirm and hire team`; resta il
  collegamento alla creazione manuale degli agenti.
- `staffing/staffing.test.ts`: PASS. Formattazione completata; typecheck web
  avviato e da riconfermare insieme a lint/build/E2E nel prossimo checkpoint.

### Verifiche completate

- Typecheck web: PASS; format e lint: PASS.
- Build production web: PASS dopo aver isolato la cache `.next` Windows con
  path separator incompatibili; nessun file sorgente e' stato rimosso.
- E2E browser Teams: PASS - onboarding, proposta team editabile e conferma
  separata dalla creazione agenti.

### Stato finale

M8 completata localmente. Prossima attivita' unica: audit M9 Meetings.

## 2026-09-02 - M9 Meeting room operativa

- Aggiunta UI Meetings per creare e avviare riunioni con progetto, agenda,
  partecipanti, tipo e massimo tre round; contributi, minutes, decisioni, azioni
  e costo vengono mostrati dopo il run.
- Aggiunto test API/integration: meeting Architecture con tre agenti e due round
  produce sei contributi, minutes, tre action item e costo `0.06`.
- Typecheck web e test mirato passano.

### Stato finale

M9 completata localmente. Prossima attivita' unica: audit M10 Memory & Search.

## 2026-09-02 - M10 Memory & Search

### Lavoro svolto

- Reso disponibile nella pagina Conversations il pannello Structured Memory per
  creare, cercare e rimuovere memorie tenant-scoped.
- Allineato il pannello al selettore organizzazione condiviso: conserva la
  scelta locale e disabilita le azioni finche' il tenant non e' disponibile,
  evitando richieste premature durante il caricamento.
- Aggiunto E2E browser: onboarding, salvataggio di una memoria e ricerca tramite
  retrieval bounded; nessun archivio conversazioni viene usato come context.

### Verifiche

- Test API `memories.test.ts`: PASS.
- Typecheck web: PASS.
- Playwright E2E Structured Memory: PASS (1/1).

### Stato finale

M10 completata localmente. Prossima attivita' unica: audit M11 Cost, Budget &
Reporting.

## 2026-09-02 - M11 Cost, Budget & Notifications

### Lavoro svolto

- Sostituita la vista Costi generica con Cost Center: today/week/month,
  forecast deterministico, policy hard cap, top driver per provider/modello e
  attribuzione project/agent/task, oltre allo stato dei provider.
- Aggiunto inbox notifiche in-app tenant-scoped con read/unread e deep link; la
  route e' coperta da test di persistenza e mark-as-read.
- Rafforzato il claim del worker locale nel database: prima di consegnare il
  contesto con credenziale provider, una funzione SQL rivaluta policy e ledger;
  task oltre hard cap viene `BLOCKED`, gli altri hard cap con approval passano a
  `WAITING_BUDGET_APPROVAL`, con alert BUDGET agli Owner/Admin.
- Aggiunte migrazioni forward-only `27..29` per il gate e le sue correzioni di
  schema/enum rilevate dal lint locale.

### Verifiche

- API web budget/task/inbox: PASS (8 test); core budget/cost: PASS (5 test);
  worker report scheduler: PASS (2 test).
- E2E Cost Center + notification inbox: PASS.
- `pnpm format:check`, `pnpm lint`, typecheck web e build production: PASS.
- `supabase db reset --local` con migrazioni `00..29`: PASS;
  `supabase db lint --local`: PASS.
- Smoke transazionale SQL: task sopra hard cap -> `BLOCKED`, alert BUDGET 1,
  rollback eseguito.

### Stato finale

M11 completata localmente. Prossima attivita' unica: audit M12 Local Worker.
Web Push reale resta una verifica esterna con VAPID e browser/device supportato;
adapter, subscription, preferenze e deep link sono gia' implementati e testati.

## 2026-09-02 - M12 Local Worker

### Lavoro svolto

- Completato l'audit del lifecycle worker PC: token monouso, credenziale locale,
  pull control plane, heartbeat, lease/reclaim, capability, scope e concorrenza
  erano gia' presenti e coerenti con l'architettura.
- Il monitor Settings ora proietta un heartbeat assente da tre intervalli come
  `OFFLINE`, senza mutare lo stato persistito o far assegnare task impropri.
- Aggiunta revoca Owner/Admin tenant-scoped: la credenziale del PC non puo' piu'
  reclamare nuovi task; non vengono cancellati dati e i lease esistenti restano
  recuperabili secondo la scadenza normale.
- Aggiunti test per la proiezione offline, per lo scheduler con clock esplicito
  e per la route di revoca autorizzata.

### Verifiche

- Test DB worker/scheduler: PASS (4/4); test API revoca Owner: PASS (1/1).
- `pnpm format:check`, `pnpm lint` (15/15), `pnpm typecheck` (15/15) e build
  production web: PASS.
- `pnpm test:e2e`: PASS - 15 flussi funzionali, incluso monitor/revoca worker,
  piu' smoke p95 su build production.

### Stato finale

M12 completata localmente. La prova di rete con Ollama/LM Studio e un quality
node resta `PARTIAL (non-blocking)`, come deciso: non sono state richieste
chiamate provider a pagamento ne' hardware locale non disponibile. Prossima
attivita' unica: audit M13 Export / Import / Multiuser Foundations.

## 2026-09-02 - M13 Export / Import / Multiuser Foundations

### Lavoro svolto

- Completato l'audit di portability: export/import versionati, ID remap,
  relazioni, stato `REQUIRES_REAUTH`, task importati in DRAFT e template vergine
  erano gia' implementati e testati; aggiunti i controlli alla UI Settings.
- Aggiunto download dell'export soltanto per Owner e import JSON bounded a 10 MB;
  ogni import crea un tenant nuovo e non rende mai disponibili credenziali.
- Corretto il controllo in-memory: come nel repository Supabase/RLS, solo
  l'Owner puo' aggiungere o modificare collaboratori. Aggiunta rimozione
  Owner-only e migrazione `30` con trigger che proibisce rimozione/declassamento
  dell'Owner anche tramite accesso diretto consentito dalla RLS.
- Aggiunti test API per ruoli, rimozione e divieto Owner/Admin export; l'E2E
  Settings verifica anche i controlli di portability.

### Verifiche

- API membership/export/import: PASS (4/4); build contracts/DB: PASS.
- `supabase db reset --local` con migrazioni `00..30`, `supabase db lint --local`
  e query catalogo trigger Owner: PASS.
- `pnpm lint`, `pnpm typecheck` (15/15), build production web e `pnpm test:e2e`:
  PASS - 15 flussi funzionali e smoke p95 production.

### Stato finale

M13 completata localmente. Prossima attivita' unica: audit finale Definition of
Done e quality verification esterne; non e' stata dichiarata implementazione
completata perche' restano AC quality esterni bloccanti gia' tracciati.

## 2026-09-03 — Ruoli AI collegati al provider

### Lavoro svolto

Quattro ruoli erano implementati come impianto ma nessuno invocava un modello:
il piano del Lead doveva arrivare dall'esterno, i contributi delle riunioni
erano stringhe template, il Designer generava HTML statico e il Reviewer
riceveva il report invece di produrlo. Tutti e quattro sono stati collegati al
binding provider dell'agente, mantenendo deterministica ogni transizione di
stato.

- `packages/orchestration/src/lead-planner.ts`: prompt bounded, parsing JSON
  senza eval e `validateLeadPlanProposal` con i gate su cap task, aciclicita',
  write scope obbligatorio, sola lettura per REVIEW/DESIGN, design approvato per
  FRONTEND, disgiunzione write scope nei gruppi paralleli, capability e budget.
- `apps/web/app/api/workflows/plan/generate/route.ts`: genera una proposta, non
  la persiste. `plan/route.ts` applica gli stessi gate in scrittura, quindi non
  sono aggirabili inviando un piano mai generato. Estratto
  `orderLeadPlanTasks` e `scope.ts` per eliminare la duplicazione.
- `packages/orchestration/src/meeting-agenda.ts` e la route run: contributi
  reali per partecipante e round con digest bounded, verbale redatto dal Lead e
  validato deterministicamente. Action item solo a chi era presente; bozza non
  utilizzabile -> zero decisioni invece di decisioni inventate. Ogni turno
  effettivo e' addebitato e la riunione fallita torna `DRAFT`.
- `packages/orchestration/src/design-brief.ts` e `_designer.ts`: il Designer
  restituisce dati strutturati, mai markup. Colori riconvalidati contro hex al
  rendering, campi escaped, fallback al generatore deterministico.
- `packages/orchestration/src/review-brief.ts`, `listPullRequestFiles` nel
  pacchetto git e `apps/web/app/api/reviews/generate/route.ts`: il Reviewer
  legge il diff della PR con la credenziale cifrata e riporta finding. Lo stato
  `PASS`/`FIX_REQUIRED` e' derivato dai finding e lo SHA e' quello inviato,
  quindi un modello non puo' dichiarare pulito un candidato con finding
  bloccanti.
- UI: `lead-planner-panel.tsx` in `/tasks` con revisione e accettazione
  esplicita; azione `Run review` sulla scheda task con candidato pubblicato.
- Budget: pianificazione, riunioni, design e review passano dalle policy prima
  della chiamata provider e scrivono nel ledger.
- `.gitattributes` con `* text=auto eol=lf`: senza questo un checkout Windows
  con `core.autocrlf=true` faceva fallire `prettier --check` su 275 file e
  rendeva impossibile far passare `pnpm verify`.
- `docs/GO_LIVE.md`: indice dei collegamenti che restano all'utente.

### File principali

`packages/orchestration/src/{lead-planner,meeting-agenda,design-brief,review-brief,scope}.ts`,
`packages/contracts/src/index.ts`, `packages/core/src/index.ts` (`remainingHardBudget`),
`packages/git/src/index.ts`, `apps/web/app/api/{workflows/plan,meetings,designs,reviews}`,
`apps/web/app/_components/{lead-planner-panel,task-board}.tsx`, `.gitattributes`,
`docs/GO_LIVE.md`.

### Verifiche

- `pnpm verify`: PASS — format, lint, typecheck, 26 task di test, 15 build e
  audit senza vulnerabilita' note.
- Orchestration 11 file / 79 test, web 30 file / 65 test, worker 12 file / 32
  test, git 3 file / 14 test: PASS.

### Problemi

Il percorso completo del Reviewer richiede un repository GitHub collegato: in
memoria l'endpoint risponde 503. I gate di autorizzazione e le regole di
composizione sono coperti da test; il giro end-to-end ricade sotto AC-009.

### Stato finale

I sei ruoli sono ora operativi con un provider collegato. Restano i quattro
blocker esterni gia' tracciati: AC-001, AC-006, AC-009, AC-011.

## 2026-09-04 — Vista progetti, GitHub per organizzazione, run persistiti

### Cosa e' cambiato

- `agent_runs` viene finalmente scritto. `SupabaseOperationalRepository` e lo
  store in memoria espongono `startAgentRun`/`finishAgentRun`; chat, design,
  review, piano e riunioni aprono il run prima della chiamata provider e
  scrivono nel ledger l'id reale. Prima ogni azione a pagamento falliva sulla
  foreign key `cost_ledger_run_id_fkey` dopo aver gia' consumato token.
- Nuova migrazione `00000000000034_github_connections.sql`: tabella
  `github_connections` con RLS per tenant, indice unico su
  `(organization_id, lower(account_login))` e
  `repo_connections.github_connection_id`.
- `packages/git`: `getAuthenticatedAccount` e `listAccessibleRepositories`
  sull'adapter GitHub, entrambi dietro la stessa `GitHubApiError`.
- Nuove route: `GET/POST/DELETE /api/organizations/:id/github`,
  `GET /api/organizations/:id/github/repositories`, `GET /api/projects` (dati
  delle card). `POST /api/projects/:id/repository` accetta `githubConnectionId`.
- UI: `project-directory.tsx` (board di card + collegamento repository),
  `project-create-view.tsx` (`/projects/new`), `github-repository-picker.tsx`
  condiviso, card GitHub in Settings, `team-crud-panel.tsx` al posto di
  `organization-crud-panel.tsx`, picker di capability nel pannello agenti con
  `agent-capabilities.ts` come vocabolario.

### File principali

`supabase/migrations/00000000000034_github_connections.sql`,
`packages/git/src/index.ts`, `packages/contracts/src/index.ts`,
`packages/db/src/{index,agent-repository}.ts`,
`apps/web/app/api/{_store,_data,_supabase-operations}.ts`,
`apps/web/app/api/organizations/[organizationId]/github/**`,
`apps/web/app/api/projects/route.ts`,
`apps/web/app/api/{agents/[agentId]/chat,designs,reviews/generate,meetings/[meetingId]/run,workflows/plan/generate}/route.ts`,
`apps/web/app/_components/{project-directory,project-create-view,github-repository-picker,agent-capabilities,agent-crud-panel,settings-panel,team-crud-panel}.tsx`,
`apps/web/app/projects/**`, `apps/web/app/globals.css`.

### Verifiche

- format, lint 15/15, typecheck 15/15, test 26/26 (web 91 test) e build
  production: PASS.
- Nuovi test: connessione account GitHub (accettazione, riconnessione che
  sostituisce, token rifiutato, elenco repository, collegamento repository a un
  progetto senza reinserire il token, disconnessione), card progetto e
  corrispondenza fra costo della chat e run registrato.
- Verifica nel browser sul dev server: board vuota, creazione progetto, card con
  dettaglio espanso, card GitHub in Settings, picker di capability nel pannello
  agenti.

### Problemi

Il giro reale contro GitHub (token vero, elenco repository dell'utente) non e'
stato eseguito: le route sono coperte con `fetch` mockato. Resta sotto AC-009.
La migrazione `34` va applicata con `supabase db push` prima di usare la nuova
connessione GitHub sull'istanza dell'utente.

### 2026-09-05 — Perche' la prima prova falliva su tutto

Tre cause, nessuna nella logica scritta il giorno prima:

- `pnpm dev` non ricompilava `packages/*`. Il web app importa quei pacchetti da
  `dist/`, quindi girava ancora sul build del 2 settembre: `githubConnectionCreateSchema`
  risultava `undefined` (400 "A GitHub access token is required") e
  `listAssignments` non esisteva (403 su `/api/projects`). Ora `pnpm dev`
  esegue prima `dev:libraries`.
- Quattro migrazioni (`31`-`34`) non erano mai state applicate al database
  remoto, e la `31` non era ri-eseguibile (`create policy` senza drop): il push
  si fermava li' e bloccava tutte le successive. Resa idempotente e applicate.
- `/api/projects` rispondeva 403 per qualunque errore, mascherando entrambe le
  cause dietro "access denied"; le route GitHub rispondevano 500 nudo quando la
  tabella non esisteva. Ora solo un rifiuto e' 403, e uno schema non migrato
  dice di eseguire `supabase db push`.
