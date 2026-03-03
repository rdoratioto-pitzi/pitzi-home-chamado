# 🔧 Troubleshooting

## ❌ Problemas Comuns e Soluções

### 1. Turing Sempre Reprova (Erros Antigos)

**Sintoma:**
```
❌ REPROVADO
Compilação: ❌
client/src/pages/chamados/ticket-detail-sheet.tsx(123,45): error...
```

**Causa:** Projeto tem erros TypeScript antigos não relacionados à sua feature

**Solução A - Corrigir Erros Antigos:**
```bash
# Ver todos os erros
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home
npx tsc --noEmit

# Cola no Kilo para corrigir todos
turing  # Depois de correção
```

**Solução B - Commit Manual:**
```bash
git add [apenas arquivos da sua feature]
git commit -m "feat: sua feature"
git push
```

---

### 2. Atlas Gera Planos Muito Longos

**Sintoma:** Plano com 10+ páginas, muitos cenários de teste

**Causa:** Atlas V3 não está sendo usado

**Solução:**
```bash
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents
cat src/agents/atlas.ts | grep "maxTokens"

# Deve mostrar: maxTokens: 300
# Se não, recriar Atlas:
```

[Comandos de correção...]

---

### 3. Giter Não Executa

**Sintoma:** Turing aprova mas Giter não faz commit

**Causa:** Turing não retornou `qaAprovado: true`

**Diagnóstico:**
```bash
# Ver último log do Turing
# Deve ter: ✅ APROVADO!
```

**Solução:** Verificar orquestrador

---

### 4. "Cannot find module"

**Sintoma:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
```

**Causa:** TypeScript não compilado ou import incorreto

**Solução:**
```bash
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents
npm install
npm run build  # Se existir
```

---

### 5. API Rate Limit (Anthropic)

**Sintoma:**
```
Error: Rate limit exceeded
```

**Causa:** Muitas chamadas ao Claude em pouco tempo

**Solução:**
- Aguardar 1 minuto
- Reduzir número de refinamentos
- Verificar plano tier da API

---

### 6. Terminal Trava em "dquote>"

**Sintoma:** Terminal fica aguardando input após comando

**Causa:** Heredoc com aspas não fechadas

**Solução:**
```bash
# Pressionar Ctrl + C
# OU digitar ' e Enter
# OU fechar terminal e abrir novo
```

---

## 🐛 Debug Avançado

### Ver Logs Detalhados
```bash
# Turing com erros completos
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home
npx tsc --noEmit 2>&1 | tee typescript-errors.log
```

### Testar Agente Isoladamente
```bash
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents

# Testar Atlas
npm run agents

# Testar Turing isolado
node -e "import('./src/agents/turing.js').then(async (m) => { 
  await m.turing({ requisito: 'teste' }); 
});"
```

### Verificar Configuração
```bash
# Verificar .env
cat .env | grep ANTHROPIC

# Verificar aliases
alias | grep agents

# Verificar scripts npm
npm run
```

---

## 📞 Suporte

Se o problema persistir:

1. Verificar documentação: `docs/agents/`
2. Ver exemplos: `docs/agents/GUIA-USO.md`
3. Contatar: matheus@renov.com.br
