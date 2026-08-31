# UX & Functional Audit — 2026-08-31

## Scopo e attendibilità

Questo documento è il handoff per la sessione che dovrà correggere l'esperienza utente.

- Inventario e rilievi UX: analisi statica di pagine, componenti, route API e test repository.
- Test click-by-click e console: **ESEGUITI** tramite Playwright headless sul server locale. Gli artefatti generati sono ignorati da Git nella cartella `artifacts/`.
- I test E2E esistenti verificano principalmente route, API e controlli nominati; non coprono il percorso iniziale completo né la comprensibilità dei form.

## Esito sintetico

Il prodotto contiene molte capability backend e vertical slice UI, ma oggi non offre un onboarding coerente. Un utente senza organizzazioni arriva su `/agents`, vede un form disabilitato e un messaggio che gli chiede di creare un'organizzazione senza dirgli dove farlo. Anche dopo averla creata, la creazione dell'agente richiede di indovinare valori tecnici (role key, provider binding, capability) non guidati dalla UI.

**Priorità di correzione:** costruire prima un flusso "Primo studio" guidato: Account → Organizzazione → Progetto → Team opzionale → Agente da template → binding/provider selezionabile. Non aggiungere altre feature prima di aver reso completabile questo percorso.

## Warning console hydration

### HYD-001 — attributo iniettato da estensione browser

**Evidenza:** il log allegato riporta una differenza esclusivamente sul `<body>`:

```text
cz-shortcut-listen="true"
```

Questo attributo non è prodotto dall'app: viene inserito da un'estensione del browser prima dell'hydration React. Il componente root ora usa `suppressHydrationWarning` sia su `<html>` sia su `<body>` in `apps/web/app/layout.tsx`.

**Stato:** `RISOLTO/VERIFICATO`: il controllo corrente non rileva mismatch applicativi dopo hard refresh. Eventuali attributi aggiunti da estensioni restano esterni all'applicazione.

**Verifica richiesta:** arrestare eventuali vecchi `pnpm dev`, avviare `pnpm dev`, fare hard refresh della pagina e controllare la console. Se il messaggio resta, verificare che il browser stia effettivamente servendo il workspace corrente e provare una finestra senza estensioni. Non silenziare mismatch all'interno dei componenti applicativi.

## Feature disponibili e azioni esposte oggi

| Area | UI esposta | Azioni realmente disponibili dalla UI | Gap rilevante |
| --- | --- | --- | --- |
| Accesso | `/signup`, `/login` | creare account, login | non guidano alla creazione dell'organizzazione |
| Onboarding | `/onboarding` | creare un'organizzazione | nessun link/CTA verso questa route dalle pagine operative |
| Office | `/` | vedere agenti per ruolo, aprire dettaglio agente, aprire Meetings | CTA `Create project` e `Add an agent` non fanno nulla; Projects punta a un anchor, non alla pagina Projects |
| Organizations | dropdown riutilizzato nelle pagine | scegliere organizzazione e ricordarla localmente | nessuna pagina di gestione/creazione raggiungibile dalla navigazione |
| Projects | `/projects` | creare, modificare, archiviare progetto | pagina non presente nella nav principale |
| Teams | `/teams` | creare, modificare, archiviare team | pagina non presente nella nav principale |
| Agents | `/agents` | creare, modificare, archiviare, aprire dettaglio | campi tecnici liberi; nessun template, nessuna guida, nessun collegamento all'onboarding |
| Agent detail | `/agents?agentId=…` | vedere metriche, skills, tools, permissions, assegnamenti | nessuna chat o modifica assegnamenti dalla UI; mostra ID tecnici per team/progetto |
| Tasks | `/tasks` | creare task, scegliere tipo, costo, design approvato per frontend, cambiare stato | nessun editor di descrizione, dipendenze, scope, assegnatario o piano Lead |
| Approvals | `/approvals` | vedere fino a 8 record, approvare/rifiutare pending approval | nessuna creazione/contesto completo dell'approvazione |
| Meetings | `/meetings` | vedere record | creazione/esecuzione meeting disponibile via API ma non dalla UI |
| Costs | `/costs` | vedere ledger/forecast sintetico | nessun drill-down per provider, agente, task o periodo |
| Settings | `/settings` | leggere runtime/provider/worker, preferenze notifiche, push, budget e report | provider e worker sono solo lettura: nessun setup guidato |
| Conversations | `/conversations` | cercare archivio conversazioni | nessun accesso alla chat diretta dell'agente |
| Activity | `/activity` | vedere timeline sintetica | filtri dichiarati ma non implementati in UI |
| Studio Labs | `/studio-labs` | inizializzare core, analizzare metriche, selezionare proposta e richiedere approval | percorso specialistico, non adatto come entry point |

