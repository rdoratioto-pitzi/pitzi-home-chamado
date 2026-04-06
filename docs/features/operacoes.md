# Módulo Operações — Renov Home

## Visão Geral

O grupo **Operações** reúne todos os módulos que cobrem a cadeia operacional do dispositivo usado: da coleta logística até o estoque disponível para venda. É composto por 4 submódulos independentes com navegação via sidebar em 2 níveis de collapsible.

Rota principal: `/operacoes` (redireciona para o submódulo padrão)

---

## Arquitetura de Navegação

A sidebar usa `SidebarGroupLabel` + `Collapsible` em 2 níveis:

- **Nível 1 — Grupo "Operações"**: label visual, sem rota própria
- **Nível 2 — Submódulos** com sub-itens colapsáveis:
  - Logística (`/logistica/...`)
  - Triagem (`/triagem/...`)
  - Avaliações (`/avaliacoes/...`)
  - Estoque (`/estoques/...`)

Cada submódulo tem permissão individual em `modulePermissions` (campo `permissions` da tabela `users`).

---

## Fluxo do Negócio

```
Voucher utilizado
     ↓
Confirmação do gerente
     ↓
Coleta logística (API Admin)
     ↓
Recebimento no centro
     ↓
Triagem física
     ├─ Desvio: Bloqueado / Manutenção / Divergente
     └─ Aprovado
          ↓
     Avaliação estética (IA Lapisco + Humano)
          ↓
     Curadoria por amostragem (se necessário)
          ↓
     NF de entrada (Omie)
          ↓
     Estoque formal
          ↓
     Venda / Revenda
```

---

## APIs Externas Consumidas

| API | Dados |
|-----|-------|
| API Pedidos Dashboard Renov | Vouchers, confirmações, valor |
| API Admin Logística | Coleta, recebimento, triagem, desvios |
| API RenovSmart (Lapisco) | Avaliações estéticas, grades, imagens |
| API Omie | Saldo de estoque (`ListarPosEstoque`), NF-e, vendas |

> **Atenção Omie**: usar sempre `ListarPosEstoque` para saldo — `ConsultarProduto` retorna `estoque=0`.

---

## Permissões

| Permissão | Submódulo |
|-----------|-----------|
| `logistica` | Submódulo Logística |
| `triagem` | Submódulo Triagem |
| `avaliacoes` | Submódulo Avaliações |
| `estoques` | Submódulo Estoque |

Endpoints de rastreabilidade, relatórios de contagem, posição de estoque e dashboard requerem `isAdmin = true`.

---

## Submódulo: Logística

Gerencia o fluxo de coleta e transporte de dispositivos.

| Camada | Localização |
|--------|-------------|
| Páginas | `client/src/pages/logistica/` |
| Serviço | Integração direta com API Admin Logística |

