# Next Steps

## Prossima attivita' precisa — PR GitHub e ingestione CI idempotenti

Completare la parte restante di M6: dopo il push verificato del branch candidato,
il worker deve preparare una pull request GitHub ripetibile senza duplicati e il
control plane deve acquisire lo stato CI come evidenza deterministica.

### Area interessata

`packages/git`, task persistence/UI, `apps/worker`, API completion, verification
runs e migrazioni Supabase.

### Comportamento atteso

- Una operation key stabile per task/branch/base cerca prima una PR esistente;
  retry e restart aggiornano la stessa PR anziche' crearne altre.
- Titolo e body sono deterministicamente derivati dal task e non contengono
  secret; base branch e head SHA devono corrispondere al repository connesso.
- Numero, URL, stato e head SHA della PR vengono persistiti nel task/risultato.
- Check run e stato combinato GitHub vengono normalizzati in evidence CI bounded
  e tenant-scoped; output/log remoti non vengono copiati integralmente.
- CI pending o failure non puo' diventare PASS per testo LLM. Nessun percorso
  effettua merge o deploy automatico.

### Definition of Done locale

Contract/unit/integration test coprono create, lookup/update, retry/restart senza
duplicati, CI pending/pass/fail e assenza di secret leakage. Task UI mostra PR e
CI. Migrazioni da zero, `pnpm verify` e `pnpm test:e2e` passano.

### Verifica successiva

Dopo questa attivita', completare il restante reviewer loop/baseline security di
M6 e passare alla prima milestone successiva realmente incompleta. Le prove con
OpenAI/GitHub reali restano un controllo esterno separato e non bloccano il
lavoro indipendente.
