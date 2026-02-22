# 🤖 Renov Agents - Sistema Multi-Agentes

Sistema de agentes de IA para desenvolvimento automatizado do Renov Home.

## 🎭 Agentes

- **Atlas** 🗺️ - Planejador estratégico
- **Neo** 💻 - Implementador de código
- **Ada** 🔍 - Revisora de qualidade
- **Linus** 🌿 - Gerenciador Git (em desenvolvimento)

## 🚀 Como Usar

### 1. Executar Agentes
```bash
npm run agents
```

### 2. Workflow

1. **Você descreve** o requisito
2. **Atlas** cria plano detalhado
3. **Você aprova** o plano
4. **Neo** gera prompts para Kilo Code
5. **Você cola** os prompts no Kilo Code
6. **Ada** revisa o código
7. **Você testa** e commita

## 📁 Estrutura
```
agents/
├── src/
│   ├── agents/          # Atlas, Neo, Ada
│   ├── config/          # Configurações
│   ├── types/           # TypeScript types
│   └── utils/           # Utilitários
├── logs/                # Histórico de execuções
└── .env                 # Credenciais (não versionar!)
```

## 🔐 Configuração

Edite `.env`:
```
ANTHROPIC_API_KEY=sua_key
GITHUB_TOKEN=seu_token
GITHUB_REPO=usuario/repo
```

## 📝 Logs

Todas as execuções são salvas em `logs/` para referência futura.

## 🎯 Próximas Funcionalidades

- [ ] Agente Linus (automação Git)
- [ ] Interface web
- [ ] Histórico de conversas
- [ ] Templates de requisitos
