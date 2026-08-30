# AI Handoff Protocol — Bunker Studio

Questo protocollo garantisce continuità fra sessioni, modelli, provider e agenti di sviluppo.

## Principio

Un nuovo agente deve poter continuare usando repository + documentazione, senza dipendere dalla chat precedente.

## Avvio sessione

Prima di scrivere codice:
1. leggere i documenti indicati in `AGENTS.md`;
2. controllare `git status`;
3. confrontare stato documentato e repository;
4. identificare la prima attività incompleta;
5. verificare eventuali branch/worktree o run interrotti prima di crearne di nuovi.

## Checkpoint

Creare un checkpoint logico quando si verifica almeno una condizione:
- completamento di una milestone;
- cambiamento persistente di architettura;
- completamento di una feature vertical slice;
- failure esterno che obbliga a interrompere;
- contesto/sessione molto lunga;
- rischio di quota/rate limit imminente quando rilevabile.

Un checkpoint deve lasciare:
- codice comprensibile e, se possibile, testabile;
- stato Git noto;
- `CURRENT_STATE.md` aggiornato;
- una sola prossima attività prioritaria in `NEXT_STEPS.md`;
- decisioni persistenti in `DECISIONS.md`;
- voce in `WORKLOG.md` per sessioni significative.

## CURRENT_STATE.md

Deve contenere solo stato attuale:
- fase;
- completato e verificato;
- in corso;
- ultimo risultato build/test;
- blocker;
- eventuale session/thread/run riprendibile, senza secret;
- data aggiornamento.

Non è uno storico.

## NEXT_STEPS.md

Deve contenere una sola attività prioritaria principale con:
- obiettivo;
- area interessata;
- comportamento atteso;
- Definition of Done locale;
- verifica.

Se l'attività ha dipendenze non disponibili, indicare esplicitamente il miglior task indipendente alternativo.

## DECISIONS.md

Contiene solo decisioni persistenti.
Formato:

### DEC-XXX — Titolo
**Status:** Accepted | Superseded
**Decisione:** ...
**Motivazione:** ...
**Conseguenze:** ...

Le decisioni sostituite non vanno eliminate.

## WORKLOG.md

Append-only. Ogni voce significativa include:
- data/sessione;
- lavoro svolto;
- file principali;
- verifiche;
- problemi;
- stato finale.

## Interruzione per quota/rate limit

Se l'agente di sviluppo che sta costruendo Bunker Studio viene interrotto da quota:
1. non presumere che il client riprenderà da solo;
2. salvare il massimo stato possibile nel repository;
3. registrare session/thread ID se disponibile e non sensibile;
4. marcare `SESSIONE INTERROTTA - RIPRENDERE DA NEXT_STEPS.md`.

Nota: Bunker Studio, una volta implementato, avrà un proprio meccanismo durable di `WAITING_PROVIDER_QUOTA` e resume automatico. Questo protocollo serve invece durante la costruzione iniziale del prodotto.

## Fine progetto

Solo dopo tutte le verifiche:
- `CURRENT_STATE.md` → `IMPLEMENTAZIONE COMPLETATA`;
- `NEXT_STEPS.md` → nessuna attività necessaria in scope;
- ultima voce di `WORKLOG.md` con test/build/security finali.
