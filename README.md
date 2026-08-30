# Bunker Studio

Bunker Studio è una suite cloud-first per creare, organizzare e governare team di agenti AI persistenti, specializzati e provider-independent.

L'utente interagisce con una rappresentazione visuale di una vera organizzazione:
Organization → Team → Project → Agent. Gli agenti hanno nome, ruolo, personalità, skill, tool, provider/modello, memoria, permessi, budget e storico. Il lavoro reale viene eseguito da runtime agentici cloud o locali, mentre stato e memoria restano persistenti e indipendenti dal singolo dispositivo.

## Obiettivo della prima release

La prima release deve essere realmente utilizzabile per sviluppare progetti software con un team minimo composto da:

- Lead/Architect;
- Frontend Engineer;
- Backend Engineer;
- Reviewer/QA/Security;
- Product Designer;
- HR Agent.

Il Lead deve poter decomporre il lavoro, parallelizzare in sicurezza Frontend e Backend, richiedere review, reagire ai finding e proseguire senza supervisione continua. L'utente interviene solo nei gate configurati: costi, decisioni di prodotto, sicurezza, design e azioni distruttive/pericolose.

## Documenti da leggere

Ordine obbligatorio:

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

`docs/ai/WORKLOG.md` è storico append-only e va consultato solo quando serve.

## Regola di sviluppo

La specifica è implementation-ready. Le scelte di prodotto elencate sono approvate. L'agente di sviluppo deve procedere autonomamente milestone dopo milestone, verificare il lavoro e aggiornare i file di handoff, senza chiedere conferma per normali decisioni tecniche compatibili con la specifica.
