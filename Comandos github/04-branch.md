# 🌿 Git Branch - Ramificações do código

## O que faz?
Cria, lista e gerencia ramificações do seu código. Permite trabalhar em funcionalidades isoladas.

## Como usar:

### Listar branches (local):
```bash
git branch
```

### Listar todos os branches (local + remoto):
```bash
git branch -a
```

### Criar um novo branch:
```bash
git branch nome-da-branch
```

### Criar e mudar para novo branch:
```bash
git checkout -b nome-da-branch
# ou
git switch -c nome-da-branch
```

### Mudar para um branch existente:
```bash
git checkout nome-da-branch
# ou
git switch nome-da-branch
```

### Renomear branch:
```bash
git branch -m nome-antigo nome-novo
```

### Deletar branch local:
```bash
git branch -d nome-da-branch
```

### Deletar branch remoto:
```bash
git push origin --delete nome-da-branch
```

### Ver último commit de cada branch:
```bash
git branch -v
```

### Ver branches mesclados (que podem ser deletados):
```bash
git branch --merged
```

## 💡 Dicas úteis:

### Baixar branch do remoto:
```bash
git fetch origin
git checkout nome-da-branch
```

### Ver branch atual:
```bash
git branch --show-current
```

### Criar branch a partir de commit específico:
```bash
git branch nome-nova-branch hash-do-commit
```

### Enviar branch para remoto:
```bash
git push -u origin nome-da-branch
```
