# Studio Playbooks — come la software house lavora

**Stato:** proposta. Nulla di quanto descritto sotto la sezione "Gli anelli
mancanti" e' implementato. Le sezioni "Cosa esiste gia'" descrivono il
repository reale al 2026-09-05.

## 1. L'obiettivo

Un progetto non deve ricominciare da zero ogni volta. L'utente sceglie un
**playbook** — un processo di consegna standardizzato — e gli agenti sanno gia'
in che ordine muoversi, cosa produrre, dove scriverlo e quando fermarsi a
chiedere. Il playbook e' richiamabile, versionato e ripetibile: e' il contratto
di lavoro dello studio, non un prompt scritto a mano ogni volta.

Due scenari guida, dati dall'utente:

- **A — Feature su repository esistente.** Si aggancia il progetto a una repo
  GitHub, si parla con il Lead Architect finche' il bisogno e' chiaro, il Lead
  produce un documento tecnico approvato, coinvolge il Designer se serve,
  scompone in task e coordina il team tenendo aggiornato l'utente.
- **B — Redesign di un sito esistente.** Si passa al Lead un URL e delle
  reference. Il Lead ne estrae contenuti e struttura, il Designer propone un
  mockup verosimile da validare, e una volta approvato il team costruisce il
  sito nuovo con i contenuti vecchi.

## 2. Cosa esiste gia'

Il motore difficile e' fatto. Tutto quanto segue e' nel repository e funziona.

| Capacita' | Dove | Cosa fa davvero |
| --- | --- | --- |
| Chat diretta con un agente | `POST/GET /api/agents/:id/chat` | Un giro di conversazione attraverso il provider dell'agente, con storico e ripresa di sessione. Budget e permessi applicati prima della chiamata. |
| Decomposizione del Lead | `POST /api/workflows/plan/generate` + `packages/orchestration/src/lead-planner.ts` | Obiettivo → piano JSON. Il piano e' **validato deterministicamente**: massimo 24 task, grafo aciclico, write scope obbligatorio per i task che scrivono, REVIEW/DESIGN read-only, task in parallelo con scope disgiunti, costo entro il budget residuo. |
| Piano → lavoro | `POST /api/workflows/plan` | Crea workflow e task con dipendenze rimappate. E' un gate umano: generare un piano non lo esegue. |
| Design con approvazione | `POST /api/designs`, `/api/designs/:id/approve` | Il Designer propone varianti; un task FRONTEND puo' citare **solo** una design version approvata. |
| Riunioni multi-agente | `/api/meetings`, `/api/meetings/:id/run` | Piu' agenti contribuiscono a turni, con verbale e decisioni. |
| Macchina a stati dei task | `packages/orchestration/src/index.ts` | 17 stati, transizioni chiuse, review gate che richiede verifica + CI + reviewer prima di `DONE`. |
| Esecuzione reale sul codice | `apps/worker/src/codex-task.ts` | Workspace Git isolato, scritture limitate al write scope, comandi di verifica eseguiti, branch `bunker/<task-id>`, pull request, evidenza della review GitHub. |
| Budget e costi | `evaluateBudgetPolicies`, `cost_ledger` | Soft/hard limit per organizzazione, progetto e agente, con blocco prima della spesa. |
| Memoria e contesto | `/api/memories`, `retrieveBoundedContext` | Contesto limitato per run: la cronologia non viene mai ricaricata per intero. |
| Proposta di organico | `/api/staffing/proposals` | Dato un obiettivo, propone quali agenti assumere e con che modello. |

Il valore di questo elenco: **le parti pericolose sono gia' risolte**. Uno
scope di scrittura non si allarga perche' il modello lo chiede, un design non
approvato non entra in produzione, un task non e' `DONE` senza verifica e
review, e la spesa e' fermata prima della chiamata al provider.

## 3. Gli anelli mancanti

Sei, in ordine di quanto bloccano gli scenari A e B.

### 3.1 Nessuno assegna i task agli agenti — blocca tutto

`POST /api/workflows/plan` crea i task **senza `assignedAgentId`**. Il worker,
in `apps/web/app/api/workers/runtime/tasks/claim/route.ts`, richiede
`assigned_agent_id` per costruire il contesto di esecuzione: senza, il task non
puo' essere preso da nessuno. Oggi non esiste nemmeno un punto nell'interfaccia
per mettere un agente su un progetto: le assegnazioni si creano solo via API.

Finche' questo anello manca, il piano piu' bello del mondo resta fermo.

### 3.2 Nessuno fa avanzare il lavoro

Le transizioni esistono ma le invoca sempre qualcuno a mano. Non c'e' un
processo che, quando le dipendenze di un task sono `DONE`, lo porti a `QUEUED`,
gli assegni un agente e avvisi l'utente. Il progetto non cammina da solo.

### 3.3 Il Lead non conduce un'intervista

