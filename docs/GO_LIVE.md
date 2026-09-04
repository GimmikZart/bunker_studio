# Bunker Studio — Collegamenti da fornire

Questo documento elenca tutto ciò che resta da collegare per rendere Bunker
Studio operativo. Il codice è completo: ogni voce qui sotto è una credenziale o
un dispositivo che non può essere generato dal repository.

Nessun segreto va committato. Le chiavi provider **non** sono variabili
d'ambiente: si inseriscono dall'app e vengono cifrate con AES-256-GCM prima di
essere salvate.

Questo e' l'indice: cosa collegare, in che ordine e cosa sblocca. La procedura
passo-passo con gli screenshot delle dashboard e' in
[`docs/quality/QUALITY_SETUP_GUIDE.md`](quality/QUALITY_SETUP_GUIDE.md).

**C'e' un solo file `.env`, nella radice del repository**, accanto a
`.env.example`. Lo leggono sia l'app web sia il worker: non serve un secondo
file dentro `apps/web` o `apps/worker`. Le variabili d'ambiente vere (shell o
piattaforma di hosting) hanno sempre la precedenza su quel file.

---

## Ordine consigliato

1. Supabase (senza questo l'app resta in memoria e non conserva nulla)
2. Provider AI (OpenAI e/o Anthropic)
3. Worker sul PC (solo se vuoi far scrivere codice)
4. Repository GitHub (solo per far aprire le Pull Request)
5. Notifiche push (opzionale)

Puoi fermarti a qualunque punto: le funzioni successive restano disabilitate,
le precedenti continuano a funzionare.

---

## 1. Supabase — memoria permanente

Senza Supabase l'app parte in modalità memoria: tutto sparisce al riavvio.

**Cosa serve:** un progetto su [supabase.com](https://supabase.com) (il piano
gratuito basta per iniziare).

**Cosa mettere in `.env`:**

```
BUNKER_PERSISTENCE_MODE=supabase
SUPABASE_URL=https://<progetto>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
STUDIO_MASTER_KEY=<generata, vedi sotto>
```

`STUDIO_MASTER_KEY` cifra le credenziali provider e repository nel database.
Generala una volta e conservala: **se la perdi, le credenziali salvate non sono
più decifrabili.**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Poi applica lo schema:

```bash
supabase link --project-ref <ref>
supabase db push
```

**Come sai che funziona:** apri `/api/health`, crea un'organizzazione, riavvia
l'app e verifica che ci sia ancora.

**Cosa sblocca:** persistenza reale, AC-001 (perdita PC), accesso da un secondo
dispositivo.

---

## 2. Provider AI — far parlare e ragionare gli agenti

**Cosa serve:** una API key di [OpenAI](https://platform.openai.com/api-keys)
o [Anthropic](https://console.anthropic.com/), oppure un endpoint
OpenAI-compatible (per esempio Ollama o LM Studio in locale).

**Prima di tutto serve `STUDIO_MASTER_KEY`**, anche in locale: e' la chiave con
cui la tua API key viene cifrata prima di essere salvata. Senza, la connessione
viene rifiutata e Settings te lo dice apertamente.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Mettila in `.env` come `STUDIO_MASTER_KEY` e riavvia.

**Dove si inserisce la API key:** nell'app, in **Settings → Providers**. Non nel
file `.env`. La chiave viene cifrata prima di toccare il database e non compare
mai in export, log, errori o evidence.

Senza Supabase la connessione vive nella memoria del processo: funziona subito
per provare lo studio, ma sparisce al riavvio. Con Supabase configurato e'
permanente.

Dopo aver aggiunto il provider, assegna a **ogni agente** un provider, un
modello e un livello di ragionamento da **Agents**. Questa scelta è per agente,
non globale: un agente può usare Anthropic e un altro OpenAI.

**Suggerimento di costo:** modello potente solo al Lead e al Reviewer, modello
economico a Frontend e Backend.

**Cosa sblocca:** chat diretta con gli agenti, pianificazione del Lead,
riunioni con contributi veri, Designer collegato al provider.

**Prima di spendere davvero:** vai in **Cost Center** e imposta un tetto di
budget con azione `BLOCK`. Il blocco scatta nel database prima che le
credenziali vengano consegnate, quindi la chiamata a pagamento non parte.

---

## 3. Worker sul PC — far scrivere codice

Il worker gira sul tuo computer, fa solo connessioni in uscita e non apre porte.

**Passi:**

1. Nell'app, **Settings → Workers**, genera un token di registrazione (è
   monouso e scade).
2. Nello stesso `.env` nella radice del repository, insieme al resto:

```
WORKER_CONTROL_PLANE_URL=https://<url-della-tua-app>
WORKER_REGISTRATION_TOKEN=<token appena generato>
WORKER_CAPABILITIES=chat,repository,codex
```

3. Avvia il worker, da qualunque cartella del repository:

```bash
pnpm --filter @bunker-studio/worker dev
```

Se il worker gira su un computer diverso da quello che ospita l'app, il `.env`
va nella radice del repository **su quella macchina**, e
`WORKER_CONTROL_PLANE_URL` deve puntare all'indirizzo pubblico dell'app.

Alla prima connessione il worker scambia il token con una credenziale
permanente salvata in `WORKER_IDENTITY_FILE` con permessi ristretti. Il token
iniziale non serve più.

**Come sai che funziona:** in Settings il worker risulta online e il battito è
recente. Se sparisce per tre intervalli viene mostrato offline e il lavoro
torna assegnabile.

**Se vuoi revocarlo:** Owner o Admin possono revocarlo da Settings; i nuovi
claim vengono rifiutati subito.

---

## 4. GitHub — far aprire le Pull Request

**Cosa serve:** un *fine-grained personal access token* con accesso al solo
repository di destinazione.

**Dove si crea:** nelle impostazioni del tuo **account** GitHub, non nella
pagina del repository — e' li' che quasi tutti lo cercano invano.

Link diretto: <https://github.com/settings/personal-access-tokens/new>

Oppure a mano: foto profilo in alto a destra → **Settings** → **Developer
settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate
new token**.

Poi:

1. **Resource owner**: l'account o l'organizzazione che possiede il repository.
2. **Repository access**: *Only select repositories*, e scegli quello.
3. **Repository permissions**: `Contents` → *Read and write* e `Pull requests` →
   *Read and write*. Nient'altro.
4. **Expiration**: scegli una scadenza e segnatela; quando scade la connessione
   smette di funzionare e va rifatta.

Copia il token quando compare: GitHub non lo mostra una seconda volta.

**Dove si inserisce:** nell'app, in **Projects → Repository**. Viene cifrato
come le credenziali provider.

**Prima di collegarlo, proteggi il branch di destinazione** su GitHub:
richiedi il passaggio della CI e almeno una review. Bunker Studio non fa mai
merge da solo, ma la protezione del branch è la tua rete di sicurezza.

**Come sai che funziona:** crea un task di tipo repository con uno scope di
scrittura esplicito. Se le verifiche passano, trovi branch `bunker/<task-id>`,
la PR aperta e lo stato CI nella scheda del task.

**Attenzione:** questo è il primo punto in cui viene modificato un repository
reale. Prova su un repository di test.

---

## 5. Notifiche push — opzionale

**Cosa serve:** una coppia di chiavi VAPID.

```bash
npx web-push generate-vapid-keys
```

**Cosa mettere in `.env`:**

```
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:tua@email
```

Serve HTTPS e un browser che supporti le push. Le notifiche in-app funzionano
già senza questo passaggio.

---

## Verifiche che restano tue

Queste quattro verifiche non sono state eseguite: richiedono le tue credenziali
o un dispositivo reale. La procedura riproducibile per ciascuna e' in
[`docs/quality/QUALITY_SETUP_GUIDE.md`](quality/QUALITY_SETUP_GUIDE.md), e lo
stato aggiornato in
[`docs/quality/ACCEPTANCE_MATRIX.md`](quality/ACCEPTANCE_MATRIX.md).

| Verifica | Serve |
|---|---|
| AC-001 recupero da un secondo dispositivo | Supabase |
| AC-006 ripresa dopo quota / riavvio | database di quality |
| AC-009 giro GitHub + CI completo | token GitHub e repository |
| AC-011 consegna push su device | chiavi VAPID e un telefono |

Finché non sono verificate, `docs/ai/CURRENT_STATE.md` non deve dichiarare
`IMPLEMENTAZIONE COMPLETATA`.
