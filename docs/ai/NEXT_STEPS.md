# Next Steps

## Prossima attivita' precisa — verifica deterministica del branch candidato

Completare la parte restante di M5 prima di ampliare altre milestone: il worker
deve eseguire un piano di verifica dichiarato dal task dopo il run Codex e
prima di considerare l'implementazione pronta.

### Area interessata

`packages/contracts`, task persistence/UI, `apps/worker`, API completion,
verification runs e migrazioni Supabase.

### Comportamento atteso

- Il task contiene comandi di verifica espliciti e bounded (per esempio lint,
  typecheck e test), non inventati dal modello durante l'esecuzione.
- Il worker esegue i comandi nel workspace candidato con timeout, limite di
  output, ambiente sanitizzato e senza shell interpolation.
- Comando, exit code, durata e stato vengono persistiti come verification
  evidence; secret e output sensibile non vengono salvati.
- Un check fallito impedisce lo stato `IMPLEMENTED` e segue il retry/escalation
  deterministico esistente.
- Il resoconto dell'LLM resta informativo e non puo' trasformare un check
  fallito in PASS.

### Definition of Done locale

Unit e integration test coprono PASS, failure, timeout, restart/lease renewal e
assenza di secret leakage. Task UI mostra l'esito dei check. Migrazioni da zero,
`pnpm verify` e `pnpm test:e2e` passano.

### Verifica successiva

Dopo questa attivita', implementare la preparazione GitHub PR/CI idempotente di
M6. Le prove con OpenAI/GitHub reali restano un controllo esterno separato e
non bloccano il lavoro indipendente.
