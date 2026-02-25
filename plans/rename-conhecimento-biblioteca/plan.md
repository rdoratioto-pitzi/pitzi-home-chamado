# Renomear: Base de Conhecimento → Biblioteca

Alterar nome do módulo em todos os lugares visíveis ao usuário.

## PROMPT 1: Atualizar Menu Lateral

Arquivo: client/src/components/app-sidebar.tsx

Encontrar item do menu "Base de Conhecimento" e alterar para "Biblioteca":

ANTES:
```typescript
{
  title: "Base de Conhecimento",
  url: "/conhecimento",
  ...
}
```

DEPOIS:
```typescript
{
  title: "Biblioteca",
  url: "/conhecimento",
  ...
}
```

IMPORTANTE:
- Usar DIFF (arquivo >200 linhas)
- Alterar APENAS o title
- Manter URL e ícone iguais

## PROMPT 2: Atualizar Título da Página

Arquivo: client/src/pages/conhecimento/index.tsx

Alterar:
- PageHeader title: "Base de Conhecimento" → "Biblioteca"
- Breadcrumb: "Base de Conhecimento" → "Biblioteca"
- Description pode manter

IMPORTANTE:
- Usar DIFF (arquivo ~166 linhas)
- Alterar apenas títulos visíveis
- Manter toda lógica intacta
