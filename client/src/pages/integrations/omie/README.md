# Integração Omie - Componentes Frontend

## Estrutura de Arquivos

```
omie/
├── OmieIntegration.tsx      # Página principal com tabs
├── OmieOverview.tsx          # Aba Visão Geral + Autenticação
├── OmieComprasEstoque.tsx    # Aba Compras (4 endpoints)
├── OmieVendas.tsx            # Aba Vendas (3 endpoints)
├── OmieTransporte.tsx        # Aba Transporte (1 endpoint CT-e)
├── OmieFinancas.tsx          # Aba Finanças (3 endpoints)
└── OmieGeral.tsx             # Aba Geral (3 endpoints)
```

## Padrões de Desenvolvimento

### Estrutura de Estado

Cada endpoint tem seus próprios estados:

- `filters`: Filtros do formulário
- `data`: Dados retornados
- `loading`: Estado de carregamento
- `totals`: KPIs (quando aplicável)

### Função callOmieApi

Função genérica reutilizada em todos os componentes:

```typescript
const callOmieApi = async (endpoint: string, call: string, params: any[], category: string)
```

### Tratamento de Erros

- Try/catch em todas as chamadas
- Mensagens de erro amigáveis
- Loading states visuais
- Feedback com Alert components

## Como Adicionar Novo Endpoint

1. Adicionar estado para o endpoint
2. Criar função handler com callOmieApi
3. Criar formulário de filtros
4. Criar tabela de resultados
5. Adicionar loading state
6. Testar com dados reais

## Componentes Utilizados (shadcn/ui)

- Card, CardHeader, CardTitle, CardDescription, CardContent
- Input, Label, Button
- Table, TableHeader, TableBody, TableRow, TableCell
- Badge, Alert, Skeleton
- Select, SelectTrigger, SelectValue, SelectContent, SelectItem
- Separator, Dialog

---

*Desenvolvido seguindo padrões do Renov Home*
