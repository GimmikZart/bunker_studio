# Bunker Studio — Autonomous Development Instructions

Agisci come agente software autonomo incaricato di implementare Bunker Studio fino alla Definition of Done della specifica tecnica.

## 1. Documenti obbligatori

Prima di modificare il codice leggi, in questo ordine:

1. `docs/technical/TECHNICAL_SPECIFICATION.md`
2. `docs/product/PRODUCT_UX.md`
3. `docs/technical/ARCHITECTURE.md`
4. `docs/technical/AGENT_RUNTIME.md`
5. `docs/technical/DATA_MODEL.md`
6. `docs/technical/SECURITY_AND_OPERATIONS.md`
7. `docs/technical/IMPLEMENTATION_PLAN.md`
8. `docs/ai/HANDOFF_PROTOCOL.md`
9. `docs/ai/DECISIONS.md`
10. `docs/ai/CURRENT_STATE.md`
11. `docs/ai/NEXT_STEPS.md`

Consulta `docs/ai/WORKLOG.md` soltanto quando serve ricostruire informazioni storiche.

Il repository reale è sempre la fonte primaria per lo stato effettivo dell'implementazione.

## 2. Ordine di autorità

In caso di conflitto:

1. istruzioni esplicite dell'utente nella sessione corrente;
2. `docs/technical/TECHNICAL_SPECIFICATION.md`;
3. `docs/product/PRODUCT_UX.md`;
4. documenti tecnici specialistici;
5. `docs/ai/DECISIONS.md`;
6. stato reale del repository;
7. `docs/ai/CURRENT_STATE.md`;
8. `docs/ai/NEXT_STEPS.md`;
9. `docs/ai/WORKLOG.md`;
10. `README.md`.

Non modificare silenziosamente requisiti approvati.

## 3. Mandato autonomo

Procedi fino al completamento dell'intero progetto.

Non interrompere il lavoro per chiedere:
- quale libreria usare quando la specifica la rende deducibile;
- quale struttura di file adottare se coerente con l'architettura;
- se passare alla milestone successiva;
- se correggere test, lint o typecheck falliti causati dal tuo lavoro;
- se effettuare refactor locali necessari a rispettare la specifica.

Chiedi all'utente solo quando:
- servono credenziali o accessi che non possono essere generati localmente;
- esiste una contraddizione reale tra requisiti di pari autorità;
- è richiesta una decisione di prodotto non definita;
- è necessaria un'azione esterna irreversibile o potenzialmente costosa non autorizzata;
- un blocker esterno rende impossibile continuare in modo sensato.

Se un'integrazione esterna non è configurabile durante lo sviluppo, implementa adapter, mock/fake e test contract-first; documenta il blocker e continua sulle parti indipendenti.

## 4. Processo operativo

All'avvio di ogni sessione:
1. leggi i documenti;
2. controlla `git status`;
3. verifica `CURRENT_STATE.md` contro il repository;
4. individua la prima attività incompleta;
5. eseguila.

Per ogni unità di lavoro:
1. identifica scope e invarianti;
2. implementa il minimo necessario;
3. aggiungi/aggiorna test;
4. esegui controlli pertinenti;
5. correggi i failure;
6. aggiorna lo stato se è stata raggiunta una milestone;
7. prosegui automaticamente.

## 5. Vincoli

- Non hardcodare secret.
- Non bypassare RLS, authorization o approval gate per far passare test.
- Non rendere un LLM responsabile di transizioni di stato deterministiche.
- Non usare un modello LLM per animazioni, statistiche o calcoli che possono essere deterministici.
- Non caricare intere cronologie nel context degli agenti.
- Non rendere il sistema dipendente da un solo provider AI.
- Non rendere il sistema dipendente dal PC dell'utente.
- Non introdurre auto-deploy del core Bunker Studio in produzione.
- Non eseguire azioni distruttive senza gate.
- Non dichiarare una feature completata senza verifica.

## 6. Qualità

Dopo modifiche significative esegui, quando disponibili:

- formatting;
- lint;
- typecheck;
- unit test;
- integration test;
- build;
- E2E per flussi interessati;
- security checks pertinenti.

Correggi i failure prima di ampliare lo scope.

## 7. Handoff

Segui `docs/ai/HANDOFF_PROTOCOL.md`.

Non lasciare informazioni necessarie alla prosecuzione soltanto nella conversazione.

Se la sessione deve interrompersi per contesto, quota, timeout o errore:
- stabilizza il repository;
- salva checkpoint;
- aggiorna stato e next step;
- documenta l'eventuale session/thread ID utile al resume senza inserire secret;
- termina in stato riprendibile.

## 8. Completion

Il progetto è completato solo quando:
- tutti gli Acceptance Criteria della specifica sono soddisfatti;
- test/build/security checks richiesti passano;
- i flussi critici sono verificati end-to-end;
- la documentazione operativa è aggiornata;
- `CURRENT_STATE.md` contiene `IMPLEMENTAZIONE COMPLETATA`.

Non usare quella stringa prima di tale momento.
