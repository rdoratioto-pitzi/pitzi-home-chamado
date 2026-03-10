# 🔀 Git Merge - Mesclar branches

## O que faz?
Une as alterações de um branch into outro. Geralmente usado para trazer uma feature para a branch principal.

## Como usar:

### Mesclar branch no atual:
```bash
git merge nome-da-branch
```

### Mesclar com estratégia de rebase (histórico limpo):
```bash
git merge --no-ff nome-da-branch  # força um commit de merge
git rebase nome-da-branch         # aplica commits um a um
```

### Abortar merge em caso de conflito:
```bash
git merge --abort
```

### Continuar merge após resolver conflitos:
```bash
git add arquivos-resolvidos
git merge --continue
```

## 📝 Boas práticas:

1. **Sempre atualize** o branch principal antes de mesclar:
   ```bash
   git checkout main
   git pull
   git checkout sua-branch
   git merge main
   ```

2. **Teste** antes de mesclar

3. **Use --no-ff** para manter histórico claro

## ⚠️ Conflitos?

Se houver conflitos:
1. Edite os arquivos com conflito
2. Use `git add arquivo` para marcar como resolvido
3. Complete o merge com `git commit`

## Ver diferença entre branches:
```bash
git diff main..sua-branch
```
