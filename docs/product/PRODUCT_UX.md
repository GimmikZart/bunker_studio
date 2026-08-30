# Bunker Studio — Product & UX Specification

**Stato:** Approved  
**Versione:** 1.0  
**Data:** 2026-08-30

## 1. Posizionamento

Bunker Studio è un workspace professionale per governare una "azienda virtuale" di agenti AI. La metafora dell'ufficio deve rendere il sistema più intuitivo, umano e piacevole senza trasformarlo in un gioco.

Stile iniziale: **elegante SaaS moderno**.

## 2. Information architecture

Gerarchia obbligatoria:

`Organization → Team → Project`

Gli Agent appartengono a una Organization e possono essere assegnati a uno o più Team/Project secondo policy.

Navigazione primaria desktop:
- Office;
- Projects;
- Teams;
- Agents;
- Approvals;
- Meetings;
- Costs;
- Activity;
- Settings.

Su mobile usare bottom navigation/riduzione coerente, senza rimuovere funzionalità critiche.

## 3. Home / Office

La home di una Organization è una vista ufficio 2D professionale.

Requisiti:
- layout tipo open office con aree logiche: Lead, Development, Design, Review/QA, Meeting Room, Idle;
- avatar umani illustrati, inizialmente statici;
- nome, ruolo e status sintetico;
- stato visuale derivato da `agent_presence`;
- movimento/trasferimento fra aree animato lato client;
- nessuna chiamata LLM per animazioni;
- click su agente apre Agent Detail;
- click su Meeting Room apre meeting attivi/recenti;
- click su area mostra agenti e task pertinenti;
- office deve degradare bene su mobile in una vista compatta a sezioni.

Stati visuali minimi:
`IDLE`, `PLANNING`, `DESIGNING`, `CODING`, `TESTING`, `REVIEWING`, `MEETING`, `WAITING_APPROVAL`, `WAITING_QUOTA`, `BLOCKED`, `OFFLINE`.

## 4. Agent Detail

Ogni agente deve avere:
- avatar;
- nome modificabile;
- ruolo;
- job title;
- personalità;
- bio operativa;
- provider;
- model;
- reasoning/effort;
- runtime;
- skill;
- tool;
- permissions;
- team/project assignment;
- autonomia;
- budget;
- stato corrente;
- task corrente;
- timeline personale;
- conversazioni;
- memory view;
- decisions collegate;
- performance metrics;
- costo cumulativo e recente.

Tab:
`Chat | Work | Memory | Skills & Tools | Permissions | Performance | Costs | Activity`.

L'utente può parlare direttamente con qualsiasi agente. Nessuna chat individuale deve bypassare approval policy o permessi.

## 5. Lead interaction

Il Lead è il principale punto di contatto umano.

La chat Lead deve poter:
- avviare un progetto;
- spiegare stato e piano;
- ricevere cambi requisiti;
- proporre decisioni;
- mostrare blocchi;
- creare/assegnare task;
- convocare meeting;
- richiedere approvazioni;
- presentare release candidate.

La UI deve distinguere messaggi conversazionali da:
- decision cards;
- approval cards;
- task cards;
- design cards;
- budget alerts;
- security alerts.

## 6. HR Agent

L'HR Agent è un agente specializzato che aiuta a costruire team.

Flusso `New Team`:
1. utente definisce obiettivo/progetto/budget;
2. HR analizza requisiti;
3. propone una composizione con ruoli, modelli, reasoning, tool/skill, costo stimato e motivazione;
4. utente può modificare, rimuovere o aggiungere agenti;
5. assunzione avviene solo dopo conferma esplicita.

Deve esistere anche `Create Agent Manually`.

## 7. Create/Edit Agent

Campi:
- name;
- avatar;
- role template;
- title;
- personality;
- communication style;
- provider;
- model;
- reasoning effort;
- runtime;
- skills;
- tools;
- project/team scope;
- permissions;
- default autonomy;
- budget limits;
- escalation target.

L'identità non cambia quando provider/model cambiano.

## 8. Product Designer workflow

Il Designer opera come un vero Product Designer.

Flusso:
1. riceve Product Brief + constraints;
2. produce 1–3 proposte a seconda della complessità;
3. ogni proposta include mockup visuale, design rationale, states principali e structured design spec;
4. utente può `Approve`, `Reject`, `Request changes`;
5. iterazioni mantengono versioni;
6. solo una versione `APPROVED` diventa handoff ufficiale;
7. Lead crea task frontend con riferimento immutabile alla versione approvata.

Gate obbligatorio per:
- nuova screen principale;
- nuovo user flow;
- redesign sostanziale;
- design system change.

Micro-fix coerenti con design system possono non richiedere nuovo gate.