La chat esiste ma non e' legata a un progetto e non produce nulla di
strutturato. Non c'e' il ciclo "il Lead chiede, tu rispondi, il Lead riassume,
tu approvi" che porta a un brief condiviso.

### 3.4 Nessuna fase scrive documenti nel repository

Lo scenario A vuole un documento tecnico che diventi la linea guida del
progetto, come `docs/ai/*` fa per Bunker Studio stesso. Tecnicamente e' un task
`DOCS` con write scope `docs/` eseguito dal worker — il meccanismo c'e', ma
nessuna fase lo orchestra.

### 3.5 Il Designer non puo' produrre un mockup vero

Per decisione esplicita (DEC-017, "Il Designer restituisce dati, non markup") il
Designer restituisce **solo dati strutturati**: titolo, sommario, due colori
esadecimali, fino a sei sezioni di testo. Lo studio ne rende un HTML statico
generato da template, con ogni campo escapato. Non e' un mockup di una
interfaccia: e' una scheda.

Lo scenario B chiede l'opposto: un mockup credibile di un sito, in HTML/CSS/JS.
Questa e' una decisione da rivedere consapevolmente, non un bug. Vedi §7.

### 3.6 Nessun agente puo' leggere il web

Lo scenario B parte da un URL. Nessun componente puo' scaricare una pagina,
estrarne contenuti e immagini. Il worker Codex ha un interruttore
`networkAccessEnabled`, ma non esiste uno strumento "leggi questo sito" con una
allowlist e un output strutturato.

## 4. Il modello: il Playbook

Un playbook e' una sequenza dichiarativa di **fasi**. Non e' un prompt: e' dati
tipizzati, versionati e testabili, che il motore esegue.

```ts
type Playbook = {
  key: string;              // 'feature-on-existing-repo'
  name: string;
  version: number;
  stages: Stage[];
};

type Stage = {
  key: string;              // 'discovery'
  kind: 'INTERVIEW' | 'DOCUMENT' | 'DESIGN' | 'PLAN' | 'EXECUTE' | 'DELIVER';
  roleKey: string;          // chi la esegue: 'lead', 'designer', ...
  optional: boolean;        // il design si salta se non serve
  produces: ArtifactSpec;   // brief | file nel repo | design version | task graph
  writeScope: string[];     // vuoto per le fasi che non scrivono
  gate: 'HUMAN_APPROVAL' | 'REVIEW_PASS' | 'AUTOMATIC';
  entry: Condition[];       // deterministiche
};
```

**La regola non negoziabile** (DEC-003): il modello produce *contenuto*, il
motore decide le *transizioni*. Un LLM non dichiara mai che una fase e' finita.
Una fase con `gate: HUMAN_APPROVAL` avanza solo quando l'utente preme approva;
una con `REVIEW_PASS` solo quando il review gate deterministico e' soddisfatto.

### Playbook A — `feature-on-existing-repo`

| # | Fase | Chi | Produce | Gate |
| --- | --- | --- | --- | --- |
| 1 | `discovery` | Lead | Brief strutturato: domande aperte, comprensione, scope proposto | Approvazione umana |
| 2 | `spec` | Lead | `docs/specs/<slug>.md` nel repo del progetto, su branch + PR | Approvazione umana |
| 3 | `design` *(opzionale)* | Designer | Mockup + design version | Approvazione umana |
| 4 | `decomposition` | Lead | Piano validato → workflow + task | Approvazione umana |
| 5 | `execution` | Team | Branch, PR, verifica, review per ogni task | Review gate deterministico |
| 6 | `delivery` | Lead | Riepilogo di cosa e' stato consegnato e cosa resta | Automatico |

La fase 1 e' un ciclo: il Lead risponde con un oggetto strutturato
(`{ questions[], understanding, openPoints[], proposedScope, readyForApproval }`)
e la conversazione continua finche' *l'utente* approva. `readyForApproval` e'
solo un suggerimento visivo, non fa avanzare nulla.

### Playbook B — `site-redesign`

| # | Fase | Chi | Produce | Gate |
| --- | --- | --- | --- | --- |
| 1 | `harvest` | Lead | Contenuti, struttura, immagini del sito sorgente in `content/` | Automatico |
| 2 | `direction` | Lead + Designer | Direzione creativa basata su reference | Approvazione umana |
| 3 | `prototype` | Designer | Mockup navigabile in `design/<slug>/` | Approvazione umana |
| 4 | `decomposition` | Lead | Piano → task | Approvazione umana |
| 5 | `execution` | Team | Sito costruito con i contenuti raccolti | Review gate |
| 6 | `delivery` | Lead | Anteprima pubblicabile | Automatico |

## 5. I pezzi da costruire

### 5.1 Router di assegnazione — deterministico

