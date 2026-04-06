# Módulo Avaliações — Renov Home

## Visão Geral

Módulo de monitoramento de acurácia e curadoria de avaliações estéticas de dispositivos.
Faz parte do grupo **Operações** na sidebar, com acesso via `/avaliacoes`.

Permite acompanhar a performance da IA Lapisco comparada a avaliadores humanos,
realizar curadoria por amostragem e configurar parâmetros do processo avaliativo.

---

## Arquitetura

| Camada        | Localização                                                  |
|---------------|--------------------------------------------------------------|
| Páginas       | `client/src/pages/avaliacoes/` (4 páginas)                  |
| Componentes   | `client/src/components/avaliacoes/` (11 componentes)        |
| Hooks         | `client/src/hooks/use-avaliacoes.ts`                        |
| Serviço       | `server/services/renovsmart-avaliacoes.ts`                  |
| Rotas Express | `server/routes/avaliacoes.ts`                               |
| Rotas Worker  | `worker/src/routes/avaliacoes.ts`                           |
| Schema        | `shared/schema.ts` (tabelas: `curadoria_avaliacoes`, `curadoria_configuracoes`) |

### Páginas

| Rota                             | Arquivo               | Descrição                         |
|----------------------------------|-----------------------|-----------------------------------|
| `/avaliacoes/dashboard`          | `dashboard.tsx`       | KPIs, gráfico temporal, ranking   |
| `/avaliacoes/curadoria`          | `curadoria.tsx`       | Workflow de curadoria por swipe   |
| `/avaliacoes/matriz`             | `matriz.tsx`          | Matriz de confusão IA vs Humano   |
| `/avaliacoes/configuracoes`      | `configuracoes.tsx`   | Configurações de amostragem e POP |

### Componentes

| Componente                  | Responsabilidade                                    |
|-----------------------------|-----------------------------------------------------|
| `accuracy-kpi-strip.tsx`    | Strip de 4 KPIs: acurácia IA/Humano, custo, curados |
| `accuracy-trend-chart.tsx`  | Gráfico de linha com evolução temporal              |
| `evaluator-ranking.tsx`     | Ranking de avaliadores por acurácia                 |
| `cost-impact-card.tsx`      | Custo do erro — breakdown por tipo de transição     |
| `dashboard-filters.tsx`     | Filtros de período, categoria e área                |
| `confusion-matrix.tsx`      | Matriz 3×3 com células clicáveis                    |
| `matriz-filters.tsx`        | Filtros da página de matriz                         |
| `curation-card.tsx`         | Card de curadoria com seletores de grade A/B/C      |
| `curation-image-viewer.tsx` | Galeria de imagens do trade-in                      |
| `grade-selector.tsx`        | Botões de seleção de grade (A/B/C) com badge       |
| `reviewer-flag.tsx`         | Flag para revisão por falha não-estética            |

---

## Endpoints REST

Todos requerem autenticação (`requireAuth`). Runtime dual: Express (dev) + Hono Worker (prod).

| Método | Path                                          | Descrição                                      |
|--------|-----------------------------------------------|------------------------------------------------|
| GET    | `/api/avaliacoes/trade-ins`                   | Lista trade-ins avaliados com filtros e paginação |
| GET    | `/api/avaliacoes/trade-ins/:tradeInId`        | Detalhes de um trade-in específico             |
| GET    | `/api/avaliacoes/avaliadores`                 | Lista de avaliadores humanos                   |
| POST   | `/api/avaliacoes/curadoria`                   | Salva resultado de curadoria                   |
| GET    | `/api/avaliacoes/curadoria`                   | Lista curadorias realizadas com filtros        |
| GET    | `/api/avaliacoes/curadoria/pendentes`         | Trade-ins pendentes de curadoria (amostra)     |
| GET    | `/api/avaliacoes/configuracoes`               | Configurações atuais (percentual, modo)        |
| PUT    | `/api/avaliacoes/configuracoes`               | Atualiza configurações de amostragem           |
| GET    | `/api/avaliacoes/metricas/resumo`             | KPIs: acurácia, custo do erro, cobertura       |
| GET    | `/api/avaliacoes/metricas/evolucao`           | Série temporal de acurácia (diária/semanal/mensal) |
| GET    | `/api/avaliacoes/metricas/ranking-avaliadores`| Ranking de avaliadores por acurácia e volume   |
| GET    | `/api/avaliacoes/metricas/custo-erro`         | Custo financeiro do erro por tipo de transição |
| GET    | `/api/avaliacoes/metricas/matriz-confusao`    | Matriz 3×3 de confusão para IA ou Humano       |

---

## Regras de Negócio

### Grades

Definidas pelo **POP 101 — Avaliação Estética de Dispositivos V3**:

| Grade | Desconto Display | Desconto Carcaça | Definição                             |
|-------|-----------------|-----------------|---------------------------------------|
| A     | 0%              | 0%              | Excelente condição, sinais mínimos    |
| B     | 25%             | 25%             | Bom estado, uso moderado visível      |
| C     | 70%             | 70%             | Desgaste severo, danos visíveis       |

### Curadoria

- Avaliação independente para **Display** e **Carcaça** (áreas separadas)
- Amostragem configurável: 5% a 50% dos trade-ins do dia anterior (default 15%)
- Modo de prioridade: **Aleatório** ou **Divergências primeiro** (IA ≠ Humano)
- **Revisão Avaliador**: flag para falhas não-estéticas (burn-in, listras, pixels mortos, manchas)
- Critério de desempate: grade mais conservadora (maior desconto)

### Amostragem

```
GET /api/avaliacoes/curadoria/pendentes
→ retorna N trade-ins = totalDoDiaAnterior × (percentualAmostragem / 100)
```

Com modo `divergencias_primeiro`, priorizados os casos onde `gradeIa ≠ gradeHumano`.

### Multi-tenant

Todas as queries filtram por `tenantId` da sessão.

---

## Permissão

```ts
modulePermissions.avaliacoes = true
```

Usuários com essa permissão podem acessar todas as 4 páginas e realizar curadorias.

---

## Referências Cruzadas

A página **Logística > Eficiência de Avaliações IA** (`/logistica/avaliacoes-ia`) é a
implementação anterior e mantida para compatibilidade. Exibe um banner direcionando para
o módulo completo.

---

## Referências Externas

- **POP 101 — Avaliação Estética de Dispositivos V3** — documento interno Renov
- **IA de Avaliação:** Lapisco (parceiro externo)
- **Responsáveis:** Gabriel Campos / Matheus Mundstock
- **Categorias avaliadas:** Smartphone, iPhone, Console
