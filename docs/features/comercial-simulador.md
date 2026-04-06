# Modulo Comercial — Simulador CPD

## Visao Geral

Ferramenta de simulacao financeira para avaliacao de negocios de trade-in.
Permite ao time comercial calcular o **Custo por Dispositivo (CPD)**, margens
e markup antes de fechar propostas com revendas e operadoras.

Acesso: `/comercial/simulador`
Permissao: `comercial: true` no perfil do usuario

---

## Arquitetura

| Camada      | Localizacao                                          |
|-------------|------------------------------------------------------|
| Pagina      | `client/src/pages/comercial/simulador.tsx`           |
| Componentes | `client/src/pages/comercial/components/` (9 arquivos)|
| Lib/Calculos| `client/src/pages/comercial/lib/` (4 arquivos)      |
| Sidebar     | Definido em `client/src/components/layout/sidebar.tsx`|

### Componentes

| Arquivo                    | Responsabilidade                              |
|----------------------------|-----------------------------------------------|
| `simulador-form.tsx`       | Formulario com abas (Simulacao / Fiscal)      |
| `simulador-results.tsx`    | Cards de resultado (MC, Markup, Margem)       |
| `anatomia-negocio.tsx`     | DRE simplificado — cascata de custos          |
| `icms-grid.tsx`            | Grid interativa de ICMS por UF                |
| `dashboard-view.tsx`       | Orquestrador do dashboard estrategico         |
| `dashboard-hero.tsx`       | Hero card com CPD medio e cor condicional      |
| `dashboard-kpi-row.tsx`    | Row de KPIs (volume, ticket, CMC, margem)      |
| `dashboard-breakdown.tsx`  | Breakdown visual do CPD                        |
| `kpi-edit-modal.tsx`       | Modal para insercao manual de KPIs por mes    |

### Libs

| Arquivo              | Responsabilidade                          |
|----------------------|-------------------------------------------|
| `simulador-calc.ts`  | Formula do CPD e todas as margens         |
| `icms-table.ts`      | Tabela ICMS por UF (SP origem)            |
| `dashboard-data.ts`  | Tipos e dados iniciais do dashboard       |
| `export-pdf.ts`      | Export PDF via window.print() + CSS print |

---

## Campos e Calculos

### Inputs do Simulador

| Campo               | Default    | Descricao                                |
|---------------------|------------|------------------------------------------|
| Volume              | 100        | Quantidade de dispositivos               |
| Valor Unit. Compra  | R$ 0,00   | Preco de aquisicao por unidade           |
| Valor Unit. Venda   | R$ 0,00   | Preco de revenda por unidade             |
| Markup Meta         | 1,50x      | Meta de markup para semaforo             |
| UF Destino          | SP         | Estado destino (define ICMS)             |
| ICMS %              | 3,60%      | Aliquota ICMS (auto-preenchida pela UF)  |
| PIS %               | 0,65%      | Aliquota PIS                             |
| COFINS %            | 3,00%      | Aliquota COFINS                          |
| Frete Medio / Un    | R$ 0,00   | Custo logistico por unidade              |
| Comissao Varejista % | 10%       | Percentual sobre CMC (custo mercadoria)  |
| Comissao Representante % | 0%    | Percentual sobre Venda                   |

### Formula do CPD

```
CPD = CMC + ICMS + PIS + COFINS + Frete + Comissao Varejista + Comissao Representante

Onde:
  ICMS    = Venda x (ICMS% / 100)
  PIS     = Venda x (PIS% / 100)
  COFINS  = Venda x (COFINS% / 100)
  ComVar  = CMC x (ComVar% / 100)
  ComRep  = Venda x (ComRep% / 100)
```

### Margem Liquida

```
Margem Liq. = Venda - CPD
Margem %    = (Margem Liq. / Venda) x 100
Markup      = Venda / CMC
```

---

## Tabela ICMS por UF (Origem SP)

| UF | Aliquota % | UF | Aliquota % | UF | Aliquota % |
|----|------------|----|------------|----|------------|
| SP | 3,60       | MG | 0,60       | RS | 2,40       |
| PR | 0,60       | RJ | 0,60       | SC | 2,40       |
| DF | 0,35       | ES | 0,35       | MA | 0,35       |
| PA | 0,42       | TO | 0,70       | MS | 1,05       |
| AL | 1,40       | AM | 1,40       | BA | 1,40       |
| CE | 1,40       | GO | 1,40       | MT | 1,40       |
| PB | 1,40       | PE | 1,40       | PI | 1,40       |
| RN | 1,40       | RO | 1,40       | RR | 1,40       |
| SE | 1,40       | AC | n/d        | AP | n/d        |

---

## Anatomia do Negocio (DRE Simplificado)

Cascata visual de custos exibida como tabela com cores:

1. Receita de Revenda (verde)
2. (-) CMC (vermelho)
3. = Margem de Contribuicao (verde)
4. (-) ICMS (azul)
5. (-) PIS + COFINS (azul)
6. (-) Frete (amarelo)
7. (-) Comissao Varejista (amarelo)
8. (-) Comissao Representante (amarelo, oculta quando 0%)
9. **= CPD (total, bold)**
10. **= Margem Liquida (verde, bold)**
11. **Markup (verde/amarelo condicional vs meta)**

---

## Dashboard Estrategico

Visao gerencial com dados reais de operacao inseridos manualmente pelo time.

### Componentes
- **Hero**: CPD medio com cor condicional (verde se margem > 0)
- **KPI Row**: Volume, Ticket Medio, CMC, Margem Un, Margem %, Margem Total
- **Breakdown**: Decomposicao visual do CPD em barras horizontais
- **Seletor de Mes**: Navegacao entre meses (Mar-Jun 2026)
- **Modal Atualizar KPIs**: Insercao manual dos dados de cada mes

---

## Export PDF

Utiliza `window.print()` com CSS `@media print`:
- Oculta sidebar e botoes de navegacao
- Adiciona header "Renov — Simulador CPD" com data e revenda
- Forca impressao de backgrounds (print-color-adjust: exact)
- Layout A4 landscape com page-break entre simulador e anatomia

---

## Fluxo do Comercial

1. Comercial recebe oportunidade de trade-in de uma revenda
2. Abre o Simulador CPD e preenche volume, precos de compra/venda
3. Seleciona a UF destino para ICMS correto
4. Ajusta comissoes (varejista e representante se aplicavel)
5. Avalia CPD, margem e markup na Anatomia do Negocio
6. Se markup >= meta: proposta viavel → exporta PDF para aprovacao
7. Se markup < meta: renegocia precos ou identifica onde reduzir custo
8. Apos fechamento, insere dados reais no Dashboard para acompanhamento

---

## Proximos Passos

- Integracao com API Omie para precos automaticos de compra
- Historico de simulacoes salvas no banco de dados
- Comparativo entre simulacoes (lado a lado)
- Dashboard com dados vindos da API (ao inves de insercao manual)
- Grafico de evolucao mensal de CPD e margens
- Permissao granular por perfil (visualizar vs editar)
