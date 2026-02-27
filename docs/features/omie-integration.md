# Integração API Omie - Documentação Completa

## 📋 Visão Geral

A integração com a API Omie permite consultar dados do ERP diretamente no Renov Home, abrangendo:

- Gestão de Compras, Estoque e Produção
- Vendas e Documentos Fiscais (NF-e, NFS-e)
- Transporte (CT-e)
- Finanças (Contas a Pagar/Receber, Caixa)
- Cadastros Gerais (Clientes, Categorias, Empresa)

**Total de Endpoints:** 14 endpoints organizados em 6 abas

---

## 🔑 Credenciais

### Configuração

As credenciais são armazenadas no banco de dados PostgreSQL na tabela `omie_config`:

**Tabela:** `omie_config`

- `app_key`: Chave de integração fornecida pela Omie
- `app_secret`: Secret de autenticação
- `is_active`: Status da integração

### Como Configurar

1. Acesse: **Integrações > API Omie > Visão Geral**
2. Clique em **"Editar"**
3. Insira App Key e App Secret fornecidos pela Omie
4. Clique em **"Salvar"**
5. Teste a conexão com o botão **"Testar Conexão"**

---

## 📂 Estrutura de Abas

### 1️⃣ Visão Geral

- Exibição de credenciais (modo visualização/edição)
- Teste de conexão
- Contador de endpoints disponíveis

### 2️⃣ Compras, Estoque e Produção (4 endpoints)

**Produtos**

- **Endpoint:** `geral/produtos/`
- **Call:** `ListarProdutos`
- **Filtros:** código, descrição
- **Retorno:** Lista de produtos com estoque e valores

**Consulta de Estoque**

- **Endpoint:** `estoque/consulta/`
- **Call:** `ConsultarEstoque`
- **Filtros:** código produto (obrigatório), local estoque
- **Retorno:** Saldo total, reservado e disponível

**Ordens de Compra**

- **Endpoint:** `produtos/pedidocompra/`
- **Call:** `ListarPedidosCompra`
- **Filtros:** status, ordenação
- **Retorno:** Pedidos com fornecedor, valor e status

**Movimentação de Estoque**

- **Endpoint:** `estoque/movimento/`
- **Call:** `ListarMovimentos`
- **Filtros:** data inicial, data final, tipo (E/S)
- **Retorno:** Histórico de entradas e saídas

### 3️⃣ Vendas e NF-e (3 endpoints)

**Pedidos de Venda**

- **Endpoint:** `produtos/pedido/`
- **Call:** `ListarPedidos`
- **Filtros:** número, cliente, status, data
- **Retorno:** Pedidos com cliente, valor e etapa

**NF-e (Produtos)**

- **Endpoint:** `produtos/nfconsultar/`
- **Call:** `ConsultarNF`
- **Filtros:** número NF, série, data emissão
- **Retorno:** Notas fiscais com chave NFe e situação

**NFS-e (Serviços)**

- **Endpoint:** `servicos/nfse/`
- **Call:** `ConsultarNFSe`
- **Filtros:** número RPS, data
- **Retorno:** Notas de serviço com tomador e valor

### 4️⃣ Transporte (1 endpoint)

**CT-e**

- **Endpoint:** `servicos/cte/`
- **Call:** `ListarCTe`
- **Filtros:** número, série, data, situação
- **Retorno:** Conhecimentos de transporte com remetente, destinatário e chave
- **KPIs:** Total, Autorizados, Cancelados

### 5️⃣ Finanças (3 endpoints)

**Contas a Pagar**

- **Endpoint:** `financas/contapagar/`
- **Call:** `ListarContasPagar`
- **Filtros:** data vencimento, status
- **Retorno:** Contas com fornecedor, valor e vencimento
- **KPIs:** Total a Pagar, Vencidas, Pagas
- **Alertas:** Contas vencidas destacadas em vermelho

**Contas a Receber**

- **Endpoint:** `financas/contareceber/`
- **Call:** `ListarContasReceber`
- **Filtros:** data vencimento, status
- **Retorno:** Contas com cliente, valor e recebimento
- **KPIs:** Total a Receber, Vencidas, Recebidas
- **Alertas:** Contas vencidas destacadas em vermelho

**Movimento de Caixa**

- **Endpoint:** `financas/mcc/`
- **Call:** `ConsultarMovimentoCaixa`
- **Filtros:** data inicial, data final, tipo (E/S/T)
- **Retorno:** Movimentos com descrição e categoria
- **KPIs:** Total Entradas, Total Saídas, Saldo

### 6️⃣ Geral (3 endpoints)

**Clientes**

- **Endpoint:** `geral/clientes/`
- **Call:** `ListarClientes`
- **Filtros:** CNPJ/CPF, razão social, cidade, status
- **Retorno:** Clientes com contato completo
- **Formatação:** CNPJ/CPF automática

**Categorias**

- **Endpoint:** `geral/categorias/`
- **Call:** `ListarCategorias`
- **Filtros:** tipo (Receita/Despesa)
- **Retorno:** Categorias agrupadas por tipo
- **Layout:** Tabelas separadas para Receitas e Despesas

**Dados da Empresa**

- **Endpoint:** `geral/empresas/`
- **Call:** `ConsultarEmpresa`
- **Filtros:** Nenhum (dados únicos)
- **Retorno:** Informações completas da empresa
- **Seções:** Informações Básicas, Endereço, Contato

