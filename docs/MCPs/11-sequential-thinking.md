# Sequential Thinking MCP

> Raciocínio estruturado passo a passo — decomponha problemas complexos com transparência.

## Pacote
`@modelcontextprotocol/server-sequential-thinking` (oficial Anthropic)

## Por que usar?
Problemas complexos se beneficiam de raciocínio explícito e revisável. Este MCP permite que o Claude "pense em voz alta" de forma estruturada, revisando e corrigindo passos anteriores antes de chegar a uma conclusão.

## Casos de Uso neste Projeto
- Planejar implementações complexas antes de começar a codar
- Debugar bugs difíceis que envolvem múltiplos componentes e camadas
- Arquitetar novas features (ex: novo módulo, integração de API)
- Analisar trade-offs entre abordagens técnicas
- Investigar problemas de performance com análise sistemática
- Criar planos de migração de banco de dados

## Configuração no `.mcp.json`
```json
"sequential-thinking": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Como Funciona
O MCP expõe a ferramenta `sequentialthinking` que permite ao Claude:

1. **Decompor** o problema em passos numerados e explícitos
2. **Revisar** e corrigir passos anteriores se necessário
3. **Ramificar** em hipóteses alternativas quando houver incerteza
4. **Chegar a uma conclusão** estruturada e rastreável

Cada "pensamento" pode ser marcado como revisão de um anterior ou exploração de alternativa.

## Exemplos de Uso
```
"Use sequential thinking para analisar como implementar notificações em tempo real"
"Aplique raciocínio estruturado para debugar o erro 500 no endpoint de tarefas"
"Pense passo a passo sobre a melhor arquitetura para o módulo de relatórios CSAT"
"Use sequential thinking para planejar a migração do campo meetingData de TEXT para JSONB"
"Raciocine sobre as implicações de adicionar soft delete na tabela tasks"
```

## Quando NÃO usar
- Tarefas simples e diretas (adicionar um campo, corrigir typo)
- Quando o caminho é óbvio e não há trade-offs a considerar
- Para gerar código mecânico baseado em padrões já estabelecidos

## Notas
- Produzido pela Anthropic — garantia de qualidade e alinhamento com o Claude
- Aumenta a transparência do raciocínio, facilitando revisão humana
- Funciona particularmente bem combinado com o Filesystem MCP (para ler código antes de planejar)
- Ideal antes de entrar no modo de planejamento (`EnterPlanMode`) para tarefas muito complexas
