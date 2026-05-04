# Prompt — Triagem v7 (Fase 4 — envia execution_plan)

Versão da Routine que substitui o **v6** após o merge da Fase 4 do Hermes.

Mudanças vs. v6 (apenas uma — pequena, mas crítica pra Fase 4):

1. Após postar a mensagem-mãe no Slack e gerar o `/prompt-renov` (plano
   passo-a-passo de execução), a Routine inclui o plano completo no
   campo `execution_plan` ao chamar
   `POST /api/integrations/hermes/thread-registered`.

   O backend (Fase 4) grava esse plano em `hermes_slack_threads.execution_plan`
   e usa-o como input pra disparar a Routine "Hermes Executor" quando o
   humano clicar em ✅ Aprovar.

> ⚠️ **IMPORTANTE**: Substituir o conteúdo da Routine "Hermes — Triagem"
> em https://claude.ai/code/routines manualmente após o merge desta PR.

> Esta versão só passa a ter efeito quando a Fase 4 está em produção. Em
> caso de rollback parcial, o backend ignora silenciosamente o campo
> `execution_plan` (é opcional).

---

## Variáveis de ambiente

Iguais à v6. Nenhuma variável nova é necessária pra Triagem (HERMES_EXECUTOR_*
são variáveis do **backend**, não da Routine Triagem).

---

## Diff conceitual vs. v6

Onde a v6 faz:

```
POST {RENOV_API_URL}/api/integrations/hermes/thread-registered
Authorization: Bearer {RENOV_API_TOKEN}
Content-Type: application/json

{
  "chamado_id": "<uuid>",
  "thread_ts": "<ts>",
  "channel_id": "<channel>"
}
```

A v7 faz:

```
POST {RENOV_API_URL}/api/integrations/hermes/thread-registered
Authorization: Bearer {RENOV_API_TOKEN}
Content-Type: application/json

{
  "chamado_id": "<uuid>",
  "thread_ts": "<ts>",
  "channel_id": "<channel>",
  "execution_plan": "<texto integral do /prompt-renov gerado para este chamado>"
}
```

O campo `execution_plan` é o **texto completo** do plano gerado — não
um link, não um resumo. Inclui contexto, fases, comandos, validações.
Esse mesmo texto é o que vai pro Hermes Executor quando aprovado.

---

## Sequência mental do prompt

1. Recebe input com dados do chamado + ambiente (`dev`|`prod`).
2. Investiga o repo (Renov.Home / Renov.Hub / Venus, conforme aplicação).
3. Gera triagem em prosa + plano `/prompt-renov` estruturado.
4. Posta mensagem-mãe no Slack via Block Kit (botões Aprovar/Ajustar/Cancelar).
5. **Registra mapping** com `execution_plan` incluso (mudança v7).
6. Encerra. Decisão humana é assíncrona.

---

## Ressalvas

- **Tamanho do plano**: o backend não impõe limite explícito, mas planos
  acima de ~64KB podem causar lentidão na thread Slack quando ecoados
  pelo Executor. Se o plano ficar maior, resumir mantendo os blocos
  obrigatórios (FASE/Validação/Entrega).
- **Idempotência**: se a Routine for re-disparada pelo mesmo chamado, o
  endpoint atualiza `execution_plan` no upsert. Isso é esperado.
- **Sem plano**: se a Routine não conseguir gerar plano (raro), enviar
  o request **sem** `execution_plan` — o backend posta fallback manual
  na thread quando o humano aprovar.
