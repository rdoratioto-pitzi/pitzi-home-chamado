# 📦 Git Stash - Guardar alterações temporariamente

## O que faz?
Salva alterações não commitadas temporariamente para poder mudar de branch ou puxar alterações.

## Como usar:

### Guardar alterações (stash):
```bash
git stash
```

### Guardar com mensagem:
```bash
git stash push -m "Mensagem descriptiva"
```

### Listar stashes:
```bash
git stash list
```

### Aplicar último stash (mantém stash):
```bash
git stash apply
```

### Aplicar stash específico:
```bash
git stash apply stash@{2}
```

### Aplicar e remover último stash:
```bash
git stash pop
```

### Criar branch a partir de stash:
```bash
git stash branch nome-da-branch
```

### Descartar último stash:
```bash
git stash drop
```

### Limpar todos os stashes:
```bash
git stash clear
```

## 💡 Quando usar:

- Precisa mudar de branch sem fazer commit
- Quer testar algo sem perder alterações atuais
- Precisa fazer pull e tem alterações locais

## Ver conteúdo de um stash:
```bash
git stash show -p stash@{0}
```