## Capability API/backend non esposte o parzialmente esposte nella UI

Le seguenti capability sono presenti in route/test ma non hanno un percorso UI completo: provider connection e catalogo modelli, repository GitHub, design request/version/approve, HR staffing proposal/confirm, memories CRUD, chat agente, assegnamenti agenti, meeting create/run, review report, verification run, workflow Lead/DAG, registrazione worker e import/export organizzazione.

Non presentarle come feature “utilizzabili” per un utente finché non esiste un flusso UI scoperto e documentato.

## Percorso utente simulato: primo utilizzo

| Passo | Azione umana prevista | Esito attuale | Valutazione |
| --- | --- | --- | --- |
| 1 | apro `/` | vedo Office e CTA iniziali | **Bloccante:** le CTA non navigano né aprono form |
| 2 | apro Agents dalla nav | vedo dettaglio agente in loading e form disabilitato con “No organizations” | **Bloccante:** il messaggio non contiene link o istruzioni operative |
| 3 | cerco dove creare organizzazione | devo conoscere o indovinare `/onboarding` | **Bloccante:** route non scopribile |
| 4 | creo organizzazione su `/onboarding` | organizzazione viene creata | **Critico:** nessun redirect né pulsante “continua a creare il primo agente/progetto” |
| 5 | torno in Agents | posso selezionare l'organizzazione e compilare il form | **Critico:** `Role key` e `Provider binding label` non hanno valori ammessi, esempi affidabili o selettori |
| 6 | inserisco skills/tools/permissions | posso scrivere qualunque stringa separata da virgole | **Critico:** l'utente non sa quali capability siano valide, rischia agenti inutilizzabili o configurazioni incoerenti |
| 7 | creo un agente | il backend accetta il record | **Critico:** non è chiaro quale provider/modello userà realmente, né come configurarlo |
| 8 | creo progetto/team | le pagine esistono ma non sono nella navigazione principale | **Alto:** funzioni esistenti sono nascoste |
| 9 | creo task | possibile solo dopo il progetto | **Medio:** il form è minimale e non spiega prerequisiti/design gate/stati |

## Rilievi prioritari

### P0 — l'utente non può iniziare senza conoscere URL interni

**Evidenza:** AgentCrudPanel, TaskBoard, LivePanel e SettingsPanel mostrano “Create or select an organization…”, ma non renderizzano un link a `/onboarding`. La home espone due button senza handler.

**Correzione proposta:**

1. Se non esiste un'organizzazione, il root deve mostrare una sola empty state con CTA `Crea la tua organizzazione` → `/onboarding`.
2. `/onboarding` deve fare redirect a un wizard o mostrare CTA sequenziali dopo la creazione: `Crea progetto`, `Crea agente da template`.
3. Le CTA home devono essere link reali a `/projects` e `/agents` oppure aprire dialog funzionanti.

**Criterio di accettazione:** un nuovo utente arriva a creare il primo agente funzionante partendo dalla home, senza digitare URL e senza leggere documentazione esterna.

### P0 — la navigazione primaria è incompleta e incoerente

**Evidenza:** la home ha `Projects` come `href="#projects"`, non `/projects`; Teams non è nella nav; molte pagine non hanno nav; la nav di Studio Labs ha un set diverso di voci.

