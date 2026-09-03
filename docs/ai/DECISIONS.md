# Technical Decisions

## DEC-001 — Cloud-first, device-independent
**Status:** Accepted

**Decisione:** Lo stato autorevole di Bunker Studio vive nel cloud. Browser/desktop/mobile sono client. Processi worker e workspace di esecuzione sono sacrificabili.

**Motivazione:** Un guasto del PC non deve causare perdita di agenti, storico, task o memoria.

**Conseguenze:** Tutto lo stato durevole deve essere persistito prima di considerare completata una transizione.

## DEC-002 — Provider abstraction
**Status:** Accepted

**Decisione:** Identità dell'agente separata da provider, modello e runtime.

**Motivazione:** Un agente deve sopravvivere a cambio OpenAI/Anthropic/local/futuri provider.

**Conseguenze:** Nessun dominio core può dipendere da tipi specifici di un provider.

## DEC-003 — Deterministic control plane
**Status:** Accepted

**Decisione:** Stato, retry, budget, dependency resolution, approval gate e scheduling sono deterministici. Gli LLM sono invocati solo per compiti che richiedono giudizio/generazione.

**Motivazione:** Costi, sicurezza e affidabilità.

**Conseguenze:** Il Lead propone piani/decisioni strutturate; il workflow engine ne applica gli effetti validati.

## DEC-004 — Postgres as system of record
**Status:** Accepted

**Decisione:** PostgreSQL/Supabase è il system of record per stato, audit, conversazioni, task, agenti, eventi, budget e job metadata.

**Motivazione:** Ridurre infrastruttura e mantenere transazioni forti.

**Conseguenze:** Queue e outbox devono poter sopravvivere al riavvio dei worker.

## DEC-005 — Durable queue on PostgreSQL
**Status:** Accepted

**Decisione:** Usare `pg-boss` per job durable e delayed retry nella prima release.

**Motivazione:** Evita Redis/Temporal nella v1 e supporta retry/scheduling persistente.

**Conseguenze:** I job devono essere idempotenti; migrazione futura a un workflow engine dedicato resta possibile dietro un'interfaccia.

## DEC-006 — Supabase platform
**Status:** Accepted

**Decisione:** Supabase per Postgres, Auth, Storage e Realtime.

**Motivazione:** Velocità di sviluppo, RLS, managed cloud e supporto locale.

**Conseguenze:** Le funzionalità core non devono dipendere da API proprietarie non sostituibili senza adapter.

## DEC-007 — Web-first PWA
**Status:** Accepted

**Decisione:** Prima UI come responsive PWA. Desktop native wrapper (Tauri) dopo stabilizzazione.

**Motivazione:** Massima disponibilità da PC e telefono con una sola codebase.

**Conseguenze:** Push Web e responsive sono requisiti v1.

## DEC-008 — Agent memory is persisted, context is retrieved
**Status:** Accepted

**Decisione:** Salvare storico completo ma non reiniettarlo integralmente nei prompt. Usare memoria strutturata, summary e retrieval scoped.

**Motivazione:** Evitare context bloat e costi crescenti.

**Conseguenze:** Decisioni e knowledge persistenti devono essere entità separate dalle chat raw.

## DEC-009 — Human approval gates
**Status:** Accepted

**Decisione:** Default autonomy `AUTONOMOUS`, con approvazione obbligatoria per costi oltre policy, decisioni prodotto rilevanti, design finali, sicurezza critica, azioni distruttive/pericolose e produzione.

**Motivazione:** Massima autonomia senza perdere controllo sui rischi.

**Conseguenze:** I gate sono enforced dal control plane, non solo dal prompt.

## DEC-010 — Self-improvement protected mode
**Status:** Accepted

**Decisione:** Bunker Studio può gestire il proprio repository come progetto, ma nessun agente può auto-deployare il core in produzione o approvare da solo modifiche protette.

**Motivazione:** Consentire self-improvement senza self-modification incontrollata.

**Conseguenze:** Branch isolato, CI, review e approvazione Owner obbligatori.

## DEC-011 — Cost-optimized model routing
**Status:** Accepted

**Decisione:** Worker economici come default; modelli più costosi solo per decomposition, escalation e review.

**Motivazione:** L'obiettivo primario è contenere fortemente i costi.

**Conseguenze:** Il routing deve avere policy configurabili e misurazione costo per run/task/agent/project.

## DEC-012 — Office visualization is deterministic
**Status:** Accepted

**Decisione:** Posizione/movimento/status degli avatar derivano dallo stato applicativo, senza chiamate LLM.

**Motivazione:** La metafora dell'ufficio non deve aumentare il costo token.

**Conseguenze:** UI 2D/SVG/CSS, niente simulazione agentica per scenografia.

## DEC-013 — Work isolation
**Status:** Accepted

**Decisione:** Agenti che scrivono codice in parallelo devono usare branch/worktree/workspace isolati e scope non sovrapposti.

**Motivazione:** Evitare conflitti e corruzione del lavoro.

**Conseguenze:** Il Lead può parallelizzare solo task con dependency graph e write scopes compatibili.

## DEC-014 — Local runtime deferred and non-blocking
**Status:** Accepted — 2026-08-31

