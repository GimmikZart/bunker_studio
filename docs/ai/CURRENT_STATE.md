# Current Project State

## Checkpoint 2026-09-01 — Worker Codex/GitHub con verifica deterministica

Bunker Studio non usa piu' un modello globale configurato negli env. In
Supabase ogni agente conserva un binding versionato a uno specifico account
provider, model ID, runtime e reasoning effort. OpenAI e Anthropic recuperano
il catalogo modelli tramite le API di elenco (senza inferenza); le API key sono
cifrate AES-256-GCM prima della persistenza. Anthropic e provider compatibili
restano opzionali. Il modello locale futuro non e' un prerequisito.

Il percorso iniziale supportato e' web locale o ospitato + Supabase Cloud +
worker sul PC. Il worker si registra con token monouso, conserva localmente la
propria credenziale, preleva task assegnati, rinnova il lease durante run
lunghi e seleziona il runtime dal binding dell'agente. Per `CODEX_SDK` clona il
repository GitHub in un workspace isolato, applica sandbox e scope, crea un
branch task e avvia i controlli deterministici dichiarati dal task. Commit e
push avvengono soltanto dopo il PASS di tutti i controlli, senza merge o deploy.

Il repository GitHub e il branch vengono verificati via API prima di salvare
il token; e' richiesto il permesso push. Provider e credenziali repository
sono decifrati soltanto nel confine server/worker autenticato. HTTP per il
control plane e' ammesso solo su loopback; un endpoint remoto deve usare HTTPS.

## Implementato e verificato in questo checkpoint

- Modalita' di persistenza esplicita `BUNKER_PERSISTENCE_MODE=memory|supabase`,
  indipendente da esecuzione locale o hosting.
- UI/API Settings per account OpenAI, Anthropic e OpenAI-compatible; una sola
  connessione per provider per organizzazione e catalogo modelli persistito.
- Creazione/modifica agente con selezione provider -> modello -> runtime ->
  reasoning; vincoli SQL impediscono accoppiamenti provider/runtime errati.
- Chat diretta legata al modello dell'agente; OpenAI usa Responses API.
- Task assegnabile a un agente; il queue gate richiede binding completo e, per
  Codex, repository GitHub connesso, write scope e almeno un comando di verifica
  esplicito.
- Worker Codex SDK con ambiente child allowlist, sandbox `workspace-write`,
  approval `never`, web disabilitato, rete opt-in e prompt scoped.
- Workspace Git effimero, path traversal protection, credenziale fuori da URL
  e argomenti, validazione di ogni file modificato, commit/push su branch
  candidato e cleanup.
- Piano di verifica strutturato e bounded per task. Il worker usa `execFile`
  senza shell interpolation, timeout e limite output, ambiente privo di secret
  e allowlist degli eseguibili. Su Windows gli shim npm/pnpm/yarn vengono
  eseguiti direttamente con Node, senza passare da `.cmd` o PowerShell.
- Evidenza bounded separata dal resoconto LLM: kind, eseguibile, numero argomenti,
  exit code, timeout, durata e PASS/FAIL. Argomenti e stdout/stderr non vengono
  persistiti. Un failure impedisce push e `IMPLEMENTED` e segue retry/escalation.
- UI task con package manager e script di verifica; il risultato worker mostra
  se la pubblicazione e' passata o e' stata bloccata.
- Lease rinnovabile autenticato; risultato, branch, SHA ed evidenza comandi
  persistiti atomicamente con la transizione task. Notifica in-app a
  Owner/Admin per implementazione pronta o fallimento finale.
- Migrazioni `00000000000020..23` per provider/catalogo/binding, risultati
  worker, lease renewal e registrazione automatica delle prove in
  `verification_runs`. La claim seleziona solo worker con capability compatibile
  (`codex` o `chat`).
- Guida locale-first aggiornata: le vecchie variabili `AGENT_PROVIDER_*` e
  `LOCAL_PROVIDER_*` sono deprecate e ignorate.

## Stato milestone

M0-M4 e le vertical slice gia' elencate nella specifica restano presenti. Il
checkpoint completa il binding provider/model richiesto da M3 e la parte locale
del worker repository e della verification evidence di M5. M6 non e' ancora
completo: la prossima unita' e' la preparazione PR GitHub e ingestione CI
idempotenti, mantenendo merge e deploy dietro gate. Le successive milestone e
gli Acceptance Criteria esterni restano da completare; non e' corretto usare la
stringa di completamento finale.

## Verifiche correnti

- `pnpm verify`: PASS — format, lint 15/15, typecheck 15/15, test 26/26,
  build 15/15 (Next.js 57 pagine/API), audit high senza vulnerabilita' note.
- `pnpm test:e2e` con `BUNKER_PERSISTENCE_MODE=memory`: PASS, 11/11.
- Web route suite: PASS, 22 file / 38 test.
- Worker suite: PASS, 11 file / 28 test.
- Test mirati config 2/2, Git 8/8, DB 14/14, OpenAI 3/3, Anthropic 4/4.
- `supabase db reset --local`: PASS; migrazioni `00000000000000..23` e seed
  applicati da zero.
- Smoke reale Windows del runner `pnpm`: PASS senza shell; trigger SQL
  `verification_runs`: PASS in transazione con rollback.
- Dev web/worker ripristinati dopo E2E; `/api/health` restituisce `status: ok`.

## Limiti e verifiche esterne pendenti

- Nessuna chiamata di inferenza OpenAI a pagamento e nessun push su un
  repository reale sono stati eseguiti automaticamente: richiedono le
  credenziali/account dell'utente. Adapter, fake e contract test sono verdi.
- Restano le prove quality/device della matrice (cloud recovery, pg-boss
  multi-process, GitHub/CI protetto, VAPID push e backup/restore).
- Ollama/LM Studio resta una capacita' futura non bloccante per espressa
  decisione utente; non e' stato rimosso dall'architettura.

## Ultimo aggiornamento

2026-09-01
