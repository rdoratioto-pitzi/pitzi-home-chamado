# ⚙️ Instalação e Configuração

## 📋 Pré-requisitos

- ✅ Node.js v18+
- ✅ Git configurado
- ✅ Acesso ao projeto Renov.Home
- ✅ API Key Anthropic (Claude)

## 🚀 Instalação

### 1. Navegar para pasta agents
```bash
cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar .env
```bash
cp .env.example .env
```

Editar `.env` e adicionar:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx  # Opcional
```

### 4. Criar aliases (comandos simplificados)
```bash
# Adicionar ao ~/.zshrc
cat >> ~/.zshrc << 'ALIASES'

# Renov Agents
alias agents='cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents && npm run agents'
alias atlas='cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents && npm run agents'
alias turing='cd ~/Documents/Workspaces/Renov-Home2/Renov.Home/agents && npm run qa-git'
ALIASES

source ~/.zshrc
```

### 5. Testar instalação
```bash
atlas
```

Se aparecer o menu, instalação OK! ✅

## 🔧 Estrutura de Arquivos
```
agents/
├── src/
│   ├── agents/
│   │   ├── atlas.ts      # Planejador
│   │   ├── turing.ts     # Validador QA
│   │   └── giter.ts      # Automação Git
│   ├── types/
│   │   └── agent-state.ts
│   ├── orchestrator.ts
│   ├── config.ts
│   └── index.ts
├── .planos/              # Planos salvos
├── package.json
└── .env
```

## ⚠️ Problemas Comuns

### Terminal cai em "dquote>"

**Causa:** Aspas não fechadas  
**Solução:** `Ctrl + C` e execute comando novamente

### "Missing script: agents"

**Causa:** Não está na pasta agents  
**Solução:** `cd ~/Documents/.../Renov.Home/agents`

### Alias não funciona

**Causa:** Não recarregou .zshrc  
**Solução:** `source ~/.zshrc`
