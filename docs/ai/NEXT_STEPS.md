# Next Steps

## Prossima attivita' precisa - audit finale Definition of Done

M13 e' completata localmente: export/import e template vergine sono versionati,
testati e disponibili in Settings. L'export e' solo Owner, non contiene
credenziali, e import crea un nuovo tenant con ID e relazioni rimappati; provider
richiedono nuova autenticazione. I quattro ruoli sono supportati da schema/RLS e
API, con gestione collaboratori Owner-only e trigger che preserva l'Owner.

### Area interessata

Confronto requisito per requisito tra specifica, matrice acceptance, repository,
test e documentazione di deployment/quality. Chiudere le lacune indipendenti e
distinguere con precisione le verifiche esterne ancora impossibili senza
credenziali, quality database o device.

### Comportamento da verificare

- Verificare tutti gli FR V1, AC-001..014 e i check della Definition of Done.
- Eseguire `pnpm verify`, quality/security check disponibili e controlli
  Supabase pertinenti; correggere automaticamente i failure locali.
- Documentare unicamente i blocker esterni reali con procedure riproducibili,
  senza dichiarare `IMPLEMENTAZIONE COMPLETATA` finche' i blocker bloccanti non
  sono verificati.

### Definition of Done locale

Ogni requisito che non dipende da un servizio/dispositivo esterno e' verificato
con evidenza automatizzata. Le verifiche esterne necessarie per AC-001, AC-006,
AC-009 e AC-011 sono descritte con un runbook, senza secret e senza azioni a
costo o deploy automatici.
