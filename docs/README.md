# Documentação Renov Home

**🔗 Repositório:** https://github.com/renov-tech/renov-home

> **Para IAs/Assistentes:** Esta é a documentação central do projeto Renov Home. Sempre referencie estes documentos ao iniciar conversas sobre o projeto.

---

## 📚 Índice Rápido

### 🚀 Início Rápido
- **[QUICK-START.md](QUICK-START.md)** - Para novos devs ou novos chats com IA

### 📖 Documentação Core
- **[00-CONTEXTO.md](00-CONTEXTO.md)** - Empresa, missão, filosofia "Vibe Coding"
- **[01-ARQUITETURA.md](01-ARQUITETURA.md)** - Stack técnico completo
- **[02-MODULOS.md](02-MODULOS.md)** - Overview de todos os módulos
- **[03-GOVERNANCA.md](03-GOVERNANCA.md)** - Git workflow, PRs, code review
- **[04-APIS-INTEGRACAO.md](04-APIS-INTEGRACAO.md)** - Integrações externas

### 🧩 Módulos Específicos
- **[Tickets](modulos/tickets.md)** - Sistema de suporte técnico
- **[Projects](modulos/projects.md)** - Gestão de projetos Kanban
- **[Meetings](modulos/meetings.md)** ⚠️ *Bug conhecido: recurring meetings*
- **[Chat IA](modulos/macgyver-ai.md)** 🚧 *Em desenvolvimento ativo - PRIORIDADE*
- **[Logistics](modulos/logistics.md)** - Rastreamento operacional
- **[Pricing](modulos/pricing.md)** - Monitoramento de preços
- **[Knowledge Base](modulos/knowledge-base.md)** - Base de conhecimento
- **[Business Intelligence](modulos/business-intelligence.md)** - Dashboards e métricas

### 📋 Recursos Adicionais
- **[CHANGELOG.md](CHANGELOG.md)** - Histórico de mudanças
- **[ROADMAP.md](ROADMAP.md)** - Planejamento futuro

---

## 🎯 Como Usar Esta Documentação

### Para Desenvolvedores
1. Leia primeiro [QUICK-START.md](QUICK-START.md)
2. Consulte [01-ARQUITETURA.md](01-ARQUITETURA.md) para entender o stack
3. Para trabalhar em um módulo específico, veja `/docs/modulos/[nome-modulo].md`

### Para IAs/Assistentes (Claude, ChatGPT, etc.)
```markdown
📋 Template de Início de Chat:

Projeto: Renov Home
📂 Docs: /docs/README.md
🔗 Repo: github.com/renov-tech/renov-home
🎯 Objetivo: [descrever tarefa específica]
```

**Sempre:**
- Referencie esta documentação antes de responder
- Stack completo em: [01-ARQUITETURA.md](01-ARQUITETURA.md)
- Para módulos específicos: [/docs/modulos/](modulos/)
- Repositório conectado via GitHub

---

## 📌 Informações Essenciais

### Stack Principal
- **Frontend:** React 18 + TypeScript
- **Backend:** Express.js + Node.js
- **Database:** PostgreSQL
- **Deploy:** GitHub Codespaces (em transição)
- **Control:** Git/GitHub com branch protection

### Time Core
| Nome | Papel | Responsabilidade Principal |
|------|-------|---------------------------|
| Matheus | CEO/Tech Lead | Estratégia, produto, inovação |
| Marcelo | CTO | Arquitetura, code review (aprovador) |
| Átila | Senior Developer | Features, infraestrutura |
| Juan | Intern Developer | Dashboards Python, tasks |

### Workflow Git
- **Branch principal:** `main` (protegida)
- **Desenvolvimento:** `develop`
- **Features:** `feature/nome-feature`
- **PRs obrigatórios** com aprovação do Marcelo

---

## 🆘 Precisa de Ajuda?

### Dúvidas Comuns
- **Como funciona o módulo X?** → `/docs/modulos/[nome-modulo].md`
- **Qual a stack usada?** → [01-ARQUITETURA.md](01-ARQUITETURA.md)
- **Como é o processo de desenvolvimento?** → [03-GOVERNANCA.md](03-GOVERNANCA.md)
- **Quais integrações temos?** → [04-APIS-INTEGRACAO.md](04-APIS-INTEGRACAO.md)

### Contato
- **Issues técnicas:** GitHub Issues no repositório
- **Dúvidas gerais:** Time interno

---

## 📝 Manutenção desta Documentação

**Quando atualizar:**
- ✅ Ao adicionar novo módulo
- ✅ Ao mudar stack/tecnologia
- ✅ Ao implementar nova integração
- ✅ Ao descobrir bugs importantes
- ✅ Ao finalizar features relevantes

**Responsável:** Toda a equipe (revisor principal: Marcelo)

---

**Última atualização:** Fevereiro 2026  
**Versão Renov Home:** 2.x  
**Status:** 🚧 Documentação em construção ativa
