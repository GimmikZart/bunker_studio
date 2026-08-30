# External Provider References

Queste fonti sono riferimenti per implementare adapter. Le API/provider sono soggette a evoluzione: al momento di implementare ogni adapter, verificare la documentazione ufficiale corrente e usare gli SDK supportati.

## OpenAI

- Codex as a platform / open agent harness:
  https://developers.openai.com/blog/codex-as-a-platform
- Codex cloud:
  https://developers.openai.com/codex/cloud
- Codex subagents:
  https://developers.openai.com/codex/agent-configuration/subagents
- Codex IDE:
  https://developers.openai.com/codex/ide
- ChatGPT/Codex usage:
  https://help.openai.com/en/articles/11369540/

## Anthropic

- Claude Code / Agent SDK documentation:
  https://docs.anthropic.com/en/docs/claude-code/sdk
- Claude Code CLI:
  https://docs.anthropic.com/en/docs/claude-code/cli-usage
- MCP:
  https://docs.anthropic.com/en/docs/mcp

## Implementation rule

Non copiare API shape o flag da memoria del modello.
Prima di scrivere l'adapter:
1. leggere la documentazione ufficiale corrente;
2. pinning dell'SDK nel lockfile;
3. implementare contract test contro fake;
4. implementare smoke test reale opzionale;
5. normalizzare gli errori al dominio Bunker Studio.
