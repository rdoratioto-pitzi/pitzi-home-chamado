# Renomear Módulo: Macgyver IA → Chat IA Renov

Alterar nome do módulo em todos os lugares.

## PROMPT 1: Atualizar Menu Lateral

Arquivo: client/src/components/app-sidebar.tsx

Encontrar item do menu "Macgyver IA" e alterar para "Chat IA Renov":

ANTES:
```typescript
{
  title: "Macgyver IA",
  url: "/macgyver-ia",
  icon: Bot,
  module: null,
}
```

DEPOIS:
```typescript
{
  title: "Chat IA Renov",
  url: "/macgyver-ia",  // URL mantém igual
  icon: Bot,
  module: null,
}
```

IMPORTANTE:
- Usar //ARQUIVO: client/src/components/app-sidebar.tsx
- Retornar arquivo COMPLETO
- Alterar APENAS o title (não mexer na URL)
- Manter todo o resto idêntico

## PROMPT 2: Atualizar Título da Página

Arquivo: client/src/pages/macgyver-ia/index.tsx

Alterar título da página de "Macgyver IA" para "Chat IA Renov".

Procurar por:
- Títulos H1 ou H2 com "Macgyver"
- Metadata com "Macgyver"
- Breadcrumbs com "Macgyver"

Substituir por "Chat IA Renov".

IMPORTANTE:
- Usar //ARQUIVO: client/src/pages/macgyver-ia/index.tsx
- Retornar arquivo COMPLETO
- Alterar apenas textos visíveis
- Manter toda lógica intacta
