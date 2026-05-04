# Spike Results — Hermes (v1 → v4-exec)

Histórico das execuções de prova de conceito que validaram a viabilidade
do agente antes de abrir o trabalho desta Fase 1.

## v1 — Triagem ingênua

- **Entrada**: ticket cru em JSON, prompt curto pedindo categoria.
- **Resultado**: Claude classificou bem chamados óbvios mas alucinou em
  casos com termos internos da Renov (ex.: "Trade-in Magalu",
  "ListarPosEstoque"). Não diferenciou pedido de informação de bug.
- **Aprendizado**: precisa de glossário do domínio inline e de exemplos
  few-shot.

## v2 — Glossário + few-shot

- **Entrada**: prompt v1 + 8 exemplos representativos (4 categorias × 2)
  + um glossário de 30 termos do produto.
- **Resultado**: precisão subiu para ~85% nos 40 chamados de validação.
  Falhas concentradas em chamados ambíguos onde o título dizia uma coisa
  e a descrição dizia outra.
- **Aprendizado**: precisa olhar para descrição completa, não só título.
  Vale a pena pedir uma "confiança" estimada para que o operador humano
  possa filtrar revisões.

## v3 — Confiança + descrição completa

- **Entrada**: prompt v2 ajustado para emitir `{ categoria, confianca,
  proximos_passos }`.
- **Resultado**: precisão ~91%. Confiança baixa (<0.7) cobriu
  corretamente os casos onde Claude errou. Próximos_passos virou um
  texto utilizável para colar como comentário no ticket.
- **Aprendizado**: a triagem está pronta. Próximo gap é executar a
  ação (atribuir responsável, mudar status), não só sugerir.

## v4 — Triagem em produção (read-only)

- **Entrada**: prompt v3 com tags do projeto (TI, Logística, Pricing
  etc.) injetadas dinamicamente da tabela `tags`.
- **Resultado**: roda diariamente no spike privado consumindo o feed de
  tickets via API key. Saída vai para um Slack canal interno
  (`#hermes-lab`) sem ainda postar comentários no ticket. Aceitação
  qualitativa do time foi positiva — virou prompt em produção,
  versionado em [prompts/triage-v4.md](./prompts/triage-v4.md).

## v4-exec — Executor com aprovação

- **Entrada**: triagem v4 acrescida de uma etapa de execução: quando
  `categoria=action`, Claude propõe uma sequência de chamadas REST e
  pede aprovação humana via Slack thread.
- **Resultado**: aprovação humana funciona, mas a chamada para a API
  ainda usa a `VENUS_API_KEY`, o que causa atribuição errada de autoria
  (todos os comentários ficam como "Venus" no ticket). É exatamente o
  problema que esta Fase 1 resolve criando uma identidade dedicada.
- **Aprendizado**: precisamos de service account própria para Hermes
  antes de plugar o executor em produção. → este PR.
