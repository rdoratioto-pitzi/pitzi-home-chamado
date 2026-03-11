# Renov Home - Módulos do Sistema

**📅 Última atualização:** Fevereiro 2026  
**🔗 Repositório:** https://github.com/renov-tech/renov-home

---

## 📊 Visão Geral

O Renov Home é composto por **8 módulos principais** integrados que cobrem diferentes aspectos da gestão operacional.

### Mapa de Módulos

```
┌─────────────────────────────────────────────────────────────┐
│                      RENOV HOME                             │
│                  Sistema de Gestão                          │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ Tickets │      │Projects │      │Meetings │
   └─────────┘      └─────────┘      └─────────┘
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │Macgyver │      │Logistics│      │ Pricing │
   │   AI    │      └─────────┘      └─────────┘
   └─────────┘            │                │
        │            ┌────▼────┐      ┌────▼────┐
        │            │Knowledge│      │   BI    │
        │            │  Base   │      └─────────┘
        │            └─────────┘
        │
   [Core Intelligence Layer]
```

---

## 🎫 1. Tickets (Suporte Técnico)

### Status: ✅ Em Produção

### Descrição
Sistema de gestão de tickets de suporte técnico interno, permitindo abertura, acompanhamento e resolução de solicitações.

### Funcionalidades Principais
- ✅ Abertura de tickets por qualquer usuário
- ✅ Categorização (Bug, Feature, Suporte)
- ✅ Priorização (Baixa, Média, Alta, Crítica)
- ✅ Atribuição a responsáveis
- ✅ Comentários e histórico
- ✅ Status workflow (Aberto → Em andamento → Resolvido → Fechado)
- ✅ Notificações por email
- ✅ SLA tracking

### Stack Técnico
- Frontend: React + TypeScript
- Backend: Express.js
- Database: PostgreSQL (tabela `tickets`)

### Responsável
**Átila** (Senior Developer)

### Documentação Detalhada
Ver [modules/tickets.md](modules/tickets.md)

---

## 📋 2. Projects (Gestão de Projetos)

### Status: ✅ Em Produção

### Descrição
Sistema Kanban para gestão de projetos internos com colunas customizáveis e cards drag-and-drop.

### Funcionalidades Principais
- ✅ Criação de projetos
- ✅ Colunas customizáveis (To Do, In Progress, Done, etc.)
- ✅ Cards com descrição, prazo, responsável
- ✅ Drag-and-drop entre colunas
- ✅ Labels e tags
- ✅ Filtros e busca
- ✅ Timeline/Gantt view (se implementado)
- ✅ Visibilidade (Privado/Público/Equipe)

### Stack Técnico
- Frontend: React + TypeScript
- Backend: Express.js
- Database: PostgreSQL (tabelas `projects`, `project_columns`, `project_cards`)

### Responsável
**Marcelo** (CTO)

### Documentação Detalhada
Ver [modules/projects.md](modules/projects.md)

---

## 📅 3. Meetings (Reuniões)

### Status: ⚠️ Em Produção (com bug conhecido)

### Descrição
Sistema de agendamento e gestão de reuniões com suporte a recorrência e follow-ups.

### Funcionalidades Principais
- ✅ Agendamento de reuniões
- ✅ Convites por email
- ✅ Integração com calendário
- ✅ Participantes múltiplos
- ⚠️ Recurring meetings (BUG CONHECIDO)
- ✅ Atas de reunião
- ✅ Action items vinculados
- ✅ Notificações de lembrete

### Bug Conhecido
**Issue:** Meetings recorrentes não criam instâncias futuras corretamente  
**Impact:** Médio - Afeta planejamento de longo prazo  
**Status:** Em investigação  
**Workaround:** Criar reuniões manualmente até correção  
**Responsável:** Juan

### Stack Técnico
- Frontend: React + TypeScript
- Backend: Express.js + Node-cron (recorrência)
- Database: PostgreSQL (tabelas `meetings`, `meeting_participants`)

### Responsável
**Juan** (Intern Developer)

### Documentação Detalhada
Ver [modules/meetings.md](modules/meetings.md)

---

## 🤖 4. Macgyver AI (Assistente Estratégico)

### Status: 🚧 Em Desenvolvimento Ativo - **PRIORIDADE #1**

### Descrição
Assistente de IA estratégico que integra dados de todos os módulos do Renov Home com capacidades de análise, pesquisa externa e automação.

### Visão
Transformar o Macgyver de um "chatbot com IA" para um **assistente estratégico de nível empresarial** que:
- Analisa dados internos (todos os módulos)
- Busca informações externas (APIs, web)
- Fornece insights acionáveis
- Automatiza tarefas repetitivas