**Correzione proposta:** un unico AppShell con nav coerente: Office, Projects, Teams, Agents, Tasks, Approvals, Meetings, Costs, Activity, Settings. Evidenziare la route corrente e mostrare l'organizzazione selezionata nel topbar.

### P0 — creazione agente espone dettagli interni anziché scelte di prodotto

**Evidenza:** screenshot e `AgentCrudPanel` richiedono `Role key`, `Provider binding label`, Skills, Tools e Permissions come testo libero. La label “local-ollama or provider label” non è una specifica utilizzabile.

**Correzione proposta:**

1. sostituire `Role key` con template selezionabili (Lead, Frontend, Backend, Reviewer, Designer, HR, Custom) e descrizione del ruolo;
2. sostituire binding libero con provider/model configurati, più CTA `Configura provider` quando assenti;
3. offrire preset sicuri di skills/tools/permissions per template, con editor avanzato opzionale e capability validate;
4. aggiungere help contestuale con esempi e spiegazione di effetti/costi;
5. spostare ID tecnici e override nell'area Advanced.

**Criterio di accettazione:** un utente non tecnico può creare un `Frontend Engineer` scegliendo template, provider e modello da controlli guidati; nessun valore obbligatorio richiede di conoscere identificatori interni.

### P1 — l'interfaccia dichiara feature che non rende eseguibili

**Evidenza:** Meetings, Costs e Activity riciclano LivePanel (sola lettura); Settings mostra provider/worker in sola lettura; API espongono molte azioni senza CTA UI; Agent Detail non ha chat.

**Correzione proposta:** per ogni area decidere esplicitamente una delle due opzioni: implementare la CTA end-to-end oppure marcare la capability come “non ancora disponibile” e rimuoverla dalla nav/claim. La prima tranche deve coprire provider setup, chat agente, meeting create/run, design/staffing, repository link e import/export.

### P1 — errori e stati vuoti non aiutano a recuperare

**Evidenza:** messaggi generici: “The agent could not be saved”, “Nothing recorded yet”, “No organizations”. Non indicano causa, prerequisito o prossimo click.

**Correzione proposta:** empty state con CTA, errori inline per campo, summary dei prerequisiti, link contestuali e copy in italiano coerente con il pubblico iniziale.

### P2 — dettaglio agente poco leggibile

**Evidenza:** mostra `team:<UUID>` / `project:<UUID>`; non espone i tab previsti (Chat, Work, Memory, Skills & Tools, Permissions, Performance, Costs, Activity).

**Correzione proposta:** risolvere gli ID in nomi/link, implementare tab progressive e nascondere dati non configurati.

## Matrice di test da eseguire con browser collegato

| ID | Flusso | Passi click-by-click | Atteso |
| --- | --- | --- | --- |
| UI-001 | Nuovo workspace | Home → Crea organizzazione → nome → crea | redirect/next step esplicito, nessun errore console |
| UI-002 | Primo agente | onboarding completato → Agents → template → provider/modello → create | form guidato, validazione, agente visibile in Office |
| UI-003 | Primo progetto/task | Projects → create → Tasks → create → state transition | prerequisiti chiari, stato aggiornato |
| UI-004 | Provider setup | Settings → configura provider → salva → Agents | binding selezionabile; nessun segreto esposto |
| UI-005 | Navigazione | aprire ogni voce desktop/mobile | stessa nav, route esistenti, nessun dead-end |
| UI-006 | Error handling | organizzazione assente, provider assente, design frontend assente | messaggi con CTA e causa comprensibile |
| UI-007 | Console | Home, Agents, Tasks, Settings dopo hard refresh | nessun error/warning app; HYD-001 assente |
| UI-008 | Responsive | 390px e 1280px sui flussi UI-001..006 | no overflow, CTA raggiungibili, form leggibili |

## Tentativo di esecuzione interattiva — 2026-08-31

**Esito complessivo:** `BLOCCATO — nessun test UI dichiarato eseguito`.