In v1 il mockup può essere:
- immagine generata;
- static HTML prototype;
- entrambi.

Figma integration è un adapter successivo, non requisito per il primo end-to-end.

## 9. Meeting Room

Meeting professionale, non roleplay.

Ogni meeting contiene:
- titolo;
- agenda;
- owner/convener;
- partecipanti;
- progetto;
- documenti/context selezionati;
- transcript;
- decisioni;
- action items;
- task generati;
- costo del meeting.

Default cost policy:
- massimo 2 round di contributi per partecipante;
- terzo round solo se il Lead dichiara unresolved conflict;
- contributi paralleli quando indipendenti;
- ogni partecipante riceve agenda + context scoped + summary dei contributi precedenti, non necessariamente transcript completo.

Meeting types:
- Architecture;
- Planning;
- Design Review;
- Code Review;
- Incident;
- Retrospective;
- Custom.

Alla chiusura il Lead produce minutes strutturati. Task/decisioni vengono create solo dopo validazione del control plane.

## 10. Approvals Inbox

Schermata prioritaria, mobile-first.

Categorie:
- Cost;
- Product;
- Design;
- Security;
- Destructive Action;
- Production;
- Access/Permission.

Ogni approval mostra:
- chi richiede;
- perché;
- impatto;
- costo/rischio;
- alternative;
- cosa succede con Approve/Reject;
- scadenza opzionale.

Push notification per approval critiche.

## 11. Cost Center

Vista:
- today;
- current week;
- current month;
- by organization/team/project/agent/provider/model/task;
- forecast mensile;
- budget residuo;
- quota/provider status;
- top cost drivers.

Deve permettere policy:
- hard cap;
- soft warning;
- per-run cap;
- per-task cap;
- daily/monthly cap;
- escalation thresholds;
- provider fallback consent.

Report periodici:
- settimanale default;
- configurabile;
- nessun LLM necessario per i numeri;
- eventuale summary narrativo generato solo se abilitato.

## 12. Activity / Timeline

Non è la home principale.

Timeline globale filtrabile per:
- agent;
- team;
- project;
- event type;
- severity.

Eventi leggibili, es:
`09:14 Maya started TASK-124`
`09:37 Backend API completed`
`09:42 Ethan found 2 review issues`
`09:45 Alex assigned fix`

L'Agent Detail include timeline filtrata dell'agente.

## 13. Memory UX

La memoria deve essere trasparente.

Categorie:
- Working context;
- Project knowledge;
- Decisions;
- Lessons learned;
- Conversation archive;
- Pinned memories.

L'utente deve poter:
- cercare;
- vedere origine/provenance;
- correggere;
- eliminare una memory;
- pin/unpin;
- vedere quando è stata usata in un run quando tecnicamente tracciabile.

Raw history non è automaticamente "memory".

## 14. Provider & Local Workers

Settings → Providers:
- OpenAI;
- Anthropic;
- OpenAI-compatible;
- Ollama;
- LM Studio;
- altri futuri adapter.

Mostrare stato connessione e catalogo modelli/capabilities.

Settings → Workers:
- cloud worker;
- local worker registrati;
- online/offline;
- capabilities;
- modelli locali;
- ultime heartbeat;
- task attivo.

## 15. Autonomy modes

`MANUAL`
- ogni task e azione scrivente richiede approvazione.

`SUPERVISED`
- agenti lavorano e testano;
- merge, design, costi rilevanti e azioni esterne richiedono approval.

`AUTONOMOUS` — default
- planning, implementation, test, review, fix e merge su branch/dev consentiti entro policy;
- approval obbligatoria per costi oltre soglia, product decisions, design gate, security critical, destructive actions, produzione.

`LAB`
- autonomia ampia entro un hard budget e sandbox;
- production e secret/permission escalation restano proibiti senza owner.

## 16. Gamification professionale

Consentita solo se derivata deterministicamente dai dati.

Metriche iniziali:
- tasks completed;
- first-review pass rate;
- reopen rate;
- average task cost;
- median cycle time;
- test pass rate;
- review finding rate.

Non implementare:
- XP generata da LLM;
- bonus arbitrari;
- ranking che incentiva a saltare controlli;
- automatic permission escalation basata sul punteggio.

## 17. Responsive & PWA

Funzioni critiche disponibili da mobile:
- Office compact;
- chat;
- approvals;
- cost alerts;
- agent status;
- task state;
- meetings;
- notifications;
- provider/quota state.

PWA installabile e push notifications abilitate quando il browser lo supporta.

## 18. Future desktop

Dopo v1:
- wrapper Tauri;
- stessa API e stessa persistenza cloud;
- desktop app non diventa system of record.
