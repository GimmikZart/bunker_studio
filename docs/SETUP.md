# Bunker Studio — Setup locale

## Prerequisiti

- Node.js 24 LTS (Node 22 è compatibile per lo sviluppo locale attuale).
- Corepack con pnpm 10.
- Docker Desktop per Supabase locale.

## Installazione e verifica

```bash
corepack enable
pnpm install
pnpm verify
```

`pnpm verify` esegue formatter check, lint, typecheck, test unitari, build e audit dipendenze.

## Avvio

```bash
pnpm dev
```

Al primo avvio la home mostra un modulo per creare l'organizzazione: tutto nello
studio (agenti, progetti, budget, provider) appartiene a un'organizzazione, quindi
va creata prima di collegare una API key da Settings.

Gli E2E avviano un server proprio sulla porta 3000. Per eseguirli mentre il dev
server e' acceso, scegli un'altra porta:

```bash
BUNKER_E2E_PORT=3999 pnpm test:e2e
```

La web app è disponibile su `http://localhost:3000`; il controllo salute è
`http://localhost:3000/api/health`. Il worker può essere avviato separatamente:

```bash
pnpm --filter @bunker-studio/worker dev
```

## Supabase locale

```bash
supabase start
supabase db reset
```

Le variabili applicative sono documentate in `.env.example`. I secret reali non devono essere committati.

`supabase db reset` carica anche un dataset demo deterministico in `supabase/seed.sql`:

- organizzazione `bunker-demo`;
- team Core Product e Quality & Security;
- progetto Bunker Demo App;
- tre agenti con binding al runtime fake locale;
- workflow Lead con due task e una dipendenza;
- memoria e decisione di esempio.

Il seed crea l'utente Auth tecnico `demo@bunker.local` senza password e non inserisce
credential o secret provider. Per provare i dati con la web app in sviluppo usare
l'identificativo `00000000-0000-0000-0000-000000000001` nell'header fixture
`x-bunker-user-id`; per un flusso Auth reale creare invece un utente tramite signup.
