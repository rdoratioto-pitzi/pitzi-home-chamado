# PDF Reader MCP

> Extração de texto de arquivos PDF com processamento paralelo de alta performance.

## Pacote
`@sylphx/pdf-reader-mcp`

**Diferenciais:**
- 5-10x mais rápido que alternativas (processamento paralelo)
- 94%+ de cobertura de testes
- Suporta arquivos locais e URLs públicas

## Casos de Uso neste Projeto
- Ler documentação técnica em PDF (manuais de API, especificações de integração)
- Extrair texto de documentos de clientes para importação no sistema
- Processar contratos ou termos enviados em PDF
- Ler especificações da API do Omie ou outros fornecedores em formato PDF
- Extrair informações de boletos ou documentos fiscais para análise

## Configuração no `.mcp.json`
```json
"pdf-reader": {
  "command": "npx",
  "args": ["-y", "@sylphx/pdf-reader-mcp"]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Exemplos de Uso
```
"Leia o PDF em /Users/matheusmundstock/Downloads/api-spec.pdf"
"Extraia o texto da página 3 do documento contrato.pdf"
"Qual é o conteúdo do arquivo manual-integracao-omie.pdf?"
"Leia este PDF e me dê um resumo dos endpoints disponíveis"
"Extraia todos os campos do formulário deste PDF"
```

## Capacidades

| Recurso | Suporte |
|---|---|
| Texto nativo (não OCR) | ✅ |
| Metadados do documento | ✅ |
| Contagem de páginas | ✅ |
| Seleção de páginas específicas | ✅ |
| Arquivos locais | ✅ |
| URLs públicas | ✅ |
| PDFs escaneados (OCR) | ❌ |
| Extração de imagens | ❌ |

## Notas
- **Sem OCR:** funciona apenas para PDFs com texto nativo (a grande maioria)
- Para PDFs escaneados (fotos de documentos), seria necessário um serviço de OCR separado
- Use sob demanda — não é necessário para o desenvolvimento diário
- Útil principalmente ao trabalhar com documentação de fornecedores e clientes
