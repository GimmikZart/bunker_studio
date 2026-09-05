# Next Steps

## Decisione di prodotto aperta — il concetto di Team

Sollevata dall'utente il 2026-09-05. Non e' stata eseguita alcuna modifica:
FR-002 e FR-003 della specifica tecnica prevedono i Team, quindi toglierli e'
una scelta di prodotto, non un refactor.

### Cosa fa oggi un Team

Nulla di deterministico. Ricognizione del repository:

- un `agent_assignments` puo' citare un `team_id` oppure un `project_id`;
- un progetto puo' avere `default_team_id` e `project_teams`;
- `GET /api/agents/:id/metrics` risolve i progetti di un agente per assegnazione
  diretta **oppure** attraverso i team del progetto;
- export e import di un'organizzazione trasportano `teams.jsonl`.

Nessuna transizione di stato, nessun instradamento del lavoro e nessun gate
dipende dal team. Le "team capabilities" del Lead planner sono l'unione delle
skill degli agenti del progetto: la parola e' generica, non l'entita'.

### L'unico argomento serio per tenerli

Riusabilita' della composizione. Un team e' un gruppo che si attacca a piu'
progetti in una mossa sola invece di N assegnazioni, ed e' l'unita' naturale del
"team templates marketplace local/import-export" previsto dalla specifica
(riga 129): un template che esporta una squadra pronta ha bisogno di un nome per
quella squadra. Senza team, un template e' un sacchetto di agenti.

### Opzioni

1. **Tenerli, ma toglierli dalla strada.** Via la voce `Teams` dalla
   navigazione e il campo team dalla creazione progetto; restano tabella, API,
   export/import per il marketplace dei template. Costo basso, nessuna perdita.
2. **Rimuoverli del tutto.** Migrazione che elimina `teams`, `project_teams`,
   `projects.default_team_id` e `agent_assignments.team_id`; semplificazione di
   metriche, portabilita' e contratti; aggiornamento di FR-002/FR-003. Va deciso
   prima se il marketplace dei template resta in scope.
3. **Lasciarli come sono.**

### Definition of Done

L'utente sceglie. La decisione va scritta in `docs/ai/DECISIONS.md` e, se cambia
il modello, la specifica va aggiornata prima del codice.

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
