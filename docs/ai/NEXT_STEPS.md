# Next Steps

## Prossima attività precisa — completare il runtime Designer con preview artifact

Completare M7 oltre alla slice di approvazione già esistente: un agente Designer
deve trasformare un brief in una proposta versionata con 1–3 varianti bounded,
structured design spec, rationale, stati principali e almeno un preview artifact
sicuro (prototipo HTML statico e/o immagine). Il contenuto approvato deve restare
immutabile e referenziabile dal task frontend.

### Area interessata

`packages/contracts`, `packages/agent-runtime` / orchestration, persistence
design/artifact, API e UI `/designs`, storage adapter e test E2E.

### Comportamento atteso

- Il contratto Designer distingue brief/constraint, variante, spec strutturata,
  rationale, states e preview artifact; nessun output libero LLM decide lo stato.
- Artefatti HTML sono sanitizzati, bounded, tenant-scoped e serviti come preview
  senza eseguire script; l'adapter immagine è facoltativo e fake/contract-first.
- Submit/Reject/Changes crea nuove versioni senza mutare una versione APPROVED.
- Il task frontend conserva il riferimento esatto a una versione APPROVED;
  nessun task gated può partire senza quel riferimento.

### Definition of Done locale

Test unit/contract coprono varianti 1–3, sanitizzazione/bound dei preview,
immutabilità e policy Owner. API/UI/E2E coprono brief → preview → approvazione →
task frontend con ref esatto. `pnpm verify`, `pnpm test:e2e`, reset/lint Supabase
passano.

### Verifica successiva

Dopo M7, audit M8 (HR + Team Builder) per la prima parte realmente mancante.
Le prove provider immagine/Figma reali restano adapter esterni non bloccanti.
