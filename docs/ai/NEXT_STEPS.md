# Next Steps

## Prossima attivita' precisa - verificare e completare M8 HR + Team Builder

M7 e' completata localmente: brief/constraint legati a un Designer, una-tre
varianti versionate, preview HTML statiche tenant-scoped e sandboxed,
approvazione Owner immutabile e task frontend legato alla versione esatta sono
implementati e verificati. La prima attivita' realmente incompleta e' ora
L'audit ha trovato e corretto la prima lacuna: la pagina Teams ora include il
flusso New Team. Riprendere dai controlli completi e verificare che l'UI sia
coperta da E2E prima di considerare M8 completata.

### Area interessata

`packages/contracts`, persistence staffing/agent, API e UI staffing/agents,
policy di conferma e test E2E.

### Comportamento da verificare

- La proposta di team usa ruolo, modello, costo e capability come input.
- L'utente puo' modificare la proposta prima dell'hire.
- Nessun agente raccomandato e' persistito prima della conferma esplicita.
- La creazione manuale degli agenti resta disponibile.
- Il typecheck web e' stato avviato dopo il nuovo Team Builder; rieseguirlo se
  la sessione termina prima dell'esito, quindi eseguire lint/build/E2E pertinente.

### Definition of Done locale

I requisiti M8 e il relativo DoD risultano coperti senza regressioni; contract,
API/UI/E2E pertinenti, `pnpm verify` e controlli DB passano.

### Verifica successiva

Dopo l'audit M8, procedere automaticamente alla prima lacuna della milestone
successiva. Le prove provider immagine/Figma reali restano adapter esterni non
bloccanti dietro i contratti gia' implementati.