```
assign(task, project):
  candidati = agenti assegnati al progetto, non archiviati
  filtra per ruolo:  FRONTEND→frontend  BACKEND→backend
                     REVIEW→reviewer    DESIGN→designer
                     DOCS/TEST→qualsiasi ruolo che dichiari la skill
  filtra per requiredCapability ⊆ agent.skills
  ordina per: match esatto di ruolo, poi meno task attivi, poi modello piu' economico
  se nessun candidato → il task resta BLOCKED con il motivo, e l'utente e' avvisato
```

Nessun LLM. Un task che non trova nessuno lo dice, non sceglie a caso.

### 5.2 Il Conductor — il ciclo che fa camminare il progetto

Un processo deterministico (nel worker, o schedulato) che per ogni progetto
attivo:

1. promuove a `QUEUED` i task `READY` le cui dipendenze sono `DONE`, rispettando
   i gruppi paralleli e i write scope disgiunti gia' validati dal planner;
2. assegna un agente ai task che non ne hanno;
3. si ferma quando il budget residuo non copre il costo stimato;
4. scrive in `activity` e in `notifications` ogni volta che una fase si chiude o
   un gate ha bisogno dell'utente.

E' il pezzo che trasforma "un elenco di task" in "un progetto che avanza".

### 5.3 Engagement — la conversazione di progetto

Una conversazione legata al progetto e alla fase corrente, distinta dalla chat
libera con un agente. Il contratto di risposta del Lead e' strutturato e
validato con zod come tutto il resto. Il brief approvato diventa l'input della
fase `spec`.

### 5.4 Documenti nel repository

La fase `spec` e' un task `DOCS` con write scope `docs/` eseguito dal worker
Codex: produce il documento su un branch `bunker/<task-id>` con la sua PR. Nessun
meccanismo nuovo — solo una fase che lo richiede. Il playbook fissa anche i file
di continuita' del progetto, sul modello di questo repository:
`docs/specs/<slug>.md`, `docs/state/CURRENT.md`, `docs/state/NEXT.md`.

### 5.5 Lettura del web — `web.harvest`

Uno strumento **eseguito dal server, non dal modello**: prende un URL, verifica
che il dominio sia nella allowlist del progetto, scarica, estrae testo,
struttura e riferimenti alle immagini, e restituisce dati. Il modello riceve il
risultato, non la capacita' di navigare. Da valutare i limiti d'uso del sito
sorgente prima di raccoglierne i contenuti.

## 6. Piano di implementazione

Sei fasi, ognuna utile da sola. L'ordine e' quello del valore sbloccato.

| Fase | Cosa | Perche' prima |
| --- | --- | --- |
| **0** | Assegnazione: UI per mettere e spostare agenti su un progetto, router deterministico, rimozione della vista Teams con lo staffing spostato nel progetto | Senza, nessun task generato da un piano puo' essere eseguito da nessuno |
| **1** | Conductor + vista "cantiere" del progetto con avanzamento e notifiche | Il progetto inizia a camminare da solo |
| **2** | Engagement: intervista del Lead con output strutturato, gate di approvazione, fase `spec` che scrive nel repo | Copre il cuore dello scenario A |
| **3** | Playbook engine: fasi dichiarative, scelta del playbook per progetto, avanzamento deterministico | Standardizza cio' che le fasi 1-2 hanno reso possibile |
| **4** | Design prototype: mockup reali e anteprima in sandbox | Sblocca lo scenario B, dipende dalla decisione su DEC-017 |
| **5** | `web.harvest` con allowlist | Completa lo scenario B |

## 7. Decisioni da prendere

### D1 — I mockup del Designer (rivede DEC-017)

- **Conservativa:** si estende il contratto strutturato con piu' primitive di
  layout. Sicura, economica, ma non produrra' mai un mockup credibile di un
  sito esistente.
- **Raccomandata:** si aggiunge un task `DESIGN_PROTOTYPE` eseguito dal worker
  Codex con write scope limitato a `design/<slug>/**`. Il Designer produce
  HTML/CSS/JS veri, che finiscono su un branch con la loro PR come qualunque
  altro artefatto. L'anteprima si apre in un **iframe sandbox senza
  `allow-same-origin`, servito da una route dedicata con CSP stretta**: il
  markup del modello non viene mai eseguito nell'origine dello studio. DEC-017
  viene emendata, non abbandonata: cambia dove il markup e' permesso, non la
  regola che non lo si esegue in casa.

### D2 — Quanto e' autonomo il Conductor

- Avanza da solo fino al prossimo gate umano (raccomandata);
- oppure ogni promozione di task richiede un via libera.

### D3 — Dove vivono i playbook

- In codice, tipizzati e testati, versionati con il repository (raccomandata per
  la v1);
- oppure in tabella, editabili dall'utente, esportabili con il pacchetto
  organizzazione — che e' anche la strada del "team templates marketplace"
  previsto dalla specifica.
