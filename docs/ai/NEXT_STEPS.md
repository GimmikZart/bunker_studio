# Next Steps

## Prossima attivita' precisa - audit M10 Memory & Search

M9 e' completata localmente: la stanza meeting permette di creare e avviare
riunioni scoped con progetto, agenda, partecipanti e round bounded; mostra
contributi, minuti, decisioni, azioni e costo. Il prossimo audit e' M10.

### Area interessata

conversation archive, structured memory, retrieval/context builder, UI/API e provenance.

### Comportamento da verificare

- Verificare ricerca full-text, memorie strutturate, provenance e gestione utente.
- Verificare che il context builder resti bounded e non inietti l'intero archivio.
- Aggiungere solo le lacune reali e testarle end-to-end.

### Definition of Done locale

Il DoD M10 e' coperto senza regressioni; contract, API/UI/E2E pertinenti e
controlli di qualita' passano.

### Verifica successiva

Dopo l'audit M8, procedere automaticamente alla prima lacuna della milestone
successiva. Le prove provider immagine/Figma reali restano adapter esterni non
bloccanti dietro i contratti gia' implementati.
