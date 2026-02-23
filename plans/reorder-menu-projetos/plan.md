# Reordenar Menu - Projetos Abaixo de Reuniões

Mover item "Projetos" para ficar logo abaixo de "Reuniões" no menu lateral.

## PROMPT 1: Ajustar Ordem no Sidebar

Arquivo: client/src/components/app-sidebar.tsx (ou onde está o menu)

Reordenar itens do array de navegação:

Ordem atual:
- Chamados
- Projetos ← mover
- Tarefas
- Reuniões
- ...

Ordem nova:
- Chamados
- Tarefas
- Reuniões
- Projetos ← nova posição
- ...

Encontrar array de itens (algo como):
```typescript
const menuItems = [
  { name: 'Chamados', ... },
  { name: 'Projetos', ... }, // Mover
  { name: 'Tarefas', ... },
  { name: 'Reuniões', ... },
  ...
];
```

Reordenar para:
```typescript
const menuItems = [
  { name: 'Chamados', ... },
  { name: 'Tarefas', ... },
  { name: 'Reuniões', ... },
  { name: 'Projetos', ... }, // Nova posição
  ...
];
```

Apenas reordenar, sem alterar lógica.