È stato richiesto esplicitamente l'uso del Browser integrato. Il collegamento al browser non ha restituito alcuna istanza disponibile (`[]`) e il selettore del Browser integrato ha risposto `Browser is not available: iab`. Per rispettare il vincolo sul browser richiesto, non è stato sostituito con un'altra superficie di automazione né con test statici/E2E: questi non costituiscono una prova click-by-click condotta da un umano.

| ID | Stato | Screenshot | Console | Risultato verificabile | Blocco |
| --- | --- | --- | --- | --- | --- |
| UI-001 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-002 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-003 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-004 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-005 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-006 | BLOCCATO | Non acquisibile | Non accessibile | Non eseguito | Browser integrato non disponibile |
| UI-007 | BLOCCATO | Non acquisibile | Non accessibile | HYD-001 non validabile | Browser integrato non disponibile |
| UI-008 | BLOCCATO | Non acquisibile | Non accessibile | Viewport 390/1280 non validabili | Browser integrato non disponibile |

**Evidenza del blocco:** selezione Browser integrato → `Browser is not available: iab`; inventario delle istanze disponibili → `[]`.

**Secondo tentativo:** ricevuto l'URL `http://localhost:3000` dall'utente e ripetuta la selezione del Browser integrato; l'inventario è ancora `[]` e `get("iab")` restituisce `Error: Browser is not available: iab`. Nessuna pagina è stata quindi aperta o cliccata.

**Prerequisito per riprendere:** rendere disponibile una sessione Browser integrata nella chat, quindi rieseguire l'intera matrice con server locale appena avviato, una nuova organizzazione di test e screenshot nominati `UI-001`…`UI-008`. Questa sezione dovrà essere sostituita dagli esiti effettivi, inclusi click, URL, dati inseriti, screenshot e ogni errore/warning console.

## Esecuzione interattiva Playwright — 2026-08-31

Questa sezione supersede il precedente tentativo bloccato del Browser integrato.

**Esito complessivo:** `COMPLETATO CON BUG UX/FUNZIONALI RIPRODOTTI`.

Playwright ha eseguito 49 checkpoint click-by-click su `http://localhost:3000` con una nuova istanza Next.js locale. Sono stati acquisiti screenshot dopo ogni checkpoint e raccolti console, `pageerror` e request failure. L'indice completo è in [`artifacts/ui-audit-2026-08-31/results.json`](../../artifacts/ui-audit-2026-08-31/results.json); gli screenshot sono nella stessa cartella.

| ID | Esito | Evidenza principale | Screenshot rappresentativi |
| --- | --- | --- | --- |
| UI-001 | **FAIL UX** | Home mostra `Create project` e `Add an agent`, ma il click non cambia URL né apre un form. `/onboarding` crea l'organizzazione, resta sulla stessa pagina e non propone il passo successivo. | `UI-001-home.png`, `UI-001-create-project-click.png`, `UI-001-created.png` |
| UI-002 | **PARTIAL** | Agente creato e visibile in Office. La configurazione richiede testo libero per `Role key`, `Provider binding label`, Skills, Tools e Permissions; nessun template/provider/model guidato. | `UI-002-form.png`, `UI-002-created.png`, `UI-002-office.png` |
| UI-003 | **PASS tecnico / FAIL UX** | Progetto, task `DRAFT` e transizione `DRAFT → READY` funzionano dopo attesa del caricamento. Il form non espone descrizione, dipendenze, scope o assegnatario. | `UI-003-project.png`, `UI-003-task-draft.png`, `UI-003-task-ready.png` |
| UI-004 | **FAIL UX** | Settings mostra runtime/provider locale e stato worker, ma non esiste `Configure provider`: non è possibile configurare o aggiungere un provider dalla UI. | `UI-004-settings.png` |
| UI-005 | **FAIL responsive/nav** | Desktop: `Projects` porta a `/#projects` invece che a `/projects`. Mobile 390px: tutti i link della nav primaria risultano non visibili/raggiungibili; non c'è una bottom navigation alternativa. | `UI-005-1280-projects.png`, `UI-005-390-office.png` |
| UI-006 | **PARTIAL** | Selezionando `FRONTEND` senza design approvato, `Create task` è disabilitato e l'unica opzione è `Approve a design first`. Il prerequisito è comprensibile ma non c'è una CTA per avviare il design. | `UI-006-design-gate.png`, `UI-006-provider.png` |
| UI-007 | **FAIL console** | `pageerror`: 0. Console: 4 errori React di hydration mismatch su hard refresh/route (Agents, Tasks, Projects); il diff mostra `style={{caret-color:"transparent"}}` iniettato sugli input. | `UI-007-agents.png`, `UI-007-tasks.png` |
| UI-008 | **PASS layout / FAIL nav** | A 390px e 1280px `overflow=false` e `<main>` è visibile su Office, Agents, Projects, Tasks e Settings. La navigazione resta però irraggiungibile a 390px (vedi UI-005). | `UI-008-390-home.png`, `UI-008-1280-home.png`, `UI-008-390-settings.png` |

