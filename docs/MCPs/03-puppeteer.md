# Puppeteer MCP

> Automação de browser headless — screenshots, testes e interação com páginas web.

## Pacote
`@modelcontextprotocol/server-puppeteer`

## Casos de Uso neste Projeto
- Tirar screenshots de páginas para documentar bugs visuais
- Capturar estado visual de componentes (kanban, modais, drawers)
- Testar fluxos de UI: login, criação de tarefas, abertura de reuniões
- Validar renderização em diferentes viewports (desktop vs mobile)
- Executar JavaScript em contexto de browser real para inspecionar estado

## Configuração no `.mcp.json`
```json
"puppeteer": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Exemplos de Uso
```
"Tire um screenshot da página de projetos em localhost:5050"
"Abra o modal de nova reunião e capture a tela"
"Teste o fluxo de login com credenciais de desenvolvimento"
"Capture o kanban board em resolução 1440x900"
"Execute o script para verificar se o componente X existe na página"
```

## Diferença vs Playwright MCP

| | Puppeteer MCP | Playwright MCP |
|---|---|---|
| **Saída** | Screenshots (imagens) | Snapshots de acessibilidade (texto) |
| **Velocidade** | Mais lento (carrega imagens) | Mais rápido (sem imagens) |
| **Melhor para** | Testes visuais, documentar bugs | Testes funcionais, automação |
| **Browsers** | Apenas Chromium | Chrome, Firefox, Safari |
| **Tokens usados** | Mais (precisa processar imagem) | Menos |

**Recomendação:** Use Puppeteer para documentar bugs visuais. Use Playwright para automação e testes funcionais.

## Notas
- Requer Chromium instalado — geralmente vem incluído no pacote
- O servidor local precisa estar rodando (`npm run dev`) antes de tirar screenshots
- URL padrão do dev server: `http://localhost:5050`
