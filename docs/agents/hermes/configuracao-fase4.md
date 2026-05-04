# Hermes — Fase 4: Pipeline de execução pós-aprovação

A Fase 4 fecha o loop do Hermes: quando o humano clica em **✅ Aprovar**
na thread Slack, o backend dispara uma segunda Routine — o **Hermes
Executor** — que recebe o `/prompt-renov` aprovado, executa fielmente
no repo correto, abre PR contra `develop`, e reporta status à thread
Slack original e ao Renov Home.

---

## O que mudou no backend

1. **Migration** `migrations/0016_hermes_execution_fields.sql`:
   adiciona 7 colunas em `hermes_slack_threads`:
   - `execution_status` (`pending` | `running` | `success` | `failed`)
   - `execution_started_at`, `execution_completed_at`
   - `execution_pr_url`, `execution_pr_number`
   - `execution_error`
   - `execution_plan` (snapshot do `/prompt-renov` da Triagem)

2. **Service** `hermes-executor-trigger.service.ts` (Express + Worker):
   função `fireExecutor(...)` que marca `running` no banco e dispara
   a Routine via webhook outbound (Bearer + `anthropic-beta` headers).

3. **Hook em `/api/integrations/slack/interactions`**: quando o humano
   clica `hermes_aprovado`, depois de gravar `decision='aprovado'`, lê
   `execution_plan` do banco e chama `fireExecutor`. Se o plano não
   estiver registrado, posta na thread aviso de fallback manual.

4. **Endpoint** `POST /api/integrations/hermes/execution-update`
   (Bearer service account): a Routine Executor reporta success|failed
   no fim da execução, com PR URL/number ou erro.

5. **`thread-registered`** passou a aceitar campo opcional
   `execution_plan` no body — gravado no upsert. Permite que a Triagem
   v7 já mande o plano junto com o registro da thread.

---

## Checklist do Matheus (após merge da PR)

### 1. Aplicar migration no Neon — DEV

Conteúdo: [`migrations/0016_hermes_execution_fields.sql`](../../../migrations/0016_hermes_execution_fields.sql).

```bash
npm run db:apply:dev -- -f migrations/0016_hermes_execution_fields.sql
```

Validar:

```sql
\d hermes_slack_threads
-- deve mostrar as 7 novas colunas (execution_*)

SELECT count(*) FROM hermes_slack_threads
WHERE execution_status IS NOT NULL;   -- 0 logo após migration
```

### 2. Criar Routine "Hermes Executor"

No painel https://claude.ai/code/routines (conta Pitzi):

1. **New Routine** → nome: `Hermes — Executor`.
2. Repos a habilitar:
   - `Renov-BD/Renov.Home`
   - `Renov-BD/Renov.Hub`
   - `Renov-BD/venus`
3. Ambiente: `Renov-Default` (mesmo da Triagem).
4. Modelo recomendado: **Sonnet 4.6** (`claude-sonnet-4-6`).
5. Setup script: incluir antes de qualquer execução:

   ```bash
   cd /workspace/<repo-resolvido-pelo-plano>
   git checkout develop
   git pull origin develop
   npm install
   npx tsc --noEmit 2>&1 | grep "error TS" | wc -l > /tmp/tsc_baseline.txt
   ```
6. Prompt: copiar do arquivo
   [`prompts/executor-v1.md`](prompts/executor-v1.md).
7. Trigger: HTTP webhook (Bearer auth). **Anotar URL e Token** —
   serão setados nos secrets do Worker no passo 3.

### 3. Configurar secrets do Worker

```bash
cd worker

# Dev
npx wrangler secret put HERMES_EXECUTOR_URL --env=dev      # cola URL do trigger
npx wrangler secret put HERMES_EXECUTOR_TOKEN --env=dev    # cola Bearer token

# Prod
npx wrangler secret put HERMES_EXECUTOR_URL --env=""
npx wrangler secret put HERMES_EXECUTOR_TOKEN --env=""
```

Validar:

```bash
npx wrangler secret list --env=dev
npx wrangler secret list --env=""
```

Devem aparecer `HERMES_EXECUTOR_URL` e `HERMES_EXECUTOR_TOKEN` em ambos.

### 4. Atualizar prompt da Routine Triagem para v7

A Triagem precisa começar a enviar `execution_plan` no chamado a
`thread-registered`. Substituir o conteúdo do prompt da Routine
"Hermes — Triagem" pelo arquivo
[`prompts/triage-v7.md`](prompts/triage-v7.md).

> Sem essa atualização, a Fase 4 cai no fallback gracioso (mensagem
> "⚠️ Plano não encontrado para execução automática"). Não há quebra,
> mas o loop não fecha automaticamente.

### 5. Atualizar prompt da Routine Executor

Configurar o prompt da Routine Executor recém-criada com o conteúdo de
[`prompts/executor-v1.md`](prompts/executor-v1.md).

---

## Plano de teste E2E (em DEV)

1. Criar um chamado novo em https://home-dev.renovsmart.com.br/workspace/chamados:
   - Título: "Teste Fase 4 Hermes Executor"
   - Aplicação: Renov Home
   - Tipo: Bug
