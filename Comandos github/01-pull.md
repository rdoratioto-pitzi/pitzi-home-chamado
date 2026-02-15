# 📥 Git Pull - Baixar alterações do repositório remoto

## O que faz?
Baixa e aplica todas as alterações do repositório remoto (GitHub) para seu repositório local.

## Como usar:

### Pull simples (baixa e mescla automaticamente):
```bash
git pull
```

### Pull com rebase (mantém histórico linear):
```bash
git pull --rebase
```

### Pull de branch específica:
```bash
git pull origin nome-da-branch
```

### Pull de todos os branches:
```bash
git pull --all
```

## ⚠️ Atenção:
- Sempre faça **commit** ou **stash** das suas alterações antes de fazer pull
- Se houver conflitos, resolva manualmente e faça commit

## 💡 Dica:
Use `git fetch` antes de `git pull` para ver as alterações sem aplicá-las:
```bash
git fetch origin
git log HEAD..origin/main  # ver diferenças
git pull  # aplicar
```