### Funcionalidades Planejadas
- 🚧 Chat conversacional multi-modelo (GPT-4, Claude, etc.)
- 🚧 Integração profunda com módulos internos
- 📋 Pesquisa web inteligente (Perplexity-style)
- 📋 Análise preditiva de projetos
- 📋 Sugestões de otimização de processos
- 📋 Automação de relatórios
- 📋 Pricing intelligence (análise de mercado)

### Stack Técnico (Planejado)
- Frontend: React + TypeScript
- Backend: Express.js + Python (processamento)
- AI APIs: OpenAI, OpenRouter, Claude
- Embeddings: Vector DB (Pinecone? Weaviate?)
- Database: PostgreSQL + JSON storage

### Roadmap
**Q1 2026:**
- ✅ Chat básico implementado
- 🚧 Integração com módulos internos
- 📋 Pesquisa web inteligente

**Q2 2026:**
- 📋 Análise preditiva
- 📋 Automação de relatórios
- 📋 Multi-model routing inteligente

**Q3 2026:**
- 📋 Pricing intelligence
- 📋 Workflow automation
- 📋 Enterprise features

### Responsável
**Matheus** (CEO/Tech Lead)

### Documentação Detalhada
Ver [modules/macgyver-ai.md](modules/macgyver-ai.md)

---

## 🚚 5. Logistics (Rastreamento Operacional)

### Status: ✅ Em Produção

### Descrição
Sistema de rastreamento de logística operacional, integrando com APIs de transportadoras e gerenciando fluxos de entrega/coleta.

### Funcionalidades Principais
- ✅ Rastreamento de entregas
- ✅ Integração com APIs de transportadoras
- ✅ Status em tempo real
- ✅ Notificações de mudança de status
- ✅ Histórico de movimentações
- ✅ Dashboard de logística

### Integrações
- API Correios
- API [outras transportadoras]

### Stack Técnico
- Frontend: React + TypeScript
- Backend: Express.js
- APIs Externas: Correios, [outras]
- Database: PostgreSQL (tabela `logistics`)

### Responsável
[Definir]

### Documentação Detalhada
Ver [modules/logistics.md](modules/logistics.md)

---

## 💰 6. Pricing (Monitoramento de Preços)

### Status: ✅ Em Produção

### Descrição
Monitoramento de preços de mercado para produtos/serviços relevantes, com alertas de variação e análise de tendências.

### Funcionalidades Principais
- ✅ Monitoramento automático de preços
- ✅ Alertas de variação significativa
- ✅ Histórico de preços (gráficos)
- ✅ Comparação com competidores
- ✅ Análise de tendências
- ✅ Relatórios de pricing

### Fontes de Dados
- Scraping de e-commerces
- APIs de marketplaces
- [Outras fontes]

### Stack Técnico
- Frontend: React + TypeScript + Charts
- Backend: Express.js + Scraping libs
- Scheduling: Node-cron
- Database: PostgreSQL (tabela `pricing_history`)

### Responsável
[Definir]

### Documentação Detalhada
Ver [modules/pricing.md](modules/pricing.md)

---

## 📚 7. Knowledge Base (Base de Conhecimento)

### Status: ✅ Em Produção

### Descrição
Repositório centralizado de conhecimento da empresa, incluindo documentação, processos, políticas e FAQs.

### Funcionalidades Principais
- ✅ Criação de artigos/documentos
- ✅ Categorização hierárquica
- ✅ Busca full-text
- ✅ Versionamento de documentos
- ✅ Workflow de aprovação
- ✅ Controle de acesso por perfil
- ✅ Tags e metadados
- ✅ Rich text editor

### Tipos de Conteúdo
- Políticas da empresa
- Procedimentos operacionais (POPs)
- FAQs
- Tutoriais
- Templates

### Stack Técnico
- Frontend: React + TypeScript + Rich Text Editor
- Backend: Express.js
- Search: PostgreSQL Full-Text Search
- Database: PostgreSQL (tabela `knowledge_articles`)

### Responsável
[Definir]

### Documentação Detalhada
Ver [modules/knowledge-base.md](modules/knowledge-base.md)

---

## 📊 8. Business Intelligence (BI)

### Status: ✅ Em Produção

### Descrição
Dashboards e métricas consolidadas de todos os módulos, permitindo análise de performance e tomada de decisão data-driven.

### Funcionalidades Principais
- ✅ Dashboards customizáveis
- ✅ KPIs principais
- ✅ Gráficos interativos
- ✅ Exportação de relatórios (PDF, Excel)
- ✅ Filtros temporais
- ✅ Drill-down de dados
- ✅ Alertas automáticos

