# 💾 Git Commit - Salvar alterações localmente

## O que faz?
Salva suas alterações no histórico local do Git. É como tirar uma "foto" do código naquele momento.

## Como usar:

### Commit simples com mensagem:
```bash
git commit -m "Mensagem do commit"
```

### Commit adicionando todos os arquivos modificados:
```bash
git commit -a -m "Mensagem do commit"
```

### Commit adicionando arquivos específicos:
```bash
git add nome-do-arquivo
git commit -m "Mensagem do commit"
```

### Commit com mensagem multilinha:
```bash
git commit -m "Título" -m "Descrição detalhada"
```

### Commit amend (corrigir último commit):
```bash
git commit --amend -m "Nova mensagem"
```

## 📝 Boas práticas de mensagem:

- Use o imperativo: "Add feature" não "Added feature"
- Primeira linha: até 50 caracteres
- Linha em branco
- Descrição: até 72 caracteres por linha
- O que mudou e por quê

## 💡 Dica - Fluxo rápido:
```bash
git status                    # ver o que mudou
git add .                     # adicionar tudo
git commit -m "Descrição"    # commitar
git push                      # enviar
```

## Comandos úteis antes do commit:

```bash
git status                    # Ver estado atual
git diff                      # Ver alterações
git diff --staged             # Ver staged (prontos para commit)
git restore --staged arquivo # Desfazer staging
```
