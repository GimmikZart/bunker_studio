# Guida semplice ai controlli quality

Questa guida serve a chi non lavora normalmente con database, server o token.
Non devi fare nulla con Ollama o LM Studio adesso: il runtime locale e' gia'
predisposto nel codice, ma AC-013 e' stato segnato come PARTIAL (non-blocking)
e verra' verificato quando avrai un computer abbastanza potente.

Restano quattro controlli che richiedono servizi esterni: recupero dal cloud,
riavvio di due worker, GitHub/CI protetto e notifica Web Push su un dispositivo.
Sono controlli di qualita' per una release; non richiedono di cambiare il
codice applicativo.

## Prima di pubblicare: prova locale completa

Questa e' la prova da fare per prima. Il sito e il worker girano sul tuo PC,
Supabase conserva i dati nel cloud e OpenAI viene usato solo quando invii
realmente una chat o esegui un task. Non serve alcun modello installato sul PC.

### 1. Prepara Supabase Cloud

Completa la sezione **A. Crea Supabase nel cloud** piu' sotto e applica le
migrazioni con `supabase db push`. Poi crea `.env.local` nella cartella
principale. Il file e' ignorato da Git e non va mai inviato in chat.

Inserisci questi valori:

~~~text
NODE_ENV=development
BUNKER_PERSISTENCE_MODE=supabase
NEXT_PUBLIC_APP_URL=http://localhost:3000
STUDIO_MASTER_KEY=<chiave generata col comando indicato sotto>
SUPABASE_URL=<Project URL>
SUPABASE_ANON_KEY=<chiave anon>
SUPABASE_SERVICE_ROLE_KEY=<chiave service_role>
DATABASE_URL=<stringa PostgreSQL>
~~~

Genera `STUDIO_MASTER_KEY` una sola volta e conserva sempre lo stesso valore
per questo ambiente:

~~~powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
~~~

Non aggiungere API key o model ID OpenAI nel file. Le vecchie variabili
`AGENT_PROVIDER_*` e `LOCAL_PROVIDER_*` non sono piu' usate: provider, modello,
runtime e reasoning vengono scelti dall'app per ogni singolo agente.

### 2. Avvia il sito sul PC

~~~powershell
cd "C:\Users\gm.115\Desktop\PROGETTI PERSONALI\BUNKER-STUDIO"
pnpm --filter @bunker-studio/web dev
~~~

