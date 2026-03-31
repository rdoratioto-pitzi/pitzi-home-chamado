---
name: renov-security
description: >
  Auditoria de segurança customizada para o Renov.Home (Express + React 18).
  Executa varredura de credenciais, analisa o diff do branch, verifica
  branch/repo correto e emite relatorio com status. Usar OBRIGATORIAMENTE
  antes de abrir qualquer PR no projeto Home.
  Status possiveis: APROVADO, APROVADO COM RESSALVAS, BLOQUEADO.
license: Apache-2.0
compatibility: Requires git, gh CLI, npm
metadata:
  author: renov-home-team
  version: "2.0"
  changelog: "v2.0 — 31/03/2026: Adicionada Fase 0 Supply Chain Check (axios incident)"
allowed-tools: Bash(git:*) Bash(gh:*) Bash(cat:*) Bash(grep:*) Bash(npm:*) Bash(ls:*) Read Grep
---

# Renov Security Audit Skill

Skill de auditoria de segurança do Renov.Home. Deve ser executada ANTES de todo PR.

## Como usar

```
Use a skill renov-security para auditar este PR — projeto Home, branch develop
```

---

## FASE 0 — Supply Chain Check (npm)

> Motivação: ataque axios@1.14.1 em 31/03/2026 — dependência maliciosa
> injetada via conta comprometida de mantenedor npm.
> Esta fase deve rodar ANTES de qualquer análise de código.

### 0.1 — Verificar .npmrc
```bash
cat .npmrc 2>/dev/null | grep "min-release-age" || echo "⚠️ AUSENTE: min-release-age não configurado"
```

Status esperado: `min-release-age=7` presente no arquivo.
Se ausente → status ⚠️ RESSALVAS, incluir no relatório.

### 0.2 — Detectar versões comprometidas conhecidas

Verificar se package.json ou package-lock.json contém versões na lista negra:
```bash
# Lista negra — versões confirmadas maliciosas (atualizar conforme novos incidentes)
BLACKLIST=(
  "axios@1.14.1"
  "axios@0.30.4"
  "plain-crypto-js"
)

for pkg in "${BLACKLIST[@]}"; do
  name=$(echo $pkg | cut -d@ -f1)
  version=$(echo $pkg | cut -d@ -f2)
  if grep -r "\"$name\"" package.json package-lock.json 2>/dev/null | grep -q "${version:-$name}"; then
    echo "🚨 BLOQUEADO: $pkg encontrado"
  fi
done
```

Se qualquer item da lista negra for encontrado → status 🚨 BLOQUEADO imediato.
PR não deve prosseguir. Escalar para Matheus.

### 0.3 — Detectar dependências novas no diff

Se este audit está sendo executado em contexto de PR, verificar se
package.json foi alterado e se há dependências adicionadas:
```bash
git diff develop...HEAD -- package.json | grep "^+" | grep -v "^+++" | grep -E '"[^"]+": "[^"]+"'
```

Para cada dependência nova encontrada no diff:
- Verificar data de publicação via: `npm view <pacote> time.created`
- Se publicado há menos de 7 dias → ⚠️ RESSALVAS com alerta explícito
- Incluir no relatório: nome do pacote, versão, data de publicação, idade em dias

### 0.4 — Verificar integridade do node_modules
```bash
# Detectar presença de pacotes não declarados no package.json
# (sinal de dependência transitiva maliciosa instalada)
ls node_modules/ | while read pkg; do
  if ! grep -q "\"$pkg\"" package.json 2>/dev/null; then
    # Verificar se é dependência transitiva legítima
    npm ls "$pkg" 2>/dev/null | grep -q "$pkg" || echo "⚠️ Pacote não rastreado: $pkg"
  fi
done
```

Nota: Este check é indicativo — dependências transitivas legítimas são normais.
Reportar apenas pacotes completamente fora da árvore de dependências.

### Status da Fase 0