2. Aguardar (≤ 30s) — Hermes Triagem deve postar mensagem-mãe no canal
   de devs com 3 botões.
3. Verificar no Neon (dev) que o plano foi gravado:
   ```sql
   SELECT chamado_id, decision, length(execution_plan) AS plano_len
   FROM hermes_slack_threads
   ORDER BY created_at DESC LIMIT 1;
   -- decision = NULL, plano_len > 0
   ```
4. Clicar **✅ Aprovar** na thread Slack.
5. Verificar (≤ 5s) no banco:
   ```sql
   SELECT decision, execution_status, execution_started_at
   FROM hermes_slack_threads
   ORDER BY decision_at DESC LIMIT 1;
   -- decision='aprovado', execution_status='running'
   ```
6. Aguardar 3–10 min (Executor rodando).
7. Esperado:
   - Reply na thread: `✅ PR aberto: https://github.com/Renov-BD/Renov.Home/pull/<n> — aguardando review do Marcelo`
   - Banco:
     ```sql
     SELECT execution_status, execution_pr_url, execution_pr_number,
            execution_completed_at
     FROM hermes_slack_threads
     ORDER BY decision_at DESC LIMIT 1;
     -- execution_status='success', pr_url e pr_number preenchidos
     ```
   - PR no GitHub aberto contra `develop` com reviewer `marcelo-maciel`.
8. Repetir o fluxo num cenário de **falha intencional** (chamado cujo
   plano introduz erros TS) e confirmar que:
   - Reply na thread mostra ❌ com motivo
   - `execution_status='failed'`, `execution_error` preenchido

---

## Promoção pra Prod

Se DEV está OK:

1. Aplicar `migrations/0016_hermes_execution_fields.sql` no Neon **prod**:
   ```bash
   npm run db:apply:prod -- -f migrations/0016_hermes_execution_fields.sql
   # exige confirmação "APLICAR EM PROD"
   ```
2. Confirmar `HERMES_EXECUTOR_URL` e `HERMES_EXECUTOR_TOKEN` nos secrets
   do Worker prod (passo 3 acima, sem `--env=dev`).
3. Atualizar `RENOV_API_URL` da Routine Triagem pra prod (já feito na
   Fase 3 em produção).
4. Repetir o teste E2E em prod com um chamado de teste real.

---

## Endpoints expostos (Fase 4)

| Método | Path                                              | Auth                | Origem chamada                |
| ------ | ------------------------------------------------- | ------------------- | ----------------------------- |
| POST   | `/api/integrations/hermes/thread-registered`      | Bearer (svc acc)    | Routine Triagem (v7)          |
| POST   | `/api/integrations/slack/interactions`            | Slack signature     | Slack (block_actions)         |
| POST   | `/api/integrations/hermes/execution-update`       | Bearer (svc acc)    | Routine Executor (Fase 4)     |

---

## Troubleshooting comum

- **Aprovo no Slack mas Executor não dispara**:
  - Conferir `HERMES_EXECUTOR_URL` e `HERMES_EXECUTOR_TOKEN` nos secrets
    do Worker (`npx wrangler secret list --env=...`).
  - Conferir nos logs do Worker (`wrangler tail`) entradas com prefixo
    `[hermes-executor-trigger]`. `config-ausente` = secrets faltando.
    `plano-vazio` = Triagem não enviou `execution_plan` (rodando v6
    ainda → atualizar pra v7).
- **Reply "⚠️ Plano não encontrado"**: a Triagem v7 ainda não foi
  ativada na Routine. Atualizar o prompt da Routine ou intervir
  manualmente no chamado.
- **Executor falhou no gate TSC**: comparar baseline esperado com o
  real no log do Executor. Pode ser que outro PR mergeou regredindo
  baseline — recalcular antes de re-rodar.
- **Reply na thread falha**: verificar `SLACK_BOT_TOKEN` (Routine
  Executor) e que o app Hermes está no canal de devs.
- **`/api/integrations/hermes/execution-update` retorna 401**: o token
  de service account expirou (TTL = 1 ano). Gerar novo via
  `/api/admin/service-accounts/<id>/generate-token` e atualizar
  `RENOV_API_TOKEN` no ambiente da Routine Executor.
- **404 em `execution-update`**: `chamado_id` enviado pelo Executor
  não bate com nenhuma linha — Triagem nunca chamou
  `thread-registered` ou foi limpo. Investigar logs da Triagem.

---

## O que NÃO está nesta fase

- Auto-merge do PR aberto pelo Executor — Marcelo continua sendo o
  reviewer obrigatório, sem aprovação dele não há merge.
- Re-execução automática após "Ajustar" (decision='ajustar' não dispara
  Executor).
- Loop de auto-fix em caso de CI vermelho — fica como melhoria futura
  (Fase 5 hipotética).
- UI no Renov Home mostrando histórico de execuções do Hermes (a tabela
  já carrega os dados, mas a tela é trabalho separado).
