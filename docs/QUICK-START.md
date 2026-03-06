# Renov Home - Quick Start

> **🎯 Objetivo:** Contexto essencial em menos de 5 minutos

---

## 🤖 Para IAs/Assistentes (Claude, ChatGPT, etc.)

Você está auxiliando o desenvolvimento do **Renov Home**, sistema de gestão operacional da empresa brasileira **Renov**.

### 📚 Leia Primeiro (Ordem de Prioridade)
1. **[00-CONTEXTO.md](00-CONTEXTO.md)** - Quem somos, missão, filosofia "Vibe Coding"
2. **[01-ARQUITETURA.md](01-ARQUITETURA.md)** - Stack técnico e estrutura
3. **[02-MODULOS.md](02-MODULOS.md)** - Módulos do sistema (o que fazemos)

### 🔑 Informações Essenciais

**Stack Principal:**
- React 18 + TypeScript (frontend)
- Express.js + Node.js (backend)  
- PostgreSQL (database)
- Git/GitHub (controle de versão)

**Repositório:**
- 🔗 https://github.com/renov-tech/renov-home
- Branch principal: `main` (protegida)
- Branch de desenvolvimento: `develop`

**Documentação Técnica Completa:**
- 📂 Localização: `/docs/` (você está aqui!)
- 📋 Índice: [README.md](README.md)
- 🧩 Módulos específicos: `/docs/modulos/`

### 📋 Template para Início de Chat

**Versão Mínima:**
```
📋 Projeto: Renov Home
📂 Docs: /docs/README.md
🎯 Objetivo: [sua tarefa aqui]
```

**Versão Completa:**
```
📋 RENOV HOME - Quick Context

📂 Documentação: /docs/README.md
🔗 Repositório: github.com/renov-tech/renov-home
📋 Branch: [main/develop/feature-x]

🎯 OBJETIVO:
[Descrever em 1-2 linhas]

📌 MÓDULO:
[Tickets/Projects/Meetings/Chat IA/BI/etc ou N/A]

💡 CONTEXTO ESPECÍFICO:
[Informações não documentadas relevantes agora]
```

---

## 👨‍💻 Para Novos Desenvolvedores

### Setup Inicial

```bash
# 1. Clone do repositório
git clone https://github.com/renov-tech/renov-home.git
cd renov-home

# 2. Leia a documentação
cd docs
cat README.md  # Comece aqui

# 3. Instale dependências
npm install

# 4. Configure ambiente
cp .env.example .env
# [Edite .env com suas credenciais]

# 5. Inicie desenvolvimento
npm run dev
```

### Primeiros Passos
1. ✅ Ler [00-CONTEXTO.md](00-CONTEXTO.md) - Entender a filosofia
2. ✅ Ler [01-ARQUITETURA.md](01-ARQUITETURA.md) - Entender o stack
3. ✅ Ler [03-GOVERNANCA.md](03-GOVERNANCA.md) - Entender o workflow
4. ✅ Explorar código: começar por `/src/modules/`
5. ✅ Falar com Marcelo (CTO) para onboarding técnico

---

## 👥 Time Renov

| Nome | Cargo | Responsabilidade | Contato |
|------|-------|------------------|---------|
| **Matheus** | CEO / Tech Lead | Estratégia, produto, inovação | [definir] |
| **Marcelo** | CTO | Arquitetura, code review (APROVADOR) | [definir] |
| **Átila** | Senior Developer | Features, infraestrutura | [definir] |
| **Juan** | Intern Developer | Dashboards Python, tasks | [definir] |

### Quem Procurar Para:
- **Decisões de arquitetura:** Marcelo
- **Aprovação de PRs:** Marcelo (obrigatório)
- **Dúvidas técnicas:** Átila ou Marcelo
- **Estratégia/produto:** Matheus
- **Python/dashboards:** Juan

---

## 🔄 Workflow Git (Resumo)

```
main (protegida)
  ↓
develop (base de desenvolvimento)
  ↓
feature/sua-feature (seu trabalho)
  ↓
Pull Request → Review Marcelo → Merge
```

