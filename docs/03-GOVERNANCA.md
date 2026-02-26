# Renov Home - Governança e Workflows

**📅 Última atualização:** Fevereiro 2026  
**🔗 Repositório:** https://github.com/renov-tech/renov-home

---

## 🎯 Princípios de Governança

### Filosofia "Vibe Coding" Aplicada
1. **Pragmatismo** - Processos que agregam valor real
2. **Transparência** - Decisões documentadas e acessíveis
3. **Agilidade** - Processos leves, não burocráticos
4. **Qualidade** - Code review rigoroso mas construtivo
5. **Aprendizado** - Erros como oportunidades de crescimento

---

## 🌳 Git Workflow

### Modelo de Branches

```
main (protegida)
  ↓ production-ready code
  ↓
develop (base de desenvolvimento)
  ↓ integração contínua
  ↓
feature/nome-feature (features)
  ↓ desenvolvimento isolado
  ↓
hotfix/nome-fix (correções urgentes)
```

### Descrição das Branches

#### **main**
- **Propósito:** Código em produção
- **Proteção:** ✅ Branch protection ativa
- **Merge:** Apenas via PR aprovado por Marcelo
- **Deploy:** Automático para produção (quando configurado)
- **Regras:**
  - Não aceita push direto
  - Requer aprovação de 1+ revisores (Marcelo obrigatório)
  - Requer CI passando
  - Não permite force push

#### **develop**
- **Propósito:** Integração de features
- **Proteção:** ✅ Proteção parcial
- **Merge:** Via PR com review
- **Deploy:** Staging/development environment
- **Regras:**
  - Push direto permitido apenas para emergências
  - Preferir PRs mesmo para develop
  - Base para criar feature branches

#### **feature/***
- **Propósito:** Desenvolvimento de features específicas
- **Nomenclatura:** `feature/descricao-curta`
- **Criação:** A partir de `develop`
- **Merge:** De volta para `develop` via PR
- **Vida útil:** Deletar após merge

**Exemplos:**
```bash
feature/macgyver-ai-integration
feature/meetings-recurring-fix
feature/pricing-dashboard
feature/bi-export-pdf
```

#### **hotfix/***
- **Propósito:** Correções urgentes em produção
- **Nomenclatura:** `hotfix/descricao-problema`
- **Criação:** A partir de `main`
- **Merge:** Para `main` E `develop` via PR
- **Vida útil:** Deletar após merge

**Exemplos:**
```bash
hotfix/security-auth-bypass
hotfix/critical-data-loss
hotfix/api-endpoint-500
```

---

## 🔄 Workflow de Desenvolvimento

### 1. Criar Feature Branch

```bash
# Atualizar develop
git checkout develop
git pull origin develop

# Criar feature branch
git checkout -b feature/minha-feature

# Confirmar branch correta
git branch
```

### 2. Desenvolver e Commitar

```bash
# Fazer alterações no código
# ...

# Verificar mudanças
git status
git diff

# Adicionar mudanças
git add .
# ou específico: git add src/components/MyComponent.tsx

# Commitar (seguir convenção de commits)
git commit -m "feat(macgyver): adiciona integração com OpenRouter

- Implementa client OpenRouter
- Adiciona seleção de modelos
- Testes unitários do client"

# Push da branch
git push origin feature/minha-feature
```

### 3. Criar Pull Request

#### No GitHub:
1. Acessar repositório
2. "Compare & pull request"
3. **Base:** `develop` (ou `main` se hotfix)
4. **Compare:** `feature/minha-feature`
5. Preencher template do PR (ver abaixo)
6. Adicionar reviewers (Marcelo obrigatório)
7. Adicionar labels apropriadas
8. "Create pull request"

#### Template de PR

