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
