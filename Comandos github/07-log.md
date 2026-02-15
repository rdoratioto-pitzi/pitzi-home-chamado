# 📜 Git Log - Histórico de commits

## O que faz?
Mostra o histórico de commits do repositório.

## Como usar:

### Ver histórico simples:
```bash
git log
```

### Ver histórico resumido (uma linha por commit):
```bash
git log --oneline
```

### Ver histórico com gráfico:
```bash
git log --oneline --graph --decorate --all
```

### Ver últimos N commits:
```bash
git log -n 5
# ou
git log -5
```

### Ver alterações de um arquivo:
```bash
git log -p nome-do-arquivo
```

### Ver commits de um autor:
```bash
git log --author="nome"
```

### Ver commits de uma data:
```bash
git log --after="2024-01-01"
git log --before="2024-12-31"
```

### Ver estatísticas de cada commit:
```bash
git log --stat
```

### Ver diff de um commit específico:
```bash
git show hash-do-commit
```

## 💡 Dica - Alias útil:
```bash
git config --global alias.lg "log --oneline --graph --decorate --all"
# Agora use: git lg
```
