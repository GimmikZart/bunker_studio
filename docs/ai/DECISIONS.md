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

## DEC-020 — Il Team resta nel modello, sparisce dall'interfaccia
**Status:** Accepted

**Decisione:** La vista `/teams` viene rimossa. Il Team resta come entita' nel modello dati, nelle API e nel pacchetto di export/import, ma non ha piu' una sezione dedicata nell'interfaccia. Gli agenti si mettono e si spostano da un progetto all'altro dalla vista del progetto.

**Motivazione:** Un progetto con i suoi agenti assegnati e' gia' concettualmente un team. Nessuna transizione di stato, nessun instradamento del lavoro e nessun gate dipende dal team: e' solo un raggruppamento. Un livello di navigazione dedicato a un raggruppamento che non fa nulla costa attenzione all'utente senza restituire niente. Si tiene l'entita' perche' e' l'unita' naturale del "team templates marketplace" previsto dalla specifica: un template che esporta una squadra pronta ha bisogno di un nome per quella squadra.

**Conseguenze:** FR-002 resta valido a livello di modello. La proposta di organico (`/api/staffing/proposals`, oggi in `TeamBuilderPanel`) va spostata nel progetto, dove ha senso: "chi mi serve per questo progetto". Serve una superficie per assegnare e spostare gli agenti fra progetti, oggi assente: le assegnazioni si creano solo via API.

## DEC-021 — Un mockup vero vive nel repository, non nell'origine dello studio
**Status:** Accepted — da implementare nella Fase 4 di `docs/product/STUDIO_PLAYBOOKS.md`

**Decisione:** DEC-017 e' emendata. Il Designer puo' produrre HTML, CSS e JavaScript reali, ma soltanto come task `DESIGN_PROTOTYPE` eseguito dal worker con write scope limitato a `design/<slug>/**`: il risultato finisce su un branch `bunker/<task-id>` con la sua pull request, come qualunque altro artefatto. L'anteprima si apre in un iframe `sandbox` senza `allow-same-origin`, servito da una route dedicata con CSP stretta. La risposta diretta del Designer resta dati strutturati.

**Motivazione:** Il contratto strutturato attuale non puo' descrivere l'interfaccia di un sito: produce una scheda con due colori e sei paragrafi. Senza mockup credibili, lo scenario "prendi un sito brutto, ridisegnalo, mostralo al cliente" non e' realizzabile.

**Conseguenze:** La regola che il markup di un modello non viene mai eseguito nell'origine dello studio resta intatta: cambia dove il markup e' permesso, non il fatto che non lo si esegua in casa. Un prototipo passa per gli stessi gate di scope, review e approvazione di ogni altro task.

## DEC-022 — L'autonomia del progetto e' gia' una policy, non un secondo interruttore
**Status:** Accepted

**Decisione:** Il conductor promuove il lavoro fino al prossimo gate umano quando il progetto e' in modalita' `AUTONOMOUS` o `LAB`, e si ferma a `READY` in `SUPERVISED` e `MANUAL`. Non esiste una seconda impostazione "quanto e' autonomo il conductor".

**Motivazione:** La specifica definisce gia' la politica di autonomia per progetto (sezione 8) e gli approval gate che valgono in ogni modalita'. Aggiungere un secondo interruttore avrebbe creato due fonti di verita' che possono contraddirsi.

**Conseguenze:** Chi vuole approvare ogni avvio mette il progetto in `SUPERVISED`. I gate che richiedono comunque una persona — budget, design, sicurezza, deploy — restano applicati dove sono gia' implementati, indipendentemente dalla modalita'.

## DEC-023 — Un worker che finisce un task chiede al control plane di proseguire
**Status:** Accepted

**Decisione:** Quando un task termina, il worker chiama `POST /api/workers/runtime/projects/advance` con la credenziale che possiede gia'. Il control plane autentica il nodo, risolve la sua organizzazione e agisce come **owner** dell'organizzazione.

**Motivazione:** La fine di un task e' il momento che sblocca il successivo, ed e' anche il momento in cui non c'e' nessun browser aperto. Senza questo, un progetto avanzerebbe solo quando qualcuno apre una pagina.

**Conseguenze:** Il worker non acquisisce alcun potere nuovo: agisce con l'identita' dell'owner, la stessa a cui appartengono budget, permessi e notifiche di quel lavoro, e ogni controllo del repository layer resta applicato. Un fallimento della chiamata non fa fallire il task: la decisione e' idempotente e verra' presa alla prossima occasione.
