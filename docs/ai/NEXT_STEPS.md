# Next Steps

## Prossima attivita' proposta — Fase 3: dal brief approvato al documento e al piano

Fasi 0, 1 e 2 complete: il Lead conduce l'intervista, sceglie il processo e il
brief approvato e' memoria di progetto; i task che ne derivano vengono assegnati
ed eseguiti da soli. Manca l'anello che li unisce.

### Il problema

Un brief approvato non fa ancora partire nulla. Chi lo ha approvato deve
comunque generare un piano a mano dalla vista dei workflow, e la fase `spec` —
il documento tecnico che diventa la linea guida del progetto — non e' orchestrata
da nessuno.

### Da fare

- Motore delle fasi: il progetto ricorda a che punto del playbook si trova e
  quale gate lo tiene fermo. Le transizioni restano deterministiche; il gate
  `HUMAN_APPROVAL` avanza solo su azione dell'utente.
- Fase `spec`: dal brief approvato nasce un task `DOCS` con write scope `docs/`,
  eseguito dal worker, che produce `docs/specs/<slug>.md` su un branch con la
  sua pull request.
- Fase `decomposition`: il brief e il documento approvati diventano l'obiettivo
  passato a `POST /api/workflows/plan/generate`, invece di riscriverlo a mano.
- I file di continuita' del progetto: `docs/state/CURRENT.md`, `docs/state/NEXT.md`.

### Definition of Done

Da un brief approvato si arriva, senza chiamate manuali, a un documento tecnico
committato e a un piano proposto per l'approvazione.

### Decisioni gia' prese

DEC-021 (mockup reali in sandbox, Fase 4), DEC-022 (l'autonomia del progetto e'
il gate), DEC-023 (il worker chiede di proseguire), DEC-024 (playbook in codice
tipizzato), DEC-025 (nessun agente ha strumenti; il web si leggera' con uno
strumento server-side con allowlist, Fase 5).

## Prossima attivita' precisa — verifiche esterne AC-001, AC-006, AC-009, AC-011

Tutto cio' che si puo' implementare e verificare senza credenziali e' completo.
I sei ruoli invocano il provider dell'agente, i gate deterministici sono
applicati sia in generazione sia in scrittura, e `pnpm verify` passa.

Restano quattro verifiche che non possono essere eseguite in questo workspace
perche' richiedono credenziali, un database di quality o un dispositivo reale.
Non sono lavoro di implementazione: sono prove sul campo.

### Area interessata

Esecuzione delle procedure gia' scritte in
`docs/quality/QUALITY_SETUP_GUIDE.md`, aggiornamento di
`docs/quality/ACCEPTANCE_MATRIX.md` con l'esito e registrazione nel worklog.

### Comportamento da verificare

- **AC-001** — creare l'organizzazione su un dispositivo, aprirla da un secondo
  dispositivo con Supabase Cloud configurato e ritrovare agenti, task e storico.
- **AC-006** — eseguire lo smoke pg-boss a due processi contro il database di
  quality: il primo processo esce senza completare, il secondo riprende il job
  alla scadenza del lease.
- **AC-009** — collegare un repository GitHub di prova con branch protetto,
  eseguire un task Codex e verificare branch `bunker/<task-id>`, PR, stato CI e
  il rifiuto della completion quando i gate non sono soddisfatti. Questa prova
  esercita anche il percorso completo del Reviewer sul diff reale.
- **AC-011** — generare le chiavi VAPID, iscrivere un dispositivo reale su HTTPS
  e verificare la consegna della notifica con deep link.

### Definition of Done locale

Ogni riga `PARTIAL` bloccante della matrice acceptance diventa `PASS` con
evidenza, oppure resta `PARTIAL` con il motivo preciso. Solo quando i quattro
blocker sono chiusi e il drill di backup/restore e' eseguito,
`docs/ai/CURRENT_STATE.md` puo' contenere `IMPLEMENTAZIONE COMPLETATA`.

### Se non hai ancora le credenziali

Non esiste un task di implementazione indipendente rimasto in scope. Il miglior
uso del tempo e' seguire `docs/GO_LIVE.md` nell'ordine indicato: gia' al punto 2
(provider AI) il prodotto e' pienamente utilizzabile per pianificare, chattare,
fare riunioni e progettare; il punto 4 (GitHub) abilita scrittura di codice e
review sul diff reale.
