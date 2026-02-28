# 📖 Guia de Uso - Sistema Multi-Agentes

## 🎯 Workflow Completo

### Passo 1: Planejamento com Atlas
```bash
atlas
```

**Entrada:**
```
📝 Requisito:
> adicionar tooltip no botão de editar tarefa
```

**Saída:**
```
## Objetivo
Adicionar tooltip informativo no botão de editar tarefa

## Arquivos
- Frontend: TaskItem.tsx - adicionar componente Tooltip
- Frontend: Tooltip.tsx - criar componente reutilizável

## Fluxo
Hover no botão → Tooltip aparece → Exibe "Editar tarefa"

## Checklist
- [ ] Criar/importar componente Tooltip
- [ ] Envolver botão edit com Tooltip
- [ ] Definir texto "Editar tarefa"
```

**Opções:**
- `[s]` Aprovar → Salva plano
- `[r]` Refinar → Pede mais contexto e gera novo plano
- `[n]` Cancelar

---

### Passo 2: Implementação (Kilo Code)

1. Copiar plano do Atlas
2. Abrir Kilo Code
3. Colar plano
4. Aguardar implementação (~10-15 min)

---

### Passo 3: Teste Manual

**CRÍTICO:** Sempre teste antes de Turing!

- ✅ Funcionalidade funciona?
- ✅ UI está correta?
- ✅ Sem bugs visuais?
- ✅ Responsivo mobile OK?

---

### Passo 4: Validação com Turing
```bash
turing
```

**Entrada:**
```
📝 Requisito:
> adicionar tooltip no botão de editar tarefa
```

**Turing valida:**
1. ✅ Compilação TypeScript
2. ✅ ESLint (qualidade)
3. ✅ Erros de sintaxe

**Cenário A - Código OK:**
```
✅ APROVADO!

🌿 Giter executando...
  ✅ git add .
  ✅ git commit -m "feat: tooltip"
  ✅ git push
```

**Cenário B - Código com Erros:**
```
❌ REPROVADO

🤖 Chamando Atlas...
📋 PLANO DE CORREÇÃO:
[Atlas gera plano de correção]

💡 Cole este plano no Kilo Code
```

Se Turing reprovar:
1. Copiar plano de correção
2. Colar no Kilo Code
3. Aguardar correção
4. Executar `turing` novamente

---

## 💡 Dicas de Uso

### Requisitos Bons para Atlas

✅ **Específicos:**
- "adicionar botão exportar PDF na página tarefas"
- "mudar cor do badge prioridade alta para vermelho"

❌ **Muito vagos:**
- "melhorar interface"
- "adicionar funcionalidade"

### Quando Refinar ([r])

Use refinamento quando:
- ✅ Plano muito genérico
- ✅ Faltou detalhe técnico
- ✅ Abordagem diferente preferida

**Exemplo:**
```
Requisito original: "adicionar gráfico"
Refinamento: "usar biblioteca recharts, gráfico de barras, 
dados de vendas mensais"
```

### Erros Antigos vs Novos

**Turing valida TODO o código do projeto!**

Se existem erros antigos:
- Turing vai reprovar mesmo se nova feature está OK
- **Solução 1:** Corrigir erros antigos primeiro
- **Solução 2:** Commit manual só da nova feature
```bash
git add [arquivos específicos]
git commit -m "feat: nova feature"
git push
```

---

## 📊 Exemplos Reais

### Exemplo 1: Feature Simples (Sucesso)
```bash
$ atlas
Requisito: adicionar placeholder no input de busca

[Atlas gera plano]
[s] Aprovar

$ # Cola no Kilo Code, aguarda

$ turing
✅ APROVADO!
✅ Commit automático realizado
```

**Tempo total: 12 minutos**

---

### Exemplo 2: Feature com Correção
```bash
$ atlas
Requisito: adicionar validação de email

[Atlas gera plano]
[s] Aprovar

$ # Kilo implementa

$ turing
❌ REPROVADO - erro de tipo

[Atlas gera plano de correção]

$ # Cola correção no Kilo

$ turing
✅ APROVADO!
✅ Commit automático
```

**Tempo total: 18 minutos**
