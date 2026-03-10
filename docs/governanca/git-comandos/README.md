# 📚 Comandos GitHub - Guia Completo

## 🚀 Comece Aqui

Este guia contém todos os comandos essenciais do Git para trabalhar com o repositório Renov.Home.

---

## 📚 Ordem de Leitura Recomendada

1. **00-regras-seguranca.md** ⚠️ LEIA PRIMEIRO!
2. 05-status.md (verificar estado)
3. 01-pull.md (atualizar antes de trabalhar)
4. 03-commit.md (salvar mudanças)
5. 02-push.md (enviar para repositório)
6. 04-branch.md (trabalhar em features)
7. 06-merge.md (integrar mudanças)
8. 07-log.md (ver histórico)
9. 08-stash.md (guardar mudanças temporariamente)

---

## � Índice de Comandos

| # | Comando | Arquivo | Descrição |
|---|---------|---------|-----------|
| 1 | **Pull** | [01-pull.md](01-pull.md) | Baixar alterações do GitHub |
| 2 | **Push** | [02-push.md](02-push.md) | Enviar alterações para o GitHub |
| 3 | **Commit** | [03-commit.md](03-commit.md) | Salvar alterações localmente |
| 4 | **Branch** | [04-branch.md](04-branch.md) | Criar e gerenciar ramificações |
| 5 | **Status** | [05-status.md](05-status.md) | Ver estado do repositório |
| 6 | **Merge** | [06-merge.md](06-merge.md) | Mesclar branches |
| 7 | **Log** | [07-log.md](07-log.md) | Ver histórico de commits |
| 8 | **Stash** | [08-stash.md](08-stash.md) | Guardar alterações temporariamente |

---

## ⚡ Comandos Rápidos (Aliases Configurados)

| Alias | Comando Original | Descrição |
|-------|-------------------|-----------|
| `git st` | `git status` | Ver estado |
| `git co` | `git checkout` | Mudar de branch |
| `git br` | `git branch` | Listar branches |
| `git ci` | `git commit` | Salvar alterações |
| `git df` | `git diff` | Ver diferenças |
| `git lg` | `git log --oneline --graph --decorate --all` | Histórico visual |
| `git last` | `git log -1 HEAD` | Último commit |
| `git unstage` | `git reset HEAD --` | Remover do staging |

---

## 🔄 Fluxo de Trabalho Padrão

```bash
# 1. Verificar estado
git status

# 2. Atualizar código
git pull

# 3. Criar/ir para branch de trabalho
git checkout -b minha-feature

# 4. Fazer alterações...
# ... edits ...

# 5. Verificar o que mudou
git status
git diff

# 6. Adicionar arquivos
git add .              # todos
# ou
git add arquivo.html  # específico

# 7. Commitar
git commit -m "Descrição da alteração"

# 8. Enviar para GitHub
git push -u origin minha-feature
```

---

## 🔧 Configurações SSH

O SSH já está configurado. Para testar a conexão:

```bash
ssh -T git@github.com
```

Resposta esperada: `Hi Renov-BD! You've successfully authenticated...`

---

## 📞 Comandos Essenciais do Dia a Dia

```bash
# Ver código atual
git status
git lg

# Atualizar
git pull

# Salvar e enviar
git add .
git commit -m "Mensagem"
git push

# Ver branches
git branch
git branch -a

# Mudar de branch
git checkout nome-branch

# Criar nova branch
git checkout -b nome-nova-branch
```

---

## ℹ️ Informações do Repositório

- **Remote**: git@github.com:Renov-BD/Renov.Home.git
- **SSH**: ✅ Configurado
- **Aliases**: ✅ Configurados
