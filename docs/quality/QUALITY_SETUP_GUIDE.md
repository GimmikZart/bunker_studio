# Guida semplice ai controlli quality

Questa guida serve a chi non lavora normalmente con database, server o token.
Non devi fare nulla con Ollama o LM Studio adesso: il runtime locale e' gia'
predisposto nel codice, ma AC-013 e' stato segnato come PARTIAL (non-blocking)
e verra' verificato quando avrai un computer abbastanza potente.

Restano quattro controlli che richiedono servizi esterni: recupero dal cloud,
riavvio di due worker, GitHub/CI protetto e notifica Web Push su un dispositivo.
Sono controlli di qualita' per una release; non richiedono di cambiare il
codice applicativo.

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
$env:STUDIO_MASTER_KEY = '<random-long-value>'
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
