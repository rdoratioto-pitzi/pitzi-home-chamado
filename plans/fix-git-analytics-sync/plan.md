# Fix: Git Analytics - Botão Sincronizar e Carregamento de Dados

O módulo Git Analytics não está carregando dados e o botão "Sincronizar" não funciona.

## PROMPT 1: Investigar Backend - Endpoint de Sincronização

Verificar o endpoint de sincronização do Git Analytics.

Arquivo principal: server/routes.ts

Investigar:
1. Endpoint POST /api/git-analytics/sync existe?
2. Está autenticado corretamente?
3. Faz chamada à API do GitHub?
4. Salva dados no banco?
5. Retorna resposta adequada?

Se houver erros, corrigir e adicionar logs.
Seguir CLAUDE.md: Drizzle ORM, validação Zod.

## PROMPT 2: Verificar Frontend - Botão Sincronizar

Arquivo: client/src/pages/git-analytics/index.tsx

Verificar e corrigir:
- Botão chama endpoint correto?
- Loading state durante sync?
- Toast de sucesso/erro?
- Revalida dados após sync?

Usar TanStack Query para mutation.

## PROMPT 3: Investigar Carregamento de Dados

Arquivo: client/src/pages/git-analytics/index.tsx

Verificar por que dados não aparecem:
- Hook useQuery configurado?
- Endpoint GET retorna dados?
- Filtros impedindo exibição?

Se não há dados: mostrar "Clique em Sincronizar"
Se há dados: verificar mapeamento.

## PROMPT 4: Melhorias de UX

Arquivo: client/src/pages/git-analytics/index.tsx

Adicionar:
- Mensagem quando sem dados
- Loading durante sincronização
- Toast de sucesso com contadores
- Timestamp da última sync

Usar shadcn/ui.