---

## 🔧 Stack Técnico

### Backend

- **Arquivo de Rotas:** `server/routes/omie.ts`
- **Service:** `server/services/omie.service.ts`
- **Middleware:** `requireAuth` (autenticação obrigatória)

**Rotas Disponíveis:**

```
GET  /api/omie/config       - Obter configuração
POST /api/omie/config       - Atualizar credenciais
POST /api/omie/test         - Testar conexão
GET  /api/omie/logs         - Logs de sincronização
POST /api/omie/call         - Chamada genérica à API
```

### Frontend

**Componentes:**

- `client/src/pages/integrations/omie/OmieIntegration.tsx` - Página principal
- `client/src/pages/integrations/omie/OmieOverview.tsx` - Visão geral
- `client/src/pages/integrations/omie/OmieComprasEstoque.tsx` - Compras
- `client/src/pages/integrations/omie/OmieVendas.tsx` - Vendas
- `client/src/pages/integrations/omie/OmieTransporte.tsx` - Transporte
- `client/src/pages/integrations/omie/OmieFinancas.tsx` - Finanças
- `client/src/pages/integrations/omie/OmieGeral.tsx` - Geral

### Banco de Dados

**Tabela: omie_config**

```sql
CREATE TABLE omie_config (
  id SERIAL PRIMARY KEY,
  app_key VARCHAR(255) NOT NULL,
  app_secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Tabela: omie_sync_log**

```sql
CREATE TABLE omie_sync_log (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  total_records INTEGER DEFAULT 0,
  request_params JSONB,
  response_data JSONB,
  error_message TEXT,
  synced_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 Padrões de UI

### Badges de Status

- **Verde (default):** Autorizado, Pago, Recebido, Ativo
- **Vermelho (destructive):** Cancelado, Vencido, Inativo
- **Amarelo (secondary):** Pendente, Aberto, Em Processamento
- **Cinza (outline):** Outros status

### Alertas Visuais

- **Contas Vencidas:** Linha destacada em vermelho claro
- **Ícone de Alerta:** AlertTriangle ao lado da data de vencimento

### KPIs (Cards de Métricas)

- Exibidos no topo de seções financeiras e CT-e
- Cores: Verde (positivo), Vermelho (negativo/alertas)
- Valores formatados em BRL

---

## 📝 Formato de Dados

### Datas

- **Formato:** DD/MM/YYYY
- **Exemplo:** 27/02/2026

### Valores Monetários

- **Formato:** R$ 0.000,00
- **Exemplo:** R$ 1.250,50

### Documentos

- **CNPJ:** 00.000.000/0000-00
- **CPF:** 000.000.000-00

---

## 🐛 Troubleshooting

### Erro 401 - Unauthorized

**Causa:** Usuário não autenticado ou sessão expirada

**Solução:** Fazer login novamente no Renov Home

### Erro 500 - Credenciais Inválidas

**Causa:** App Key ou App Secret incorretos

**Solução:**

1. Verificar credenciais no painel Omie
2. Atualizar na aba Visão Geral
3. Testar conexão

### "Falha na conexão"

**Causa:** API Omie indisponível ou credenciais inválidas

**Solução:**

1. Verificar status da API Omie
2. Confirmar credenciais
3. Verificar logs em `/api/omie/logs`

### Campos vazios nos resultados

**Causa:** Parâmetros de filtro incorretos ou dados não existem no Omie

**Solução:**

1. Verificar documentação oficial da Omie
2. Testar com filtros mais amplos
3. Verificar se dados existem no painel Omie

---

## 📊 Logs e Auditoria

### Visualizar Logs

**Endpoint:** `GET /api/omie/logs?category=<categoria>&limit=<numero>`

**Categorias:**

- `compras`
- `vendas`
- `transporte`
- `financas`
- `geral`

### Estrutura do Log

```json
{
  "id": 1,
  "endpoint": "geral/produtos/ListarProdutos",
  "category": "compras",
  "status": "success",
  "total_records": 25,
  "request_params": {...},
  "response_data": {...},
  "error_message": null,
  "synced_at": "2026-02-27T10:30:00Z"
}
```

---

## 🚀 Roadmap Futuro

### Próximas Features

- [ ] Sincronização automática agendada (cron jobs)
- [ ] Webhooks da Omie (se disponível)
- [ ] Dashboard com métricas consolidadas
- [ ] Exportação de relatórios (CSV/Excel)
- [ ] Integrações cruzadas com outros módulos Renov Home
- [ ] Cache de consultas frequentes
- [ ] Notificações de contas vencidas

### Melhorias de UX

- [ ] Paginação client-side para grandes volumes
- [ ] Filtros salvos (favoritos)
- [ ] Visualização de XML/Chave NFe em modal
- [ ] Download de DANFE
- [ ] Busca rápida global

---

## 📞 Suporte

**Documentação Oficial Omie:**

https://developer.omie.com.br/service-list/

**Contato Omie:**

Acessar painel Omie → Suporte

**Equipe Renov:**

- Matheus (CEO/Tech Lead)
- Marcelo (CTO)

---

*Última atualização: Fevereiro 2026*

*Versão da Integração: 1.0.0*
