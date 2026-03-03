# Git Workflow - Max AI

## 🚨 REGRAS CRÍTICAS

### REGRA #1: SEMPRE PARTIR DE DEVELOP
```bash
# ❌ NUNCA FAZER
git checkout main
git checkout -b feature/nova

# ✅ SEMPRE FAZER
git checkout develop
git pull origin develop
git checkout -b feat/nova
```

### REGRA #2: NOMENCLATURA
Formato: tipo/descricao-curta

Tipos válidos:
- feat/ - Nova feature
- fix/ - Correção de bug
- refactor/ - Refatoração
- docs/ - Documentação
- test/ - Testes
- chore/ - Manutenção

Exemplos corretos:
- feat/csv-export
- fix/auth-token
- docs/api-reference

Exemplos ERRADOS:
- feature-csv (sem tipo/)
- fix (sem descrição)
- partindo-de-main (branch errada!)

### REGRA #3: FLUXO COMPLETO
```bash
# 1. SEMPRE começar de develop
git checkout develop
git pull origin develop

# 2. Criar branch
git checkout -b feat/nome-descritivo