Consolidar resultado:
- 🚨 BLOQUEADO → se qualquer item da lista negra for encontrado
- ⚠️ RESSALVAS → se .npmrc sem min-release-age OU dependência nova com menos de 7 dias
- ✅ APROVADO → todos os checks passaram

---

## FASE 1 — Varredura de Credenciais

### 1.1 — Verificar segredos hardcoded no diff

```bash
git diff develop...HEAD | grep -E "(password|secret|api_key|apikey|token|private_key|credential)" -i | grep "^+" | grep -v "^+++"
```

Se encontrar → listar ocorrências, status 🚨 BLOQUEADO.

### 1.2 — Verificar arquivos .env no diff

```bash
git diff develop...HEAD --name-only | grep -E "\.env"
```

Se qualquer `.env` aparecer → status 🚨 BLOQUEADO imediato.

### 1.3 — Verificar console.log esquecidos

```bash
git diff develop...HEAD | grep "^+" | grep "console\.log" | grep -v "^+++"
```

Se encontrar → listar, status ⚠️ RESSALVAS.

### Status da Fase 1

- 🚨 BLOQUEADO → credenciais hardcoded ou .env commitado
- ⚠️ RESSALVAS → console.log encontrado
- ✅ APROVADO → nenhum problema

---

## FASE 2 — Análise do Diff

### 2.1 — Verificar branch e repo corretos

```bash
git branch --show-current
git remote get-url origin
```

- Branch deve seguir padrão: `feat/`, `fix/`, `refactor/`, `chore/`, `hotfix/`
- Remote deve ser `https://github.com/Renov-BD/Renov.Home.git`
- Se não → status ⚠️ RESSALVAS

### 2.2 — Verificar tamanho do diff

```bash
git diff develop...HEAD --stat
```

Reportar: arquivos alterados, inserções, deleções.
Se mais de 500 linhas alteradas → ⚠️ RESSALVAS (diff grande, revisão cuidadosa necessária).

### 2.3 — Verificar multi-tenant

```bash
git diff develop...HEAD | grep "^+" | grep -E "\.where\(" | grep -v "tenantId"
```

Queries sem `tenantId` → ⚠️ RESSALVAS.

### 2.4 — Verificar dual runtime (Express + Worker Hono)

```bash
git diff develop...HEAD --name-only | grep "server/routes/"
```

Para cada rota nova/modificada em `server/routes/`, verificar se existe espelho em `worker/src/routes/`.
Se ausente → ⚠️ RESSALVAS (causará 404 em produção).

### Status da Fase 2

- 🚨 BLOQUEADO → repo/branch errado
- ⚠️ RESSALVAS → diff grande, query sem tenantId, rota sem espelho no worker
- ✅ APROVADO → tudo conforme padrões

---

## FASE 3 — Relatório Final

### Consolidar status geral

Regras de prioridade:
1. Se qualquer fase retornou 🚨 BLOQUEADO → status geral = 🚨 BLOQUEADO
2. Se qualquer fase retornou ⚠️ RESSALVAS → status geral = ⚠️ APROVADO COM RESSALVAS
3. Caso contrário → ✅ APROVADO

### Formato do relatório

```
========================================
🔒 RENOV SECURITY AUDIT — v2.0
Branch: <branch>
Data: <data>
========================================

FASE 0 — Supply Chain Check: <status>
  <detalhes se houver>

FASE 1 — Credenciais: <status>
  <detalhes se houver>

FASE 2 — Análise do Diff: <status>
  <detalhes se houver>

========================================
STATUS GERAL: <STATUS FINAL>
========================================

<instruções baseadas no status>
```

### Instruções por status

**✅ APROVADO:**
> PR pode ser aberto normalmente. Adicionar reviewer: @marcelo-maciel

**⚠️ APROVADO COM RESSALVAS:**
> PR pode prosseguir. Informar Marcelo sobre as ressalvas no corpo do PR.
> Adicionar reviewer: @marcelo-maciel

**🚨 BLOQUEADO:**
> NÃO abrir o PR. Corrigir os itens críticos listados acima.
> Escalar para Matheus se necessário. Re-executar audit após correções.
