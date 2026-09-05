# Next Steps

## Prossima attivita' proposta — Fase 5: leggere il web

Fasi 0-4 complete. Il Designer produce mockup navigabili, sigillati in sandbox e
approvabili; un task FRONTEND puo' citarne uno.

### Il problema

Nessun agente puo' leggere una pagina web (DEC-025): gli adapter provider non
inviano alcun array `tools`, quindi nessun modello puo' invocare funzioni. La
fase `harvest` del playbook `site-redesign` dichiara `requires: ['WEB_HARVEST']`
e resta non disponibile, quindi lo scenario «prendi un sito, tienine i contenuti,
rifallo» non parte.

### Da fare

- Strumento `web.harvest` **eseguito dal server**, non dal modello: dato un URL,
  verifica che il dominio sia nella allowlist del progetto, scarica con un limite
  di dimensione e di tempo, estrae testo, struttura dei titoli e riferimenti alle
  immagini, e restituisce dati.
- Allowlist per progetto, con l'aggiunta di un dominio come azione esplicita
  dell'utente.
- Il risultato entra nella conversazione con il Lead come contesto, non come
  istruzioni: cio' che arriva da una pagina e' testo di terzi, e va trattato come
  dato.
- La capacita' `WEB_HARVEST` diventa disponibile e la fase `harvest` smette di
  dichiararsi non costruita.

### Definition of Done

Dato un URL, il Lead puo' descrivere struttura e contenuti del sito sorgente, e
il playbook `site-redesign` non ha piu' fasi indisponibili.

### Poi

Il mockup approvato committato nel repository sotto `design/<slug>/`, che e' la
meta' di DEC-021 non ancora fatta: oggi il mockup vive come artefatto di
anteprima approvabile, non come file nel repository del progetto.

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
