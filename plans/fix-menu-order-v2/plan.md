# Fix Menu Order V2 - Projetos Abaixo de Reuniões

CORREÇÃO: Plan anterior não funcionou. Precisa ser mais específico.

## PROMPT 1: Localizar Sidebar Component

Encontrar o arquivo EXATO do sidebar.

Possíveis localizações:
- client/src/components/app-sidebar.tsx
- client/src/components/sidebar.tsx
- client/src/components/layout/sidebar.tsx
- client/src/layouts/sidebar.tsx

Verificar qual arquivo está sendo usado atualmente.

Procurar por:
- Array de itens de menu
- Componentes NavItem ou MenuItem
- Estrutura com "Chamados", "Projetos", "Tarefas", "Reuniões"

Retornar o caminho COMPLETO do arquivo encontrado.

## PROMPT 2: Mostrar Estrutura Atual do Menu

Arquivo: [caminho encontrado no PROMPT 1]

Mostrar:
1. Array/objeto atual com TODOS os itens do menu
2. Ordem atual dos itens
3. Identificar onde está "Projetos" e "Reuniões"

Exemplo do que procurar:
```typescript
const menuItems = [
  { label: "Chamados", path: "/chamados" },
  { label: "Projetos", path: "/projetos" },  // ← está aqui
  { label: "Tarefas", path: "/tarefas" },
  { label: "Reuniões", path: "/reunioes" }, // ← quer abaixo daqui
  ...
];
```

## PROMPT 3: Aplicar Mudança de Ordem

Arquivo: [mesmo arquivo]

REORDENAR para:
```typescript
const menuItems = [
  { label: "Chamados", ... },
  { label: "Tarefas", ... },
  { label: "Reuniões", ... },
  { label: "Projetos", ... }, // ← NOVA POSIÇÃO
  ...
];
```

IMPORTANTE:
- Mover APENAS o item "Projetos"
- Colocar EXATAMENTE após "Reuniões"
- Manter TODOS os outros itens na mesma ordem
- Não alterar paths, icons, ou outras propriedades
- APENAS reordenar no array

## PROMPT 4: Verificar Mudança

Arquivo: [mesmo arquivo]

Adicionar comentário no código confirmando mudança:
```typescript
// Ordem atualizada: Projetos movido para após Reuniões
const menuItems = [
  ...
  { label: "Reuniões", ... },
  { label: "Projetos", ... }, // Movido de posição 2 para posição 4
  ...
];
```

Salvar arquivo.
