# Next Steps

## Prossima attivita' precisa - audit M12 Local Worker

M11 e' completata localmente: ledger, policy, forecast, report scheduler,
inbox/read state, deep link e Web Push adapter sono presenti. Il claim worker
rivaluta atomicamente il budget prima della consegna del contesto provider; test
API/core/worker, E2E, build e reset/lint Supabase sono verdi.

### Area interessata

Installazione e lifecycle del worker locale, registration/credential renewal,
lease/retry/resume, capability/write scope, monitoring UI e flusso cloud-to-PC.

### Comportamento da verificare

- Verificare il percorso di setup per un utente non tecnico e la persistenza
  sicura dell'identita' worker.
- Verificare che claim, heartbeat, lease renewal, retry/quota e resume non
  richiedano segreti nel browser e non eseguano scope non autorizzati.
- Verificare il monitoraggio da web/mobile e aggiungere esclusivamente lacune
  reali con test API/worker/browser.

### Definition of Done locale

Il DoD M12 e' coperto senza regressioni. Un PC locale resta un worker opzionale,
non un requisito per usare il control plane; la prova con repository GitHub e
provider reali resta esterna, protetta e non deve eseguire push o chiamate a
pagamento automaticamente.
