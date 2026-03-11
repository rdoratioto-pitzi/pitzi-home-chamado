# Playwright MCP

> Automação web via snapshots de acessibilidade — testes E2E confiáveis e eficientes.

## Pacote
`@playwright/mcp` (oficial Microsoft)

## Diferencial
Usa snapshots de acessibilidade (texto estruturado) em vez de screenshots — mais rápido, menos tokens, mais robusto que seletores CSS.

## Casos de Uso neste Projeto
- Testes E2E automatizados dos módulos (Projetos, Reuniões, Tarefas, Kanban)
- Validar acessibilidade de componentes shadcn/ui
- Testar fluxos críticos: login, criação de tarefa, drag-and-drop no kanban
- Preencher formulários e verificar estado da UI programaticamente
- Testar responsividade em diferentes viewports

## Configuração no `.mcp.json`
```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Instalação dos Browsers (uma vez)
```bash
npx playwright install chromium
```

Para suporte a Firefox e Safari:
```bash
npx playwright install
```

## Exemplos de Uso
```
"Navegue para localhost:5050 e faça login com as credenciais de teste"
"Verifique se o modal de nova reunião abre ao clicar no botão '+ Nova Reunião'"
"Preencha o formulário de nova tarefa com título 'Tarefa de Teste' e salve"
"Verifique se o KanbanBoard está acessível por teclado"
"Teste o fluxo completo de criar um projeto, adicionar tarefa e mover para 'Concluído'"
"Capture o snapshot de acessibilidade da página de projetos"
```

## Diferença vs Puppeteer MCP

| | Playwright MCP | Puppeteer MCP |
|---|---|---|
| **Saída principal** | Snapshots de acessibilidade (texto) | Screenshots (imagens) |
| **Velocidade** | Mais rápido | Mais lento |
| **Tokens usados** | Menos | Mais |
| **Multi-browser** | Chrome, Firefox, Safari | Apenas Chrome |
| **Melhor para** | Testes funcionais e automação | Documentação visual |
| **Robustez** | Alta (semântico) | Média (pode quebrar com CSS) |

## Notas
- Multi-browser: pode testar em Chrome, Firefox e Safari com o mesmo código
- Snapshots de acessibilidade são mais estáveis que seletores CSS — menos flakiness
- O dev server precisa estar rodando (`npm run dev`) para testar localmente
- URL padrão do dev server: `http://localhost:5050`
- Combinar com Sequential Thinking para planejar sequências de teste complexas
