# Next Steps

## Prossima attivita' precisa - audit M11 Cost, Budget & Reporting

M10 e' completata localmente: il retrieval context resta bounded, la ricerca
dell'archivio e' separata dal context degli agenti e l'utente puo' gestire
memorie strutturate per organizzazione. API, typecheck ed E2E browser del
salvataggio/ricerca sono verdi.

### Area interessata

Cost ledger, budget policies, preflight gate, forecast/report deterministici,
quota UI, notifiche e persistenza/generazione del report settimanale.

### Comportamento da verificare

- Verificare che un hard cap impedisca davvero l'invocazione del provider.
- Verificare ledger tenant-scoped, forecast e report deterministici.
- Verificare la UI budget/costi, inbox notifiche e deep link approval.
- Aggiungere soltanto le lacune reali, con test API e browser pertinenti.

### Definition of Done locale

Il DoD M11 e' coperto senza regressioni: budget hard-cap, report e notifiche
sono verificati da contract/API/UI/E2E dove applicabile; i controlli di qualita'
pertinenti passano. Le notifiche push reali restano una verifica esterna quando
saranno configurate VAPID e un browser/device.
