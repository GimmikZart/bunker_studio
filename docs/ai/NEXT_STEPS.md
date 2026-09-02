# Next Steps

## Prossima attivita' precisa - audit M13 Export / Import / Multiuser Foundations

M12 e' completata localmente: il worker locale e' pull-only, autenticato con
credenziale scambiata da token monouso, con heartbeat, lease/reclaim,
capability/scope/concurrency e supporto OpenAI-compatible futuro. Il monitor
mostra gli heartbeat scaduti come offline e Owner/Admin possono revocare un PC
senza cancellare dati o alterare altri tenant. Test mirati, format, lint,
typecheck e build sono verdi. Il test Ollama/LM Studio reale resta non bloccante
per la decisione esplicita di attendere hardware adeguato.

### Area interessata

Export/import versionato e sicuro, remapping degli ID tenant, template vergine,
ruoli Owner/Admin/Member/Viewer, isolamento RLS/API e inviti UI se resta una
lacuna reale rispetto alla specifica.

### Comportamento da verificare

- Verificare che export non contenga secret e che import remappi ogni ID e lasci
  i task importati in DRAFT.
- Verificare che ogni ruolo disponga soltanto delle API/UI previste e che RLS
  protegga il tenant anche fuori dal percorso UI.
- Aggiungere solo test o superfici realmente mancanti, senza modificare
  requisiti gia' approvati.

### Definition of Done locale

AC-012 e AC-014 risultano soddisfatti da evidenza automatizzata locale, oppure
le eventuali lacune vengono implementate e verificate con test tenant-scoped,
format, lint, typecheck, build e controlli Supabase pertinenti. Nessun secret
viene esportato o reso disponibile al browser.
