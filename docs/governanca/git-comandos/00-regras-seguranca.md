# ❌ NUNCA COMMITAR

## Arquivos de Ambiente
- `.env` (TODAS as variações)
- `.env.local`
- `.env.development`
- `.env.production`
- Qualquer arquivo com senhas/tokens/API keys

## Dependências e Build
- `node_modules/`
- `dist/`, `.next/`, `build/`
- `.cache/`, `.parcel-cache/`

## Dados Sensíveis
- `uploads/` (arquivos de usuários)
- Arquivos com dados de produção
- Logs com informações sensíveis

## ✅ SEMPRE VERIFICAR ANTES DE COMMIT
```bash
git status          # Ver o que será commitado
git diff            # Ver mudanças linha a linha
git diff --staged   # Ver o que está no stage
```

## 🔒 COMANDOS SEGUROS
```bash
# NUNCA faça isso:
git add .           # Pode adicionar .env acidentalmente

# SEMPRE faça assim:
git add arquivo1 arquivo2  # Adicione arquivos específicos
git add -p         # Adicione interativamente (revisa cada mudança)
```

## 🚨 SE COMMITOU .env POR ENGANO
```bash
# Se ainda não fez push:
git reset HEAD~1   # Desfaz último commit, mantém mudanças
git reset --soft HEAD~1  # Desfaz commit, mantém stage

# Se já fez push:
# 1. Troque TODAS as senhas/tokens imediatamente
# 2. Considere usar git filter-branch ou BFG Repo Cleaner
# 3. Force push (perigoso, use com cuidado)