> Submódulo migrado de estrutura legada para o grupo Operações na Fase 1 (PR #231).

---

## Submódulo: Triagem

Controla o recebimento físico e triagem dos dispositivos.

### Arquitetura

| Camada | Localização |
|--------|-------------|
| Páginas | `client/src/pages/triagem/` (6 páginas) |
| Hooks | `client/src/hooks/use-triagem.ts` |
| Serviço | `server/services/triagem.service.ts` |
| Rotas Express | `server/routes/triagem.ts` |
| Rotas Worker | `worker/src/routes/triagem.ts` |

### Páginas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/triagem` | `index.tsx` | Entrada do submódulo |
| `/triagem/dashboard` | `dashboard.tsx` | KPIs de recebimento e status |
| `/triagem/recebimentos` | `recebimentos.tsx` | Tabela paginada com filtros |
| `/triagem/fila` | `fila.tsx` | Fila FIFO com highlights >7d e >15d |
| `/triagem/desvios` | `desvios.tsx` | 3 abas: Bloqueados, Manutenção, Divergentes |
| `/triagem/impressao-etiquetas` | `impressao-etiquetas.tsx` | Impressão de etiquetas de identificação |

### Endpoints REST

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/triagem/resumo` | KPIs do dashboard |
| GET | `/api/triagem/recebimentos` | Lista paginada de recebimentos |
| GET | `/api/triagem/fila` | Fila FIFO de triagem pendente |
| GET | `/api/triagem/desvios` | Dispositivos em desvio (bloqueados, manutenção, divergentes) |

### Lógica de Desvio

Dispositivos que não passam na triagem são classificados em:
- **Bloqueado**: impedimento regulatório ou jurídico
- **Manutenção**: requer reparo antes de seguir
- **Divergente**: discrepância entre IMEI declarado e físico

---

## Submódulo: Avaliações

Monitoramento de acurácia e curadoria de avaliações estéticas por IA.

> Documentação detalhada: [`docs/features/avaliacoes.md`](./avaliacoes.md)

### Arquitetura

| Camada | Localização |
|--------|-------------|
| Páginas | `client/src/pages/avaliacoes/` (5 páginas) |
| Componentes | `client/src/components/avaliacoes/` (11 componentes) |
| Hooks | `client/src/hooks/use-avaliacoes.ts` (13 hooks) |
| Serviço | `server/services/renovsmart-avaliacoes.ts` |
| Rotas Express | `server/routes/avaliacoes.ts` |
| Rotas Worker | `worker/src/routes/avaliacoes.ts` |
| Schema | `shared/schema.ts` — tabelas: `curadoria_avaliacoes`, `curadoria_configuracoes` |

### Páginas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/avaliacoes` | `index.tsx` | Entrada do submódulo |
| `/avaliacoes/dashboard` | `dashboard.tsx` | KPIs, gráfico temporal, ranking, custo do erro |
| `/avaliacoes/curadoria` | `curadoria.tsx` | Workflow de revisão com galeria de imagens |
| `/avaliacoes/matriz` | `matriz.tsx` | Matriz de confusão 3×3 IA vs Humano |
| `/avaliacoes/configuracoes` | `configuracoes.tsx` | Amostragem, percentuais POP 101 V3, curadores |

### Grades e Regras de Negócio

| Grade | Depreciação POP 101 V3 |
|-------|----------------------|
| A | 0% |
| B | 25% |
| C | 70% |

Avaliação ocorre em 2 dimensões: **Display** e **Carcaça**.

### Endpoints REST (13 endpoints)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/avaliacoes/trade-ins` | Lista de trade-ins com filtros |
| GET | `/api/avaliacoes/trade-ins/:tradeInId` | Detalhe de um trade-in |
| GET | `/api/avaliacoes/avaliadores` | Lista de avaliadores ativos |
| POST | `/api/avaliacoes/curadoria` | Salvar resultado de curadoria |
| GET | `/api/avaliacoes/curadoria` | Lista de curadorias realizadas |
| GET | `/api/avaliacoes/curadoria/pendentes` | Curadorias pendentes de análise |
| GET | `/api/avaliacoes/configuracoes` | Configurações de amostragem |
| PUT | `/api/avaliacoes/configuracoes` | Atualizar configurações |
| GET | `/api/avaliacoes/metricas/resumo` | KPIs consolidados |
| GET | `/api/avaliacoes/metricas/evolucao` | Evolução temporal da acurácia |
| GET | `/api/avaliacoes/metricas/ranking-avaliadores` | Ranking por acurácia |
| GET | `/api/avaliacoes/metricas/custo-erro` | Custo financeiro dos erros de avaliação |
| GET | `/api/avaliacoes/metricas/matriz-confusao` | Dados da matriz de confusão |

---

## Submódulo: Estoque

Gestão completa do estoque formal de dispositivos (pós-triagem e NF de entrada).

### Arquitetura

| Camada | Localização |
|--------|-------------|
| Páginas | `client/src/pages/estoques/` (8 seções) |
| Hooks | `client/src/hooks/use-estoques.ts` (20 hooks) |
| Serviços | `server/services/estoque.service.ts` · `estoque-cache.service.ts` · `estoque-pos.service.ts` |
| Rotas Express | `server/routes/estoques.ts` |
| Rotas Worker | `worker/src/routes/estoques.ts` |
| Schema | `shared/schema.ts` — 5 tabelas (ver abaixo) |

### Páginas e Componentes

#### Dashboard (`/estoques/dashboard`)

2 abas: **Visão Executiva** (KPIs financeiros/operacionais) e **Visão Estoque** (posição atual).

| Componente | Descrição |
|------------|-----------|
| `kpi-volume.tsx` | Volume de entradas e saídas |
| `kpi-financeiro.tsx` | Valor em estoque, margem bruta |
| `kpi-tempo.tsx` | Lead times e tempos de ciclo |
| `kpi-eficiencia.tsx` | Taxa de aproveitamento, acurácia |
| `graficos-executivo.tsx` | Gráficos de tendência (Recharts) |
| `curva-abc.tsx` | Distribuição ABC por valor |
| `giro-estoque.tsx` | Giro médio por categoria |
| `aging-estoque.tsx` | Resumo de aging por faixa etária |
| `aging-report.tsx` | Relatório detalhado de aging |
| `tendencias.tsx` | Evolução temporal |
| `links-rapidos.tsx` | Atalhos para ações frequentes |
| `kpi-card.tsx` | Componente base de KPI card |

#### Posição (`/estoques/posicao`)

3 abas: **Consulta** (tabela com filtros), **Curva ABC**, **Giro**.

| Componente | Descrição |
|------------|-----------|
| `tabela.tsx` | Tabela paginada com filtros por categoria/marca/modelo |
| `filtros.tsx` | Painel de filtros com selects encadeados |
| `totais-cards.tsx` | Totalizadores de quantidade e valor |
| `curva-abc.tsx` | Gráfico de curva ABC |
| `giro-estoque.tsx` | Métricas de giro por categoria |

#### Pipeline (`/estoques/pipeline`)

Funil de etapas com drill-down por etapa.

| Componente | Descrição |
|------------|-----------|
| `funil-cards.tsx` | Cards visuais de cada etapa do funil |
| `desvios-cards.tsx` | Contagem de itens em desvio |
| `tabela-etapa.tsx` | Lista detalhada de itens por etapa |

#### Lead Time (`/estoques/lead-time`)

Análise de ciclos por etapa e tendência temporal.

| Componente | Descrição |
|------------|-----------|
| `ciclos-cards.tsx` | Cards com tempo médio por etapa |
| `metricas-tabela.tsx` | Tabela de métricas de lead time |
| `tendencia-chart.tsx` | Gráfico de tendência (Recharts) |

#### Aging Report (`/estoques/aging`)

Matriz faixa×etapa e lista FIFO de itens mais antigos.

| Componente | Descrição |
|------------|-----------|
| `matriz-aging.tsx` | Matriz heat-map faixa etária × etapa |
| `lista-fifo.tsx` | Lista paginada FIFO com filtros |
| `alertas-config.tsx` | Configuração de thresholds de alerta |

#### Contagem Interna (`/estoques/contagem`)

Ferramenta para inventário físico "às cegas" via leitura de IMEI. Permite múltiplas sessões simultâneas por usuário.

| Componente | Descrição |
|------------|-----------|
| `barcode-reader.tsx` | Leitor de código de barras via câmera |
| `manual-input.tsx` | Input manual de IMEI com validação de 15 dígitos |
| `lista-itens.tsx` | Lista de itens contados com opção de remoção |
| `confirm-finalizar.tsx` | Modal de confirmação + tela de sucesso pós-finalização |
| `confirm-remover-item.tsx` | Modal de confirmação de remoção de item |

**Fluxo da contagem:**
1. Iniciar nova sessão (gera código único)
2. Registrar IMEIs via câmera ou digitação
3. Cada IMEI é validado (15 dígitos, sem duplicata na sessão)
4. Finalizar → sistema calcula divergências vs posição no Omie
5. Relatório disponível em `/estoques/relatorio-contagens/:id`

#### Relatório de Contagens (`/estoques/relatorio-contagens`)

Visão admin com análise detalhada pós-finalização.

| Componente | Descrição |
|------------|-----------|
| `resumo-cards.tsx` | KPIs: total contado, total sistema, acurácia |
| `visao-categoria.tsx` | Breakdown de divergências por categoria |
| `visao-item.tsx` | Lista item a item dos contados |
| `divergencias.tsx` | Itens divergentes com tipo (sobra/falta) e análise |

#### Rastreabilidade (`/estoques/rastreabilidade`)

Timeline completa da jornada de um dispositivo do voucher até a venda. Acesso restrito a administradores.

| Componente | Descrição |
|------------|-----------|
| `busca-dispositivo.tsx` | Campo de busca por IMEI |
| `info-dispositivo.tsx` | Header com modelo, categoria, origem e status atual |
| `timeline.tsx` | Timeline vertical com todas as etapas e durações |
| `metricas-item.tsx` | Métricas de ciclo total, aging e margem bruta |

**Etapas da timeline:** Voucher → Confirmação → Coleta → Recebimento → Triagem → [Desvio?] → Avaliação → Estoque → [Venda]

### Schema — Tabelas de Estoque

| Tabela | Responsabilidade |
|--------|-----------------|
| `estoques_contagens` | Cabeçalho de cada sessão de contagem (status, responsável, totais, acurácia) |
| `estoques_contagem_itens` | Itens contados em cada sessão (IMEI, modelo, método de leitura) |
| `estoques_contagem_logs` | Auditoria de ações na contagem |
| `estoques_contagem_divergencias` | Divergências identificadas pós-finalização (sobras e faltas) |
| `estoques_ajustes` | Ajustes de inventário aprovados por admin |

### Hooks (`use-estoques.ts`)

| Hook | Endpoint |
|------|---------|
| `useEstoqueResumo()` | GET `/api/estoques/resumo` |
| `usePosicaoEstoque(filtros)` | GET `/api/estoques/posicao` |
| `usePosicaoTotais()` | GET `/api/estoques/posicao/totais` |
| `useCurvaABC()` | GET `/api/estoques/curva-abc` |
| `useGiroEstoque()` | GET `/api/estoques/giro` |
| `useDashboardVolume(periodo)` | GET `/api/estoques/dashboard/volume` |
| `useDashboardFinanceiro(periodo)` | GET `/api/estoques/dashboard/financeiro` |
| `useDashboardTempo(periodo)` | GET `/api/estoques/dashboard/tempo` |
| `useDashboardEficiencia(periodo)` | GET `/api/estoques/dashboard/eficiencia` |
| `useDashboardGraficos(periodo)` | GET `/api/estoques/dashboard/graficos` |
| `useAgingEstoque()` | GET `/api/estoques/dashboard/aging-estoque` |
| `useTendencias(periodo)` | GET `/api/estoques/dashboard/tendencias` |
| `usePipeline()` | GET `/api/estoques/pipeline` |
| `usePipelineEtapa(etapa, page, limite, mes)` | GET `/api/estoques/pipeline/:etapa` |
| `useLeadTime(periodo)` | GET `/api/estoques/lead-time` |
| `useLeadTimeTendencia()` | GET `/api/estoques/lead-time/tendencia` |
| `useAgingMatriz()` | GET `/api/estoques/aging/matriz` |
| `useAgingEmEstoque()` | GET `/api/estoques/aging/estoque` |
| `useAgingFifo(pagina, etapa, faixa)` | GET `/api/estoques/aging/fifo` |
| `useAgingAlertasConfig()` | GET `/api/estoques/aging/alertas/config` |

### Endpoints REST — Estoque (completo)

#### Contagem

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/contagens` | Admin | Lista todas as contagens |
| GET | `/api/estoques/contagens/ativa` | User | Contagem ativa do usuário corrente |
| GET | `/api/estoques/contagens/em-aberto` | User | Sessões em andamento do usuário |
| POST | `/api/estoques/contagens` | User | Iniciar nova sessão de contagem |
| POST | `/api/estoques/contagens/:id/item` | User | Registrar IMEI na contagem |
| GET | `/api/estoques/contagens/:id/itens` | User | Listar itens da contagem |
| DELETE | `/api/estoques/contagens/:id/item/:itemId` | User | Remover item da contagem |
| POST | `/api/estoques/contagens/:id/finalizar` | User | Finalizar sessão |
| GET | `/api/estoques/contagens/:id/resumo` | Admin | Resumo pós-finalização |
| GET | `/api/estoques/contagens/:id/categoria` | Admin | Breakdown por categoria |
| GET | `/api/estoques/contagens/:id/itens-comparativo` | Admin | Comparativo sistema vs contado |
| GET | `/api/estoques/contagens/:id/divergencias` | Admin | Lista de divergências |
| GET | `/api/estoques/contagens/:id/export` | Admin | Export Excel da contagem |
| POST | `/api/estoques/ajustes` | Admin | Registrar ajuste de inventário |
| GET | `/api/estoques/ajustes/:contagemId` | Admin | Ajustes de uma contagem |

#### Posição

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/posicao` | Admin | Posição atual com filtros |
| GET | `/api/estoques/posicao/totais` | Admin | Totalizadores |
| GET | `/api/estoques/posicao/export` | Admin | Export da posição |
| POST | `/api/estoques/posicao/refresh` | Admin | Forçar atualização do cache |
| GET | `/api/estoques/filtros/categorias` | Admin | Opções de filtro |
| GET | `/api/estoques/filtros/marcas` | Admin | Opções de filtro |
| GET | `/api/estoques/filtros/modelos` | Admin | Opções de filtro |

#### Dashboard

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/dashboard/volume` | Admin | KPIs de volume |
| GET | `/api/estoques/dashboard/financeiro` | Admin | KPIs financeiros |
| GET | `/api/estoques/dashboard/tempo` | Admin | KPIs de tempo |
| GET | `/api/estoques/dashboard/eficiencia` | Admin | KPIs de eficiência |
| GET | `/api/estoques/dashboard/graficos` | Admin | Dados para gráficos |
| GET | `/api/estoques/dashboard/giro` | Admin | Giro de estoque |
| GET | `/api/estoques/dashboard/curva-abc` | Admin | Curva ABC |
| GET | `/api/estoques/dashboard/aging` | Admin | Resumo de aging |
| GET | `/api/estoques/dashboard/aging-estoque` | Admin | Aging detalhado |
| GET | `/api/estoques/dashboard/tendencias` | Admin | Evolução temporal |

#### Pipeline

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/pipeline` | Admin | Funil de etapas |
| GET | `/api/estoques/pipeline/:etapa` | Admin | Drill-down por etapa |

#### Lead Time

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/lead-time` | Admin | Ciclos por etapa |
| GET | `/api/estoques/lead-time/tendencia` | Admin | Tendência de lead time |

#### Aging

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/aging/alertas/config` | Admin | Configuração de thresholds |
| PUT | `/api/estoques/aging/alertas/config` | Admin | Atualizar thresholds |
| GET | `/api/estoques/aging/matriz` | Admin | Matriz faixa×etapa |
| GET | `/api/estoques/aging/estoque` | Admin | Itens em estoque com aging |
| GET | `/api/estoques/aging/fifo` | Admin | Lista FIFO paginada |
| POST | `/api/estoques/aging/criar-tarefa` | Admin | Criar tarefa para item crítico |

#### Rastreabilidade

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/estoques/rastreabilidade/busca` | Admin | Busca dispositivo por IMEI/código |
| GET | `/api/estoques/rastreabilidade/:imei` | Admin | Timeline completa do dispositivo |

---

## Histórico de PRs

| PR | Fase | Submódulo | Escopo |
|----|------|-----------|--------|
| #231 | 1 | Todos | Fundação do grupo Operações, sidebar em 2 níveis collapsible |
| #232 | 2 | Triagem | Dashboard de KPIs e tabela de recebimentos |
| #233 | 3 | Triagem | Fila de triagem FIFO com highlights e desvios (3 abas) |
| #235 | 4 | Avaliações | Integração API RenovSmart, 13 endpoints, dashboard analítico |
| #236 | 5 | Avaliações | Matriz de confusão interativa IA vs Humano |
| #237 | 6 | Avaliações | Sistema de curadoria por amostragem com galeria de imagens |
| #239 | 7 | Avaliações | Configurações POP 101 V3 e documentação do submódulo |
| #240 | 8 | Estoque | Dashboard (2 abas), posição de estoque, contagem interna, rastreabilidade |
| #241 | 9 | Estoque | Pipeline, lead time, aging report e hooks TanStack Query centralizados |
| #242 | 10 | Estoque | Documentação completa do módulo Operações |

---

## Padrões de UI

Todos os 4 submódulos seguem os mesmos padrões visuais:

- **PageHeader**: componente `<PageHeader title="..." description="..." />` em todas as páginas
- **KPI cards**: `<Card>` com ícone, valor principal e variação percentual
- **Tabelas**: paginação client-side com `useMemo`, empty state em PT-BR
- **Gráficos**: Recharts (`LineChart`, `BarChart`, `AreaChart`)
- **Loading**: `<Skeleton>` da shadcn/ui durante fetch
- **Empty state**: mensagem em PT-BR + ícone da Lucide
- **Dark mode**: suportado em todas as páginas via Tailwind `dark:`
- **Responsividade**: grid adaptativo (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- **Língua**: toda UI em PT-BR (labels, mensagens de erro, toasts)
