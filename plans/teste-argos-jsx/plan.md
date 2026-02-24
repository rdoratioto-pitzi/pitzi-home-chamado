# Teste Argos V3 - Validação JSX

Teste simples para validar se Argos V3 detecta erros de sintaxe JSX.

## PROMPT 1: Criar Card Simples

Criar componente: client/src/components/test-card.tsx

Componente de card simples com props:
```tsx
interface TestCardProps {
  title: string;
  description: string;
  onClick: () => void;
}
```

Requisitos:
- Usar shadcn/ui Card
- Botão com onClick
- Badge com variant
- Link com href

Stack:
- shadcn/ui: Card, Button, Badge
- Wouter: Link
- lucide-react: ArrowRight

IMPORTANTE:
- Usar //ARQUIVO: client/src/components/test-card.tsx
- Componente funcional completo
- Export named: export { TestCard }
