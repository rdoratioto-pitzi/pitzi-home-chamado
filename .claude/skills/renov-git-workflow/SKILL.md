---
name: renov-git-workflow
description: >
  Garante que todo o fluxo Git no Renov.Home siga os padroes definidos pelo time,
  desde o inicio da sessao ate a entrega do PR. Use esta skill SEMPRE ao iniciar
  uma sessao de desenvolvimento, ao criar branches, fazer commits, ou abrir PRs.
  Ativa automaticamente quando detectar comandos git, mencoes a "branch", "commit",
  "PR", "pull request", "push", "merge", "develop", "main", ou qualquer operacao
  de versionamento. Tambem ativa no inicio de cada sessao para validar o estado atual.
license: Apache-2.0
compatibility: Requires git, gh CLI
metadata:
  author: renov-home-team
  version: "1.0"
allowed-tools: Bash(git:*) Bash(gh:*) Read Grep
---

# Renov Git Workflow Enforcer

Skill que garante aderencia rigorosa ao Git Workflow do Renov.Home em todas as etapas.

## Inicio de Sessao — Checklist Automatico

Ao iniciar qualquer sessao de desenvolvimento, executar IMEDIATAMENTE:

### 1. Verificar branch atual

```bash
git branch --show-current
```

### 2. Validar estado

- Se estiver em `main`: **ALERTA** — nunca trabalhar em main. Trocar para develop.
- Se estiver em `develop`: OK para criar nova branch a partir daqui.
- Se estiver em branch de feature/fix: Verificar se foi criada a partir de develop:
  ```bash
  git log --oneline develop..HEAD | tail -5
  git merge-base --is-ancestor develop HEAD && echo "OK: branch parte de develop"
  ```

### 3. Garantir develop atualizado

```bash
git fetch origin develop
```

### 4. Reportar estado ao usuario

```
Estado Git:
- Branch atual: [nome]
- Origem: [develop/outra]
- Status: [limpo/modificacoes pendentes]
- Commits a frente de develop: [N]
```

## Criacao de Branch — Regras Obrigatorias

### Nomenclatura

Formato UNICO aceito: `tipo/descricao-curta`

| Tipo        | Quando usar                       | Exemplo                    |
| ----------- | --------------------------------- | -------------------------- |
| `feat/`     | Nova funcionalidade               | `feat/csv-export`          |
| `fix/`      | Correcao de bug                   | `fix/auth-token`           |
| `refactor/` | Refatoracao sem mudanca funcional | `refactor/storage-cleanup` |
| `docs/`     | Apenas documentacao               | `docs/api-reference`       |
| `test/`     | Testes                            | `test/estoque-e2e`         |
| `chore/`    | Manutencao, deps, configs         | `chore/upgrade-deps`       |

Se houver ticket Linear/GitHub, incluir o numero:

- `feat/REN-123-curva-abc`
- `fix/REN-456-filtro-duplicado`

### Validacao antes de criar

```bash
# 1. OBRIGATORIO: partir de develop
git checkout develop
git pull origin develop

# 2. Criar branch
git checkout -b tipo/descricao-curta
```

### Nomes INVALIDOS (bloquear)

- `feature-csv` — falta o `/` separador
- `fix` — sem descricao
- `Feature/algo` — tipo com maiuscula
- `feat/algo_com_underscore` — usar hifen, nao underscore
- Qualquer branch criada a partir de `main`

## Commits — Conventional Commits (PT-BR)

### Formato

```
tipo(escopo): descricao em portugues

[corpo opcional — explicar o "por que"]

[rodape opcional — referencias]
```

### Tipos de commit

| Tipo       | Descricao                          |
| ---------- | ---------------------------------- |
| `feat`     | Nova funcionalidade                |
| `fix`      | Correcao de bug                    |
| `refactor` | Refatoracao                        |
| `docs`     | Documentacao                       |
| `test`     | Testes                             |
| `chore`    | Manutencao                         |
| `style`    | Formatacao (sem mudanca de logica) |
| `perf`     | Melhoria de performance            |

### Escopo