Apri [http://localhost:3000](http://localhost:3000), registrati, crea
un'organizzazione e un progetto. I dati rimarranno in Supabase anche dopo aver
spento il server locale.

### 3. Collega OpenAI dall'app

1. Apri **Settings**.
2. Nella sezione provider scegli **OpenAI**, scrivi un nome come `OpenAI
   principale` e incolla la API key.
3. Salva. Bunker Studio chiama l'endpoint del catalogo modelli: questa chiamata
   non genera testo e non consuma token di inferenza.
4. La chiave viene cifrata prima di essere salvata e non viene piu' mostrata.
5. Apri **Agents**, scegli prima l'account provider, poi uno dei modelli
   restituiti da OpenAI, il runtime e il livello di reasoning.

Usa **OpenAI API** per chat o inferenze semplici. Usa **Codex SDK** per un
agente che deve modificare un repository. Una chat reale o un task reale usa
token API e quindi puo' avere un costo; il solo recupero del catalogo no.

### 4. Collega un repository GitHub

Nel progetto apri la configurazione repository e inserisci proprietario, nome,
branch predefinito e un fine-grained personal access token GitHub limitato a
quel repository, con permessi di lettura dei contenuti e scrittura dei
contenuti. Bunker Studio verifica subito repository, branch e permesso push;
se la verifica fallisce non segna la connessione come pronta.

### 5. Avvia il worker che lavora sul repository

1. In **Settings -> Local PC worker**, inserisci gli scope repository che il
   worker puo' modificare, per esempio `apps, packages, docs`.
2. Crea il token monouso.
3. Copia nella stessa PowerShell i comandi mostrati dall'app ed eseguili. Il
   worker salva la propria credenziale in `.bunker/worker-identity.json`; ai
   riavvii successivi il token monouso non serve piu'.
4. Lascia aperto il processo worker mentre vuoi far lavorare gli agenti.

Ogni task Codex deve avere un agente assegnato, almeno uno scope di scrittura e
un repository GitHub connesso. Il worker clona un workspace isolato, crea un
branch `bunker/...`, rinnova il lease durante i lavori lunghi, verifica che
nessun file esca dagli scope autorizzati e pubblica soltanto il branch. Non fa
merge e non effettua deploy.

### 6. Prova dal telefono

Sulla stessa rete Wi-Fi puoi aprire `http://<IP-del-PC>:3000`; trova l'IPv4 con
`ipconfig`. Se Windows chiede il permesso firewall, abilita soltanto la rete
privata. Il worker sul PC deve continuare a usare
`WORKER_CONTROL_PLANE_URL=http://localhost:3000`.

Per usare il telefono anche fuori casa, pubblica soltanto il web come descritto
nella sezione C. Il worker resta sul PC e apre connessioni in uscita verso
l'URL HTTPS: non devi pubblicare porte del router e non devi pagare un hosting
separato per il worker. Se il PC e' spento i task restano in coda e ripartono
quando il worker torna online.

## Percorso unico per mettere online Bunker Studio

Se vuoi semplicemente vedere l'app online e provarla con l'API OpenAI, segui
solo i passaggi da A a D. Non servono Ollama, LM Studio o un PC potente.

Il risultato di questo percorso e':

- Supabase Free per account, organizzazioni, progetti, agenti e dati;
- Vercel Hobby per il sito web e le API Next.js;
- OpenAI API per le risposte degli agenti.

Supabase e Vercel hanno un piano gratuito con limiti. L'API OpenAI non e' la
stessa cosa dell'abbonamento ChatGPT e normalmente richiede un credito di
fatturazione; imposta un limite di spesa basso. Inoltre il worker persistente
di Bunker Studio non puo' essere considerato sempre attivo su un hosting
gratuito che sospende i servizi inattivi. Chat, account e dati possono essere
provati online con il web deployment; code, report pianificati e alcuni flussi
asincroni richiedono in seguito un worker sempre attivo.

### A. Crea Supabase nel cloud

1. Apri [Supabase Dashboard](https://supabase.com/dashboard), accedi e premi
   **New project**.
2. Dai un nome, per esempio `bunker-studio-online`, scegli una regione vicina
   a te e crea una password del database. Salva la password in un password
   manager: servirà per la stringa PostgreSQL, non per accedere all'app.
3. Attendi che il progetto sia pronto. Nel progetto apri **Connect** e copia
   il **Project URL**. Deve assomigliare a
   `https://xxxxxxxx.supabase.co`. Non copiare l'indirizzo della dashboard
   `https://supabase.com/dashboard/project/...`.
4. Vai in **Project Settings -> API Keys**. Se compaiono le nuove chiavi,
   apri **Legacy API Keys**: questo codice usa ancora i nomi legacy `anon` e
   `service_role`.
5. Copia la chiave **anon** come `SUPABASE_ANON_KEY`. Copia la chiave
   **service_role** come `SUPABASE_SERVICE_ROLE_KEY`; questa e' privata e non
   deve mai finire nel browser, su GitHub o in chat.
6. Torna in **Connect -> Database -> Connection string**, scegli **URI** e
   **Session pooler** sulla porta `5432`. Sostituisci `[YOUR-PASSWORD]` con la
   password del database. Se la password contiene caratteri come `@`, `#` o
   `/`, va codificata nella URL: e' piu' semplice usare una password composta
   da lettere, numeri e trattini.
7. Trova il **Reference ID** in **Project Settings -> General** oppure nella
   URL della dashboard. E' il valore `QUALITY_PROJECT_REF`.

Ora applica le tabelle e le funzioni di Bunker Studio al progetto cloud. In
PowerShell, dalla cartella del progetto, esegui i comandi uno alla volta:

~~~powershell
cd "C:\Users\gm.115\Desktop\PROGETTI PERSONALI\BUNKER-STUDIO"
$env:QUALITY_PROJECT_REF = '<Reference ID copiato da Supabase>'
supabase login
supabase link --project-ref $env:QUALITY_PROJECT_REF
supabase db push --dry-run
supabase db push
Remove-Item Env:QUALITY_PROJECT_REF
~~~

Quando `supabase login` apre il browser, autorizza la CLI. Prima di `db push`
controlla che il riferimento mostrato sia quello del nuovo progetto cloud.
`--dry-run` mostra cosa verrebbe applicato; `db push` applica le migrazioni
presenti nella cartella `supabase/migrations`. Non creare le tabelle a mano nel
dashboard: il repository deve restare la fonte delle migrazioni.

### B. Prepara OpenAI

1. Apri [OpenAI Platform](https://platform.openai.com), non la sola app
   ChatGPT, e accedi.
2. Crea o seleziona un **Project** per Bunker Studio. Nei progetti OpenAI puoi
   impostare limiti di utilizzo separati.
3. Vai in **API keys**, crea una nuova chiave segreta e copiala subito in un
   password manager. Non metterla in `.env.example`, nel codice, su GitHub o
   nella chat.
4. Non devi copiare a mano un model ID: Bunker Studio recupera automaticamente
   i modelli disponibili per quella API key e li mostra durante la creazione
   dell'agente.
5. Imposta un budget/limite basso nel progetto OpenAI. L'API viene fatturata a
   consumo: un abbonamento ChatGPT non configura automaticamente l'API.

Prima di pubblicare, puoi verificare la chiave direttamente in PowerShell. Il
comando la tiene solo temporaneamente nella sessione e la rimuove alla fine:

~~~powershell
$env:OPENAI_TEST_KEY = Read-Host "Incolla la chiave OpenAI"
$catalog = Invoke-RestMethod -Method Get `
  -Uri 'https://api.openai.com/v1/models' `
  -Headers @{ Authorization = "Bearer $env:OPENAI_TEST_KEY" }
$catalog.data | Select-Object -First 10 -ExpandProperty id
Remove-Item Env:OPENAI_TEST_KEY
~~~

Se vedi una lista di ID, la chiave puo' leggere il catalogo. Questo controllo
non genera testo e non consuma token di inferenza. Il primo messaggio o task
reale verifichera' anche credito e accesso al modello scelto.

### C. Pubblica il web gratuitamente con Vercel

Vercel e' adatto alla parte web di questo repository perche' l'app e' Next.js.
L'hosting gratuito e' pensato per uso personale e include HTTPS automatico.

1. Crea un account su [Vercel](https://vercel.com) e collegalo a GitHub.
2. Premi **Add New -> Project**, seleziona il repository GitHub
   `GimmikZart/bunker_studio` e importa il progetto.
3. In **Root Directory** scegli `apps/web`. Lascia **Framework Preset** su
   Next.js. Se Vercel chiede i comandi, usa `pnpm install --frozen-lockfile`
   per l'installazione e `pnpm build` per la build; lascia l'output predefinito
   di Next.js.
4. Non caricare `.env.prod` su Vercel e non caricarlo su GitHub. Vercel deve
   ricevere i valori dalla schermata **Settings -> Environment Variables**.
5. Aggiungi queste variabili almeno per l'ambiente **Production** (puoi
   selezionare anche Preview per avere anteprime funzionanti):

   - `NODE_ENV`: non aggiungerla manualmente; Vercel la imposta a `production`;
   - `BUNKER_PERSISTENCE_MODE` = `supabase`;
   - `SUPABASE_URL` = Project URL di Supabase;
   - `SUPABASE_ANON_KEY` = chiave anon legacy;
   - `SUPABASE_SERVICE_ROLE_KEY` = chiave service_role legacy;
   - `STUDIO_MASTER_KEY` = la chiave base64url di 32 byte generata con il
     comando indicato sotto. Se Vercel e il test locale usano lo stesso
     database Supabase, devono usare lo stesso valore.

   Genera `STUDIO_MASTER_KEY` localmente cosi':

~~~powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
~~~

   Copia il risultato direttamente nel campo segreto di Vercel. Non usare la
   stessa chiave di un altro ambiente e non salvarla nel repository.

6. Premi **Deploy**. Al termine Vercel mostra un indirizzo simile a
   `https://bunker-studio-qualcosa.vercel.app`. Questo e' l'URL pubblico che
   prima non potevi conoscere.
7. Torna in **Settings -> Environment Variables**, aggiungi o modifica
   `NEXT_PUBLIC_APP_URL` usando quell'indirizzo completo con `https://`, quindi
   vai in **Deployments** e premi **Redeploy**. Se in futuro colleghi un dominio
   personalizzato, sostituisci questo valore con il dominio definitivo e fai un
   altro redeploy.

Il file `.env.prod` non viene caricato automaticamente da Next.js: i nomi
standard locali sono `.env.local` e `.env.production`, mentre in Vercel le
variabili vanno sempre inserite nella dashboard. Inoltre il tuo `.env.prod`
attuale contiene `NODE_ENV=development` e `NEXT_PUBLIC_APP_URL=localhost`,
quindi non va usato cosi' com'e' per la pubblicazione.

`DATABASE_URL` non serve alla pagina web Vercel per il primo test. Serve al
worker pg-boss; aggiungila soltanto al servizio worker quando lo configurerai,
cosi' la stringa PostgreSQL resta esposta al minor numero possibile di servizi.

### D. Prova l'app online dall'inizio alla fine

Apri l'URL Vercel e segui questo ordine:

1. Apri `/signup` e crea un account. Se Supabase richiede la conferma email,
   apri l'email ricevuta e conferma l'account, poi apri `/login`.
2. Apri `/onboarding` e crea un'organizzazione.
3. Apri `/projects` e crea un progetto.
4. Apri `/settings`, aggiungi l'account OpenAI con la sua API key e attendi il
   caricamento automatico del catalogo modelli.
5. Apri `/agents`, scegli un template, l'account provider, il modello, il
   runtime e il reasoning. Crea l'agente.
6. Apri il dettaglio dell'agente, invia un messaggio breve e verifica che arrivi
   una risposta.
7. Torna in `/settings`: devono comparire provider e catalogo, ma non la
   chiave in chiaro.
8. Apri `/api/health`: deve restituire una risposta JSON senza errore.

Se un passaggio fallisce, guarda **Vercel -> Deployments -> ultimo deployment
-> Logs**. In chat invia solo l'URL pubblico e il testo dell'errore dopo aver
oscurato chiavi, password, token e stringhe PostgreSQL. Non inviare mai il
contenuto delle variabili.

### Cosa funziona gratis e cosa no

Il percorso A-D consente di avere online web, autenticazione, database e chat,
ma non rende gratuito l'utilizzo del modello OpenAI. Il piano gratuito di
Supabase puo' inoltre mettere in pausa un progetto inattivo; se l'app sembra
"spenta" dopo molto tempo, controlla il dashboard Supabase.

Per il percorso iniziale non devi pagare un hosting worker: esegui il worker
sul PC e collegalo al web HTTPS con il token monouso creato nelle Settings. Il
worker ospitato e' un'opzione futura se vorrai esecuzione 24/7 anche a PC
spento; non e' un prerequisito per provare il flusso richiesto.

## Regola fondamentale per le password

Non incollare mai in chat, nei commit o nei file del repository:

- password;
- chiavi Supabase service_role;
- token GitHub;
- chiavi VAPID private;
- stringhe complete di connessione al database.

Conserva questi valori in un password manager o nella schermata delle variabili
segrete del servizio che ospita Bunker Studio. Se devi eseguire un comando,
metti il valore solo nella finestra PowerShell locale e rimuovilo al termine.

## 0. Preparazione iniziale

Apri PowerShell nella cartella del progetto:

~~~powershell
cd "C:\Users\gm.115\Desktop\PROGETTI PERSONALI\BUNKER-STUDIO"
node --version
pnpm --version
supabase --version
docker --version
~~~

Se un comando dice che non esiste, non cancellare nulla: annota il nome del
comando mancante. Node.js, pnpm, Supabase CLI e Docker sono gli strumenti
necessari per i controlli locali e quality. Il progetto si puo' comunque
preparare senza un runtime AI locale.

## 1. Creare l'ambiente Supabase quality (AC-001)

Questo e' un ambiente separato da quello locale. Serve per dimostrare che, se
il PC si rompe, i dati restano nel cloud.

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard) e crea un nuovo
   progetto, chiamandolo per esempio bunker-studio-quality.
2. Scegli una password del database e salvala nel password manager. Non
   inviarla in chat.
3. Ora recupera i valori nei punti indicati nella sezione "Dove trovare i
   valori" qui sotto. Ti servono URL del progetto, chiave anon, chiave
   service_role e stringa di connessione PostgreSQL. La chiave service_role e'
   privata.
4. Nel progetto, apri PowerShell e imposta temporaneamente i valori. I nomi
   usati da Bunker Studio sono quelli qui sotto:

~~~powershell
$env:QUALITY_PROJECT_REF = '<project-ref>'
$env:SUPABASE_URL = '<project-url>'
$env:SUPABASE_ANON_KEY = '<anon-key>'
$env:SUPABASE_SERVICE_ROLE_KEY = '<service-role-key>'
$env:DATABASE_URL = '<postgres-connection-string>'
$env:STUDIO_MASTER_KEY = node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
~~~

5. Accedi alla CLI e collega il progetto. Il browser ti chiedera' di
   autorizzare l'accesso:

~~~powershell
supabase login
supabase link --project-ref $env:QUALITY_PROJECT_REF
supabase db push
~~~

supabase db push applica le migrazioni senza usare il database locale. Se
chiede conferma, controlla che il riferimento sia quello quality e non quello
di produzione.

6. Pubblica una istanza quality del web seguendo
   [docs/DEPLOYMENT.md](../DEPLOYMENT.md). Il modo piu' semplice e' usare un
   hosting web separato collegato al repository, con le variabili quality
   impostate come segreti. Non usare variabili di produzione.
7. Apri l'URL quality dal browser e crea un account di prova. Crea una
   organizzazione, un progetto e almeno una task.
8. Apri lo stesso URL da un secondo dispositivo, per esempio il telefono, e
   accedi allo stesso account.
9. Ferma il browser o spegni il PC principale. Dal secondo dispositivo
   verifica che organizzazione, progetto e task siano ancora presenti; crea
   anche una piccola task di prova. Questo e' il test AC-001.
10. Annota: URL quality, data/ora di inizio, data/ora di recupero, dispositivi
    usati e risultato. Non annotare password o chiavi.

### Dove trovare i valori nella dashboard Supabase

Apri il progetto quality nella [Supabase Dashboard](https://supabase.com/dashboard).
I nomi dei menu possono avere piccole differenze grafiche, ma i valori sono
questi:

- QUALITY_PROJECT_REF: guarda l'indirizzo della pagina. Nella parte
  `https://supabase.com/dashboard/project/` troverai il codice finale del
  progetto. In alternativa: menu sinistro **Project Settings** -> **General**
  -> **Reference ID**.
- SUPABASE_URL: premi **Connect** nella barra superiore del progetto e copia
  il **Project URL**. Ha la forma `https://xxxxxxxx.supabase.co`.
- SUPABASE_ANON_KEY: vai in **Project Settings** -> **API Keys**. Se vedi le
  schede nuove, apri **Legacy API Keys** e copia la chiave **anon**. Nel codice
  Bunker Studio questa e' la chiave usata dal web per le richieste utente.
- SUPABASE_SERVICE_ROLE_KEY: nella stessa scheda **Legacy API Keys**, copia la
  chiave **service_role**. Non usare questa chiave nel browser e non inviarla a
  nessuno: il backend la usa per le operazioni del worker.
- DATABASE_URL: premi **Connect** -> **Database** -> **Connection string** e
  scegli **URI**. Per un worker persistente scegli **Session pooler** (porta
  5432), soprattutto se la tua rete non supporta IPv6. Se la connessione
  diretta funziona, va bene anche **Direct connection**. Quando il testo mostra
  `[YOUR-PASSWORD]`, sostituiscilo con la password scelta creando il progetto;
  se la password contiene caratteri speciali, usa la versione URL-encoded.
- STUDIO_MASTER_KEY: non viene da Supabase. Generala tu nella PowerShell con
  il comando seguente e salvala nei segreti dell'hosting quality:

~~~powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
~~~

Il comando stampa una stringa casuale: copiala subito nella variabile
STUDIO_MASTER_KEY e non nel repository. Le indicazioni ufficiali Supabase per
API URL/chiavi sono nella [guida API keys](https://supabase.com/docs/guides/getting-started/api-keys);
quelle per la stringa PostgreSQL nella [guida di connessione al database](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Eseguire il test di riavvio pg-boss (AC-006)

Serve una stringa PostgreSQL dell'ambiente quality. Il test crea una coda
temporanea, fa partire due processi separati e verifica che il secondo riprenda
un job lasciato dal primo.

Nella stessa finestra PowerShell in cui hai la stringa disponibile:

~~~powershell
$env:BUNKER_PG_BOSS_DATABASE_URL = '<quality-postgres-connection-string>'
pnpm quality:pg-boss-restart
Remove-Item Env:BUNKER_PG_BOSS_DATABASE_URL
~~~

Il risultato corretto contiene pg_boss_restart_smoke e status: PASS. Nel
worklog va registrato solo quel risultato, eliminando ogni eventuale URL o
credenziale stampata accidentalmente. Il comando completo e' descritto anche
in [PG_BOSS_RESTART_SMOKE.md](PG_BOSS_RESTART_SMOKE.md).

## 3. Verificare il flusso GitHub/CI protetto (AC-009)

Usa un repository GitHub di prova, non il repository principale e non un
repository con dati importanti.

1. Crea un repository privato vuoto per la quality.
2. Crea un [fine-grained personal access token GitHub](https://github.com/settings/personal-access-tokens)
   limitato a quel solo repository. Concedi soltanto i permessi necessari:
   Metadata Read, Contents Read and write, Checks Read e Pull requests Read
   and write.
3. Imposta GITHUB_API_TOKEN solo nei segreti server/worker dell'ambiente
   quality. Non metterlo nel browser, in .env.example o nel repository.
4. Nel flusso Studio Labs quality inizializza il progetto protetto, esegui
   l'analisi e seleziona una proposta. Verifica che vengano creati task e
   richiesta di approvazione Owner.
5. Prova anche a saltare un gate: senza reviewer, check CI, Owner o attore
   umano la richiesta deve essere rifiutata. Non disattivare il gate per far
   passare il test.
6. Con tutti i requisiti presenti, verifica il ramo isolato, il check CI e la
   pull request nel repository di prova. Registra l'esito e l'identificativo
   non sensibile della PR.

La chiave resta server-only. Se il repository quality non ha una pipeline CI,
crea una GitHub Action minima che esegua lint/test; non usare un check simulato
come prova finale.

## 4. Verificare le notifiche Web Push (AC-011)

Servono un dominio o URL quality raggiungibile dal browser e un dispositivo
reale con notifiche abilitate.

1. Nella cartella del progetto genera una coppia VAPID. Il pacchetto e' una
   dipendenza del workspace ma non espone un comando pnpm; usa quindi questo
   comando Node che stampa le due chiavi solo nella tua finestra locale:

~~~powershell
pnpm --filter @bunker-studio/notifications exec node --input-type=module -e "import webpush from 'web-push'; console.log(JSON.stringify(webpush.generateVAPIDKeys(), null, 2));"
~~~

2. Conserva la chiave privata nel password manager. Configura nell'ambiente
   quality WEB_PUSH_VAPID_SUBJECT (un URL https://... oppure mailto:...),
   WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY e, soltanto come
   valore pubblico per il browser, NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY.
3. Dal telefono apri l'URL quality, accedi, abilita le notifiche e accetta la
   richiesta del browser.
4. In Settings attiva almeno una categoria di notifica e genera un evento
   controllato, per esempio una richiesta di approvazione.
5. Verifica che la notifica arrivi mentre l'app e' in background. Tocca la
   notifica e verifica che apra il deep link corretto.
6. Disattiva la categoria e ripeti: la notifica non deve piu' arrivare.
   Registra browser, sistema operativo, orari e risultato; non registrare
   chiavi.

## 5. Backup e restore

Dopo AC-001, esegui il drill in
[BACKUP_RESTORE_DRILL.md](BACKUP_RESTORE_DRILL.md): snapshot/PITR, export
applicativo senza segreti, restore in un progetto quality pulito, migrazioni,
E2E e import con ID rimappati. Annota soltanto revisione migrazioni, risultato,
RPO e RTO. Non usare il progetto production.

## Cosa comunicare quando hai finito

Non servono password o token. E' sufficiente comunicare:

- l'URL quality, se esiste;
- quali dei quattro controlli hai eseguito;
- per ciascuno, PASS o FAIL e il messaggio finale del comando;
- per AC-001 e backup/restore, RPO/RTO e tipo di dispositivo;
- eventuali errori senza incollare valori segreti.

A quel punto gli esiti possono essere registrati nella matrice acceptance e nel
worklog. Finche' i quattro controlli e il backup/restore non sono completati,
CURRENT_STATE.md non deve contenere IMPLEMENTAZIONE COMPLETATA. Il runtime
locale resta invece rinviato e non blocca questi passaggi.
