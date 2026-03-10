# 📊 Git Status - Ver estado do repositório

## O que faz?
Mostra o estado atual do repositório: arquivos modificados, prontos para commit, etc.

## Como usar:

### Ver estado geral:
```bash
git status
```

### Ver estado resumido:
```bash
git status -s
# ou
git status --short
```

### Ver estado ignorando arquivos ignorados:
```bash
git status --ignored
```

## Entendendo os status:

| Símbolo | Significado |
|---------|-------------|
| `M` | Arquivo modificado |
| `A` | Arquivo novo (staged) |
| `D` | Arquivo deletado |
| `R` | Arquivo renomeado |
| `C` | Arquivo copiado |
| `U` | Arquivo com conflito |
| `??` | Arquivo não rastreado (novo) |
| `!!` | Arquivo ignorado |

## 💡 Dica - Alias útil:
```bash
git config --global alias.s "status -s"
# Agora use: git s
```