**Decisione:** Il runtime locale (Ollama/LM Studio) resta una capacita supportata e gia predisposta tramite adapter, scheduler, control plane, fake e contract test, ma la prova con un nodo reale e rinviata finche l'utente non dispone di un computer adeguato. AC-013 e quindi `PARTIAL (non-blocking)` e non impedisce la release iniziale.

**Motivazione:** L'utente non dispone attualmente dell'hardware necessario. Rendere obbligatoria questa prova impedirebbe senza motivo la verifica delle funzionalita indipendenti e contraddirebbe l'obiettivo cloud-first del prodotto.

**Conseguenze:** Non vengono rimossi ne indeboliti i controlli del local worker e non si dichiara AC-013 `PASS` senza la prova reale futura. I blocker di release restano soltanto AC-001, AC-006, AC-009 e AC-011, oltre al backup/restore drill.

## DEC-015 — Provider/model per agente e worker ibrido

**Status:** Accepted — 2026-09-01

**Decisione:** Provider, account, modello, runtime e reasoning sono un binding versionato del singolo agente e non variabili d'ambiente globali. La stessa app puo' girare locale o ospitata contro Supabase Cloud. Nel percorso iniziale il web puo' essere ospitato mentre il worker repository resta sul PC e comunica in pull via HTTPS.

**Motivazione:** L'identita' dell'agente deve sopravvivere ai cambi di modello e agenti diversi devono poter usare modelli/provider diversi. Il worker sul PC consente lavoro concreto sui repository e controllo dal telefono senza imporre subito un costo di hosting worker.

**Conseguenze:** Gli env contengono solo configurazione infrastrutturale; le credenziali provider/repository sono cifrate per organizzazione/progetto. Un task Codex usa workspace e branch isolati, non auto-merge e non auto-deploy. A PC spento i task restano durable in coda.

## DEC-016 — Il Lead propone, il motore valida, l'Owner accetta

**Status:** Accepted — 2026-09-03

**Decisione:** La decomposizione del lavoro e' generata dal Lead tramite provider, ma il piano non e' mai persistito direttamente. `POST /api/workflows/plan/generate` restituisce una proposta; solo `POST /api/workflows/plan` la trasforma in task. Gli stessi gate deterministici (`validateLeadPlanProposal`) sono applicati in entrambi gli endpoint.

**Motivazione:** DEC-003 vieta di affidare a un LLM transizioni di stato deterministiche. Un piano che crea task, write scope e costi e' una transizione di stato: il modello puo' proporlo, non decretarlo. Applicare i gate anche in submit impedisce di aggirarli inviando un piano mai generato.

**Conseguenze:** Un piano che viola cap sul numero di task, aciclicita', write scope obbligatorio per task che scrivono, sola lettura per REVIEW/DESIGN, design approvato per i task FRONTEND, disgiunzione dei write scope nei gruppi paralleli, capability del team o budget residuo viene rifiutato con l'elenco completo delle violazioni. Il costo della pianificazione e' addebitato al ledger e gated dalle budget policy prima della chiamata provider.

## DEC-017 — Il Designer restituisce dati, non markup

**Status:** Accepted — 2026-09-03

**Decisione:** Un Designer provider-backed restituisce esclusivamente dati strutturati (`designDraftSchema`). L'anteprima HTML e' renderizzata dallo studio con escaping di ogni campo e colori riconvalidati contro `^#[0-9a-fA-F]{6}$` al momento del rendering. Se la risposta non rispetta il contratto si ricade sul generatore deterministico.

**Motivazione:** Un'anteprima viene aperta da un revisore. Accettare markup da un modello significherebbe eseguire contenuto non fidato nel browser di chi approva.

**Conseguenze:** Nessun percorso puo' introdurre HTML, CSS o script generati dal modello. Il fallback mantiene il flusso usabile prima che un provider sia collegato, e i due percorsi condividono lo stesso limite di dimensione dell'anteprima.

## DEC-018 — Un verbale non prova decisioni che non ci sono

**Status:** Accepted — 2026-09-03

**Decisione:** I contributi di una riunione sono generati dagli agenti partecipanti tramite il rispettivo binding provider. Il verbale e' redatto dal Lead ma validato deterministicamente: un action item puo' essere assegnato solo a un agente presente, e se la bozza non e' utilizzabile si registrano zero decisioni conservando i contributi.

**Motivazione:** La versione precedente sintetizzava decisioni dall'agenda e action item dall'elenco partecipanti. Erano dati inventati, indistinguibili da decisioni reali per chi legge lo storico.

**Conseguenze:** Un verbale vuoto e' un esito legittimo e onesto. Ogni turno effettivamente eseguito e' addebitato al ledger anche se la riunione fallisce a meta', e la riunione torna in `DRAFT` invece di restare bloccata in `RUNNING`.

## DEC-019 — Fine riga normalizzate nel repository

**Status:** Accepted — 2026-09-03

**Decisione:** Il repository dichiara `* text=auto eol=lf` in `.gitattributes`.

**Motivazione:** Senza questo, un checkout Windows con `core.autocrlf=true` produce file CRLF che fanno fallire `prettier --check` su ogni file del repository, rendendo impossibile far passare `pnpm verify` su una macchina di sviluppo Windows.

**Conseguenze:** Il working tree usa LF su ogni piattaforma indipendentemente dalla configurazione git locale. Gli asset binari sono esclusi esplicitamente dalla conversione.