```markdown
## Descrição
[Descrição clara e concisa das mudanças]

## Tipo de Mudança
- [ ] Bug fix (correção de bug)
- [ ] Nova feature (nova funcionalidade)
- [ ] Breaking change (mudança que quebra compatibilidade)
- [ ] Melhoria de performance
- [ ] Refatoração
- [ ] Documentação
- [ ] Testes

## Módulo Afetado
- [ ] Tickets
- [ ] Projects
- [ ] Meetings
- [ ] Macgyver AI
- [ ] Logistics
- [ ] Pricing
- [ ] Knowledge Base
- [ ] Business Intelligence
- [ ] Core/Infraestrutura

## Checklist
- [ ] Código segue padrões do projeto
- [ ] Self-review realizado
- [ ] Comentários adicionados em código complexo
- [ ] Documentação atualizada (se necessário)
- [ ] Sem warnings de linter
- [ ] Testes adicionados/atualizados
- [ ] Testes passando localmente
- [ ] Mudanças de UI responsivas (se aplicável)
- [ ] Migrations criadas (se mudou DB)

## Testes Realizados
[Descrever testes manuais ou automáticos]

## Screenshots (se UI)
[Adicionar screenshots se mudanças visuais]

## Issue Relacionada
Closes #[número da issue]

## Notas Adicionais
[Informações extras para revisores]
```

### 4. Code Review

#### Responsáveis
- **Aprovador obrigatório:** Marcelo (CTO)
- **Revisores opcionais:** Átila, outros devs
- **Auto-merge:** ❌ Não permitido

#### Checklist do Revisor

**Funcionalidade:**
- [ ] Código faz o que diz fazer
- [ ] Não introduz bugs óbvios
- [ ] Edge cases tratados

**Qualidade:**
- [ ] Código legível e bem organizado
- [ ] Nomenclatura clara e consistente
- [ ] Sem código duplicado
- [ ] Complexidade gerenciável

**Padrões:**
- [ ] Segue convenções do projeto
- [ ] TypeScript types corretos
- [ ] Error handling adequado
- [ ] Logs apropriados

**Performance:**
- [ ] Sem gargalos óbvios
- [ ] Queries otimizadas
- [ ] Sem memory leaks

**Segurança:**
- [ ] Inputs validados
- [ ] Sem SQL injection
- [ ] Sem XSS
- [ ] Secrets não commitados

**Testes:**
- [ ] Testes adequados
- [ ] Coverage aceitável
- [ ] CI verde

#### Processo de Revisão

1. **Revisor analisa código**
2. **Comenta no PR:**
   - 💬 Perguntas/sugestões
   - 🔴 Problemas críticos (request changes)
   - ✅ Aprovações parciais
3. **Autor responde e ajusta**
4. **Iteração até aprovação**
5. **Aprovação final → Merge**

### 5. Merge e Deploy

```bash
# Após aprovação no GitHub
# Fazer merge via interface (squash ou merge commit)

# Deletar branch remota (via GitHub UI)

# Localmente, atualizar develop
git checkout develop
git pull origin develop

# Deletar branch local
git branch -d feature/minha-feature

# Confirmar limpeza
git branch
```

---

## 📝 Convenções de Commits

### Formato (Conventional Commits)

```
tipo(escopo): título curto

Corpo opcional explicando o que e por quê.

Footer opcional com referências a issues.
```

### Tipos Permitidos

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **feat** | Nova feature | `feat(tickets): adiciona filtro por status` |
| **fix** | Correção de bug | `fix(meetings): corrige recurring meetings` |
| **docs** | Documentação | `docs: atualiza README com setup` |
| **style** | Formatação, lint | `style: ajusta indentação` |
| **refactor** | Refatoração | `refactor(auth): simplifica lógica de token` |
| **perf** | Performance | `perf(bi): otimiza query de dashboard` |
| **test** | Testes | `test(projects): adiciona testes unitários` |
| **build** | Build/deps | `build: atualiza typescript para 5.3` |
| **ci** | CI/CD | `ci: adiciona job de lint no GitHub Actions` |
| **chore** | Manutenção | `chore: atualiza .gitignore` |

