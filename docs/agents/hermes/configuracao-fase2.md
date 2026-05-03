# Hermes — Configuração da Fase 2

> Esta página documenta como ligar o webhook outbound de chamados → Routine
> Hermes em ambientes dev e prod. Pré-requisito: Fase 1 mergeada (service
> account `hermes@renovsmart.com.br` + endpoint de geração de token).

## Variáveis novas

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `HERMES_ROUTINE_URL` | URL pública | Endpoint do trigger da Routine Hermes na Anthropic |
| `HERMES_ROUTINE_TOKEN` | Secret | Bearer token do trigger (`sk-ant-oat01-…`) |

Ambas são **opcionais**: na ausência delas, `hermes-trigger.service.ts`
loga `"config-ausente"` e segue o fluxo normal de criação do chamado.

## Onde obter os valores

1. Acessar https://claude.com/code → painel da conta Renov
2. Routines → criar (ou editar) a Routine `Hermes Triage`
3. Aba **Triggers** → criar trigger HTTP
4. Copiar:
   - **URL** → vai para `HERMES_ROUTINE_URL`
   - **Bearer token** (visível apenas no momento da criação ou via
     "Regenerate token") → vai para `HERMES_ROUTINE_TOKEN`

> Se já existe um token gerado e você não tem o plaintext, use
> "Regenerate token" — isso invalida o anterior. Atualize o secret nos
> dois ambientes (dev e prod) ao mesmo tempo para evitar inconsistência.

## Configuração — Express (dev local)

Adicionar em `.env` (não commitado):

```bash
HERMES_ROUTINE_URL=https://api.anthropic.com/v1/claude_code/routines/trig_xxx/fire
HERMES_ROUTINE_TOKEN=sk-ant-oat01-...
```

`.env.example` já tem as duas linhas com placeholders.

Validar:

```bash
npm run dev
# Em outro terminal:
curl -X POST http://localhost:5050/api/tickets \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão admin>" \
  -d '{"title":"teste hermes","description":"x","category":"...","type":"bug","applicationKey":"renov-home"}'

# Logs do server devem mostrar:
# [hermes-trigger] CHA-XXXX disparado (ambiente=dev, app=renov-home)
```

## Configuração — Cloudflare Worker (dev e prod)

Variáveis `HERMES_ROUTINE_URL` e `HERMES_ROUTINE_TOKEN` são tratadas como
**secrets** (não vão em `wrangler.toml` versionado).

### Ambiente dev (`renov-home-api-dev` / homeapi-dev.renovsmart.com.br)

```bash
cd worker
npx wrangler secret put HERMES_ROUTINE_URL --env dev
# Cola a URL e ENTER

npx wrangler secret put HERMES_ROUTINE_TOKEN --env dev
# Cola o token e ENTER
```

### Ambiente prod (`renov-home-api` / homeapi.renovsmart.com.br)

```bash
cd worker
npx wrangler secret put HERMES_ROUTINE_URL
npx wrangler secret put HERMES_ROUTINE_TOKEN
```

(sem `--env` → ambiente default = produção)

### Verificar se foram salvos

```bash
cd worker
npx wrangler secret list --env dev
npx wrangler secret list
```

Deve listar `HERMES_ROUTINE_URL` e `HERMES_ROUTINE_TOKEN` em ambos.

## Validação manual após deploy

1. Confirmar deploy: `bash scripts/deploy.sh` (prod) ou pipeline dev
2. Em `https://home-dev.renovsmart.com.br`, criar chamado novo:
   - tipo: `bug`
   - aplicação: `Renov Home`, `Renov Hub` ou `Venus`
   - prioridade: qualquer
3. Acompanhar:
   ```bash
   cd worker
   npx wrangler tail --env dev --format=pretty | grep hermes-trigger
   ```
4. Esperado: linha `[hermes-trigger] CHA-XXXX disparado (ambiente=dev, app=renov-home)`
5. Em ~30–60s, mensagem do Hermes deve aparecer na thread do chamado em
   `#repo-renov-home` (Slack)

## Cenários de não-disparo (esperados)

A linha de log identifica o motivo:

| Motivo no log | Causa |
|---------------|-------|
| `applicationKey nulo — fora de escopo` | Chamado criado sem aplicação selecionada |
| `applicationKey 'X' fora do escopo Hermes` | Aplicação não está em `HERMES_EXECUTION_SCOPE` |
| `applicationKey 'pitzi-duda' bloqueada (cliente externo)` | Pitzi/Duda nunca dispara Hermes |
| `type 'X' incompatível` | Apenas `type='bug'` aciona Hermes nesta fase |
| `HERMES_ROUTINE_URL/TOKEN ausentes — pulando disparo` | Secret não configurado no ambiente |

## Rollback rápido

Para desligar Hermes sem fazer deploy de código:

```bash
cd worker
npx wrangler secret delete HERMES_ROUTINE_URL --env dev
npx wrangler secret delete HERMES_ROUTINE_TOKEN --env dev
# (e/ou prod, removendo --env)
```

Service detecta ausência e loga `config-ausente`. Fluxo de criação
de chamado continua funcionando normalmente.

## Próximas fases

- **Fase 3**: consumir resposta da Routine, postar análise no Slack,
  approval gate via menção `@Hermes aprovado`, tabela
  `hermes_slack_threads`.
- **Fase 4**: Routine "Hermes Executor" usando o Bearer token gerado
  pelo endpoint da Fase 1 para chamar a API do Home autenticadamente.