### Métricas Principais
**Tickets:**
- Volume por período
- Tempo médio de resolução
- Taxa de satisfação
- Distribuição por categoria

**Projects:**
- Taxa de conclusão
- Projetos atrasados
- Produtividade por pessoa
- Burndown charts

**Meetings:**
- Taxa de comparecimento
- Action items pendentes
- Tempo médio de reunião

**[Outros módulos...]**

### Stack Técnico
- Frontend: React + TypeScript + Recharts/Chart.js
- Backend: Express.js + Python scripts
- Database: PostgreSQL (views agregadas)
- Processamento: Python (Pandas, NumPy)

### Responsável
**Juan** (Intern Developer) - Foco em Python/Analytics

### Documentação Detalhada
Ver [modules/business-intelligence.md](modules/business-intelligence.md)

---

## 🔄 Integrações Entre Módulos

### Cross-Module Features

```
Macgyver AI
    ↓ analisa dados
┌───────────────────────────────┐
│ Tickets + Projects + Meetings │
│ + Logistics + Pricing + KB    │
└───────────────────────────────┘
    ↓ gera insights
Business Intelligence
```

### Exemplos de Integração

**Tickets → Projects:**
- Criar projeto a partir de ticket complexo
- Vincular tickets a cards de projeto

**Meetings → Projects:**
- Action items viram tasks em projetos
- Vinculação de reuniões a projetos

**Macgyver AI → Todos:**
- Acessa dados de todos os módulos
- Fornece insights cruzados
- Automatiza workflows

**BI → Todos:**
- Agrega dados de todos os módulos
- Dashboards consolidados

---

## 📊 Status Geral dos Módulos

| Módulo | Status | Prioridade | Responsável | Última Atualização |
|--------|--------|------------|-------------|-------------------|
| Tickets | ✅ Produção | Manutenção | Átila | Jan 2026 |
| Projects | ✅ Produção | Manutenção | Marcelo | Jan 2026 |
| Meetings | ⚠️ Produção (bug) | Bug fix | Juan | Fev 2026 |
| Macgyver AI | 🚧 Desenvolvimento | ALTA | Matheus | Fev 2026 |
| Logistics | ✅ Produção | Manutenção | [Definir] | Jan 2026 |
| Pricing | ✅ Produção | Manutenção | [Definir] | Jan 2026 |
| Knowledge Base | ✅ Produção | Manutenção | [Definir] | Dez 2025 |
| BI | ✅ Produção | Otimização | Juan | Jan 2026 |

**Legenda:**
- ✅ Produção estável
- ⚠️ Produção com issues conhecidas
- 🚧 Em desenvolvimento ativo
- 📋 Planejado

---

## 🎯 Roadmap de Módulos

### Q1 2026 (Atual)
- 🚧 Macgyver AI - Desenvolvimento principal
- ⚠️ Meetings - Correção de bug de recorrência
- ✅ BI - Otimização de dashboards

### Q2 2026
- 📋 Macgyver AI - Features avançadas
- 📋 Módulos existentes - Performance tuning
- 📋 API pública - Exposição controlada

### Q3 2026
- 📋 Mobile app - Versão nativa
- 📋 Marketplace - Módulos third-party
- 📋 Enterprise features - SSO, audit logs

---

## 📚 Documentação de Módulos

### Documentação Detalhada
Cada módulo tem documentação específica em `/docs/modules/`:

- [tickets.md](modules/tickets.md)
- [projects.md](modules/projects.md)
- [meetings.md](modules/meetings.md)
- [macgyver-ai.md](modules/macgyver-ai.md)
- [logistics.md](modules/logistics.md)
- [pricing.md](modules/pricing.md)
- [knowledge-base.md](modules/knowledge-base.md)
- [business-intelligence.md](modules/business-intelligence.md)

### Informações por Módulo
Cada documentação específica contém:
- Funcionalidades detalhadas
- Arquitetura técnica
- API endpoints
- Database schema
- UI/UX guidelines
- Troubleshooting
- FAQs

---

## 🆘 Suporte

**Dúvidas sobre módulos específicos:**
1. Consulte a documentação detalhada em `/docs/modules/`
2. Verifique issues conhecidas no GitHub
3. Entre em contato com o responsável do módulo

**Novos módulos:**
Propostas de novos módulos devem seguir template em `/docs/NEW_MODULE_TEMPLATE.md` (criar)

---

*Última atualização: Fevereiro 2026*  
*Próxima revisão: Março 2026*