### Console e rete

- `pageerror`: 0.
- `requestfailed`: 0.
- Console error: hydration mismatch React su Agents/Tasks/Projects; nessun warning applicativo aggiuntivo rilevato.
- La prima istanza sulla porta 3000 serviva una vecchia pagina Next 404 (`missing required error components`). Il processo è stato arrestato e il test è stato ripetuto su una nuova istanza dello stesso codice a `localhost:3000`.

### Riproducibilità

Il runner usato è [`scripts/ui-functional-audit.mjs`](../../scripts/ui-functional-audit.mjs). Per ripetere il test con il server già attivo:

```powershell
$env:AUDIT_BASE_URL='http://127.0.0.1:3000'; pnpm exec node scripts/ui-functional-audit.mjs
```

## Verifiche repository disponibili

- `tests/e2e/studio.spec.ts`: onboarding locale, login/signup e PWA.
- `tests/e2e/quality-smoke.spec.ts`: route core, controlli nominati, overflow e `pageerror` generici.
- `tests/e2e/api-acceptance.spec.ts`: tenancy, design/staffing/memory, worker, meetings, approvals, costi, repository e portability via API.

La suite non dimostra che un utente possa scoprire o completare le azioni: aggiungere test UI specifici della matrice precedente prima di dichiarare risolte le P0/P1.

## Ordine consigliato per la sessione correttiva

1. Validare HYD-001 con server riavviato e browser senza/col estensione.
2. Creare AppShell + nav coerente + CTA home funzionanti.
3. Implementare onboarding guidato e empty state con link, partendo da nessuna organizzazione.
4. Ridisegnare `AgentCrudPanel` come creazione da template/provider/model, con validazione.
5. Aggiungere test E2E UI-001, UI-002, UI-003, UI-005 e UI-007.
6. Rendere progressivamente operabili le capability oggi API-only, iniziando da provider, chat e repository.

## Sessione correttiva completata — 2026-08-31

Implementati nel working tree: AppShell con navigazione desktop/mobile e route attiva, CTA home reali, onboarding con next step, creazione agente da template e provider/modello disponibili, task form con descrizione/dipendenze/scope e recovery CTA per design, dettaglio agente con chat, pagina design e stati vuoti recuperabili.

La nuova versione di `scripts/ui-functional-audit.mjs` copre UI-001–UI-008 e salva screenshot/evidenze. E' stato corretto il race condition tra caricamento della route e hydration client, i click di navigazione sono coordinati con l'attesa URL e il menu mobile viene verificato tramite il suo elemento `summary` accessibile. L'esecuzione corrente passa tutti i 13 checkpoint: CTA home, onboarding, progetto, agente da template/provider, task DRAFT->READY, design gate, Settings/provider, navigazione desktop/mobile, hard refresh e responsive. `pnpm verify` e `pnpm test:e2e` sono verdi. Le evidenze locali correnti sono in `artifacts/ui-audit-2026-08-31/results.json` e non vengono versionate.
