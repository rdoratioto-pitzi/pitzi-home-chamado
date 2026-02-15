# 📤 Git Push - Enviar alterações para o repositório remoto

## O que faz?
Envia seus commits locais para o repositório remoto (GitHub).

## Como usar:

### Push simples (envia para o branch atual):
```bash
git push
```

### Push para branch específica:
```bash
git push origin nome-da-branch
```

### Push e definir branch upstream (na primeira vez):
```bash
git push -u origin nome-da-branch
```

### Push forçado (use com cautela!):
```bash
git push -f origin nome-da-branch
```

### Push de todos os branches:
```bash
git push --all origin
```

### Push de tags:
```bash
git push origin --tags
```

## ⚠️ Atenção:
- Sempre faça **commit** das alterações antes de fazer push
- Evite `push -f` em branches compartilhados
- Verifique se está no branch correto com `git status`

## 💡 Dica:
Configure o upstream padrão para evitar pedir sempre:
```bash
git config --global push.default current
```