O escopo deve refletir o modulo afetado:

- `estoques`, `tickets`, `pricing`, `auth`, `reunioes`, `dashboard`
- `omie`, `fiscal`, `relatorios`, `dispositivos`, `triagem`
- `ui`, `api`, `db`, `config`

### Exemplos corretos

```
feat(estoques): adiciona curva ABC por categoria
fix(tickets): corrige filtro de status duplicado
refactor(pricing): extrai logica de calculo para service
docs(api): documenta endpoints de triagem
chore(deps): atualiza dependencias do vite
```

### Exemplos ERRADOS (bloquear)

```
# Sem tipo
adiciona nova feature

# Em ingles (UI e commits devem ser em PT-BR)
fix(stocks): fix duplicated filter

# Tipo errado
feature(estoques): ...  (usar "feat", nao "feature")

# Sem escopo
fix: corrige bug  (especificar o modulo)

# Descricao vaga
fix(estoques): corrige problema  (qual problema?)
```

### Validacao pre-commit

Antes de cada commit, verificar:

1. Nenhum `console.log` esquecido nos arquivos modificados
2. Nenhum arquivo `.env` sendo commitado
3. TypeScript valido: `npm run check`
4. Mensagem segue Conventional Commits

```bash
# Verificar console.log nos arquivos staged
git diff --cached --name-only | xargs grep -l "console.log" 2>/dev/null

# Verificar .env
git diff --cached --name-only | grep -E "\.env"
```

## Pull Request — Padrao Obrigatorio

### Titulo do PR

Mesmo formato do commit principal:

```
tipo(escopo): descricao concisa em portugues
```

Exemplos:

- `feat(estoques): implementa curva ABC por categoria`
- `fix(tickets): corrige filtro de status duplicado`

### Corpo do PR — Template

```markdown
## O que foi feito

- [Bullet point descrevendo cada alteracao significativa]

## Issue relacionada

Closes #XX / REN-XX

## Como testar

1. Acessar http://localhost:5050
2. [Passos de reproducao]
3. [Resultado esperado]

## Screenshots (se aplicavel)

[Antes/depois para mudancas visuais]

## Checklist

- [ ] Branch criada a partir de `develop`
- [ ] Testado localmente em http://localhost:5050
- [ ] Sem `console.log` esquecidos
- [ ] Sem arquivos `.env` commitados
- [ ] Titulo segue Conventional Commits
- [ ] UI em PT-BR
- [ ] Multi-tenant (tenantId) respeitado
- [ ] Reviewer: @marcelo-maciel adicionado
```

### Regras do PR

1. **Base SEMPRE `develop`** — nunca `main`
2. **Reviewer obrigatorio: `marcelo-maciel`** (CTO Marcelo)
3. **Sem merge sem aprovacao** do Marcelo
4. Titulo em PT-BR seguindo Conventional Commits

### Criacao do PR

```bash
gh pr create --base develop \
  --title "tipo(escopo): descricao" \
  --body "[corpo seguindo template acima]" \
  --reviewer marcelo-maciel
```

## Validacao Continua

A cada operacao git durante a sessao, validar:

| Momento               | Validacao                                                     |
| --------------------- | ------------------------------------------------------------- |
| Inicio de sessao      | Branch atual, origem, estado                                  |
| Antes de criar branch | Estou em develop? develop esta atualizado?                    |
| Antes de commit       | console.log? .env? TypeScript? Formato da msg?                |
| Antes de push         | Branch tem nome valido? Commits seguem padrao?                |
| Antes de PR           | Base e develop? Reviewer marcelo-maciel? Template preenchido? |

## Alertas e Bloqueios

Se detectar violacao, **BLOQUEAR a operacao** e notificar:

```
BLOQUEIO GIT WORKFLOW

Operacao: [o que foi tentado]
Violacao: [qual regra foi violada]
Correcao: [como corrigir]
```

Violacoes criticas (bloquear sempre):

- Push em `main` ou `develop`
- Branch criada a partir de `main`
- PR com base em `main`
- Commit sem seguir Conventional Commits
- Merge sem aprovacao do CTO
