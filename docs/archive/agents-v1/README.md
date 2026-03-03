# 🤖 Sistema Multi-Agentes - Renov Home

Sistema automatizado de planejamento, validação e deploy usando IA.

## 📊 Visão Geral
```
VOCÊ → Requisito
  ↓
ATLAS → Plano técnico enxuto (~150 tokens)
  ↓
KILO CODE → Implementação
  ↓
VOCÊ → Teste manual
  ↓
TURING → Validação (TypeScript + ESLint)
  ├─ ✅ OK → GITER → Commit + Push automático
  └─ ❌ Erros → ATLAS → Plano de correção
```

## 🎯 Agentes Disponíveis

| Agente | Função | Comando |
|--------|--------|---------|
| **Atlas** | Planejador técnico | `atlas` ou `agents` |
| **Turing** | Validador QA + Auto-correção | `turing` |
| **Giter** | Automação Git (commit/push) | (executa com Turing) |

## ⚡ Uso Rápido
```bash
# 1. Planejar feature
atlas

# 2. Copiar plano → Colar no Kilo Code

# 3. Após Kilo implementar e você testar
turing

# 4. Se aprovado, Giter faz commit automático
```

## 📖 Documentação Detalhada

- [Instalação e Setup](./SETUP.md)
- [Guia de Uso](./GUIA-USO.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Arquitetura](./ARQUITETURA.md)

## 📊 Métricas

- **Tempo por feature:** 15-20 min (vs 2-4h manual)
- **Economia:** ~R$ 800/feature
- **Precisão Atlas:** 95% de planos aprovados
- **Taxa aprovação Turing:** 85%