### Escopos Comuns

- `tickets`, `projects`, `meetings`, `macgyver`, `logistics`, `pricing`, `kb`, `bi`
- `auth`, `api`, `db`, `ui`, `core`
- Omitir se mudança global

### Exemplos Bons

```bash
feat(macgyver): implementa integração OpenRouter

- Adiciona client para OpenRouter API
- Suporta seleção dinâmica de modelos
- Implementa fallback em caso de erro

Closes #123

---

fix(meetings): corrige bug de recurring meetings

Meetings recorrentes não estavam criando instâncias
futuras. Ajustado cron job para criar instâncias
com 1 mês de antecedência.

Closes #456

---

docs: adiciona documentação de arquitetura

Cria estrutura de /docs com:
- README.md (índice)
- 01-ARQUITETURA.md
- 02-MODULOS.md
```

### Exemplos Ruins (❌ Evitar)

```bash
❌ "update"
❌ "fix bug"
❌ "WIP"
❌ "asdfasdf"
❌ "mudanças"
```

---

## 🧪 Testes

### Estratégia de Testes

#### Obrigatório
- ✅ Testes em código crítico (auth, pagamento, data loss)
- ✅ Testes em bugfixes (regression tests)
- ✅ CI deve passar (quando configurado)

#### Recomendado
- 📋 Testes em novas features
- 📋 Testes de integração em APIs
- 📋 E2E em fluxos principais

#### Nice to Have
- 📋 Coverage > 70%
- 📋 Mutation testing
- 📋 Visual regression testing

### Executar Testes

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- tickets

# Com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🚀 Deploy

### Ambientes

| Ambiente | Branch | Deploy | URL |
|----------|--------|--------|-----|
| **Production** | `main` | Manual/Auto | [definir] |
| **Staging** | `develop` | Auto | [definir] |
| **Local** | qualquer | Manual | localhost:3000 |

### Processo de Deploy (Produção)

1. ✅ PR aprovado para `main`
2. ✅ Merge para `main`
3. ✅ CI/CD executa testes
4. ✅ Build de produção
5. ✅ Deploy automático (ou manual)
6. ✅ Smoke tests
7. ✅ Monitoramento de erros

### Rollback

```bash
# Em caso de problema em produção
git revert <commit-hash>
git push origin main

# Ou
git checkout main
git reset --hard <commit-anterior-bom>
git push origin main --force
# (use com MUITO cuidado!)
```

---

## 📋 Gestão de Issues

### Labels

| Label | Descrição | Cor |
|-------|-----------|-----|
| `bug` | Algo não está funcionando | 🔴 Vermelho |
| `feature` | Nova funcionalidade | 🟢 Verde |
| `enhancement` | Melhoria de feature existente | 🔵 Azul |
| `documentation` | Melhorias em docs | 📘 Azul claro |
| `help wanted` | Ajuda externa bem-vinda | 🆘 Amarelo |
| `good first issue` | Bom para iniciantes | 🟢 Verde claro |
| `priority:high` | Alta prioridade | 🔥 Laranja |
| `priority:low` | Baixa prioridade | ⬇️ Cinza |
| `wontfix` | Não será implementado | ⛔ Preto |

### Módulos

| Label | Módulo |
|-------|--------|
| `module:tickets` | Tickets |
| `module:projects` | Projects |
| `module:meetings` | Meetings |
| `module:macgyver` | Macgyver AI |
| `module:logistics` | Logistics |
| `module:pricing` | Pricing |
| `module:kb` | Knowledge Base |
| `module:bi` | Business Intelligence |

---

## 👥 Papéis e Responsabilidades

### Matheus (CEO / Tech Lead)
- **Decisões de produto:** Features e prioridades
- **Estratégia técnica:** Direção de longo prazo
- **Macgyver AI:** Lead do módulo
- **Aprovações:** Decisões de negócio

