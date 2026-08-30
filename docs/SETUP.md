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