**Regras:**
- ✅ Sempre criar branch a partir de `develop`
- ✅ Commits descritivos e em português
- ✅ PR obrigatório (não push direto em main/develop)
- ✅ Aprovação do Marcelo obrigatória
- ✅ Testes passando antes de merge
- ✅ Documentação atualizada quando necessário

---

## 🧩 Módulos do Sistema (Overview Rápido)

| Módulo | Status | Responsável | Descrição Curta |
|--------|--------|-------------|-----------------|
| **Tickets** | ✅ Produção | Átila | Sistema de suporte técnico |
| **Projects** | ✅ Produção | Marcelo | Gestão de projetos Kanban |
| **Meetings** | ⚠️ Bug conhecido | Juan | Agendamento de reuniões |
| **Chat IA** | 🚧 Em desenvolvimento | Matheus | Assistente IA estratégico |
| **Logistics** | ✅ Produção | [definir] | Rastreamento operacional |
| **Pricing** | ✅ Produção | [definir] | Monitoramento de preços |
| **Knowledge Base** | ✅ Produção | [definir] | Base de conhecimento |
| **BI** | ✅ Produção | Juan | Dashboards e métricas |

**Detalhes:** Ver `/docs/modulos/[nome-modulo].md`

---

## 🎯 Filosofia "Vibe Coding"

Princípios que guiam o desenvolvimento na Renov:

1. **Pragmatismo** - O que funciona > o que é "perfeito"
2. **Aprendizado Prático** - Fazer > estudar teoria eternamente
3. **Cost-Effective** - ROI em todas as decisões técnicas
4. **Configuração Manual** - Quando traz mais controle e entendimento
5. **Documentação Viva** - Docs que evoluem com o código
6. **Iteração Rápida** - Validar cedo, ajustar rápido

**Leia mais:** [00-CONTEXTO.md](00-CONTEXTO.md)

---

## 🆘 Ajuda Rápida

### Dúvidas Comuns

**P: Como funciona o módulo X?**  
R: Veja `/docs/modulos/[nome-modulo].md`

**P: Qual tecnologia usamos para Y?**  
R: Veja [01-ARQUITETURA.md](01-ARQUITETURA.md)

**P: Como faço um PR?**  
R: Veja [03-GOVERNANCA.md](03-GOVERNANCA.md)

**P: Bug no módulo de Meetings?**  
R: Sim, issue conhecida em `/docs/modulos/meetings.md`

**P: Qual a prioridade atual?**
R: Chat IA - ver [ROADMAP.md](ROADMAP.md)

### Comandos Úteis

```bash
# Desenvolvimento local
npm run dev          # Inicia dev server
npm run build        # Build de produção
npm run test         # Roda testes
npm run lint         # Verifica código

# Git
git checkout develop              # Vai para develop
git pull origin develop           # Atualiza develop
git checkout -b feature/minha-feature  # Cria feature branch
git add .
git commit -m "feat: descrição"   # Commit semântico
git push origin feature/minha-feature  # Push da feature
```

---

## 📚 Recursos Adicionais

- **Repositório:** https://github.com/renov-tech/renov-home
- **Documentação Completa:** [README.md](README.md)
- **Arquitetura Detalhada:** [01-ARQUITETURA.md](01-ARQUITETURA.md)
- **Roadmap:** [ROADMAP.md](ROADMAP.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

## ✅ Checklist: Estou Pronto?

Antes de começar a codar, você deve:

- [ ] Ter lido [00-CONTEXTO.md](00-CONTEXTO.md)
- [ ] Ter lido [01-ARQUITETURA.md](01-ARQUITETURA.md)
- [ ] Ter lido [03-GOVERNANCA.md](03-GOVERNANCA.md)
- [ ] Ter clonado o repositório
- [ ] Ter rodado `npm install` com sucesso
- [ ] Ter configurado `.env` corretamente
- [ ] Ter conversado com Marcelo sobre a tarefa
- [ ] Saber em qual módulo vai trabalhar

---

**Bem-vindo ao Renov Home! 🚀**

*Última atualização: Fevereiro 2026*