### Marcelo (CTO)
- **Arquitetura:** Decisões técnicas de alto nível
- **Code Review:** Aprovador obrigatório de todos os PRs
- **Qualidade:** Guardião dos padrões de código
- **Mentoria:** Guia técnico do time

### Átila (Senior Developer)
- **Desenvolvimento:** Features e infraestrutura
- **Mentoria:** Suporte a Juan
- **Módulos:** Tickets e outros módulos core
- **Code Review:** Revisor secundário

### Juan (Intern Developer)
- **Desenvolvimento:** Dashboards Python, tasks menores
- **BI:** Foco em analytics e métricas
- **Aprendizado:** Crescimento técnico
- **Módulos:** Meetings (correção de bugs)

---

## 📊 Métricas e KPIs

### Métricas de Desenvolvimento

**Velocidade:**
- Features entregues/sprint
- Story points completados
- Lead time (ideia → produção)

**Qualidade:**
- Bugs/release
- Tempo médio de correção de bugs
- Code review rejections

**Processo:**
- Tempo médio de code review
- PRs abertos > 3 dias
- Branches obsoletas

### Ferramentas de Tracking
- **GitHub Projects:** Kanban de tarefas
- **GitHub Issues:** Bug tracking
- **GitHub Actions:** CI/CD metrics
- **[Analytics tool]:** Performance metrics

---

## 🔒 Segurança e Secrets

### Regras Críticas
1. ❌ **NUNCA** commitar secrets (API keys, passwords, tokens)
2. ✅ Usar `.env` para configurações locais
3. ✅ `.env` deve estar no `.gitignore`
4. ✅ Secrets em produção via env vars ou secrets manager
5. ✅ Rotate secrets periodicamente

### Verificar Antes de Commit

```bash
# Verificar se não há secrets expostos
git diff

# Usar ferramenta de scan (se disponível)
git-secrets --scan

# Se commitou secret por acidente
# 1. Rotate o secret imediatamente
# 2. Remove do histórico Git:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch caminho/do/arquivo" \
  --prune-empty --tag-name-filter cat -- --all
```

---

## 📚 Recursos e Ferramentas

### Ferramentas Recomendadas
- **Git Client:** Git CLI, GitHub Desktop, GitKraken
- **IDE:** VS Code (com extensões recomendadas)
- **Code Review:** GitHub web interface
- **Comunicação:** Slack, Discord (definir)

### Extensões VS Code Recomendadas
- ESLint
- Prettier
- GitLens
- TypeScript
- [Outras relevantes]

### Documentação Útil
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

## 🆘 Troubleshooting

### Problemas Comuns

**Conflito de merge:**
```bash
# Atualizar branch com develop
git checkout develop
git pull origin develop
git checkout feature/minha-feature
git merge develop
# Resolver conflitos manualmente
git add .
git commit
```

**Commit no branch errado:**
```bash
# Mover commit para branch correto
git log # copiar hash do commit
git checkout branch-correto
git cherry-pick <hash>
git checkout branch-errado
git reset --hard HEAD~1
```

**Esqueci de criar branch:**
```bash
# Se ainda não commitou
git stash
git checkout -b feature/nova-branch
git stash pop

# Se já commitou em develop
git checkout -b feature/nova-branch
git checkout develop
git reset --hard origin/develop
```

---

## ✅ Checklist de Onboarding

Para novos desenvolvedores:

- [ ] Acesso ao repositório GitHub
- [ ] Clonou repositório localmente
- [ ] Leu documentação em `/docs`
- [ ] Configurou ambiente local
- [ ] Executou projeto localmente
- [ ] Entendeu Git workflow
- [ ] Fez primeiro PR (pequeno)
- [ ] Passou por code review
- [ ] Conhece todos os módulos
- [ ] Sabe onde pedir ajuda

---

**Dúvidas sobre processos?**  
Consulte Marcelo (CTO) ou abra discussion no GitHub.

*Última atualização: Fevereiro 2026*
