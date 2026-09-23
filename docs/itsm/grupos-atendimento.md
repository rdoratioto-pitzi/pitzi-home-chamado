# Grupos de atendimento (Fase 1)

Decisão de produto (23/09/2026): o chamado é direcionado a um grupo que atende, escolhido
por quem abre. Os grupos substituem as antigas categorias. O sistema começa com banco
novo; chamados antigos não são migrados.

Grupos iniciais (migration `0022_support_groups.sql`): Suporte TI, SAP, Dados e Dev.

## Modelo

- `support_groups`: chave (`suporte-ti`, `sap`, `dados`, `dev`), nome, descrição, ordem, ativo.
- `support_group_members`: membros por grupo, separados por tenant. Formam a fila do grupo.
- A chave do grupo é gravada em `tickets.category` e em `ticket_responsaveis.categoria`,
  então a regra de responsável padrão continua sendo por grupo + tipo.

## API (Worker)

- `GET /api/v1/support-groups`: grupos ativos com os membros do tenant do usuário.
- `PUT /api/v1/support-groups/:id/members` (admin): substitui os membros; só aceita
  usuários do mesmo tenant.
- Abertura (`POST /api/tickets` e `POST /api/workspace/chamados`) exige um grupo ativo.
  A abertura rápida passa a aplicar o responsável padrão, que antes só a página completa usava.
- Regras de responsáveis ficam no tenant de quem cria; outros tenants não leem nem alteram.

O Express local não recebeu a rota nova (ADR-0001: Worker é o backend principal).

## Telas

- "Grupo de atendimento" no lugar de "Categoria" na abertura rápida, na página de novo
  chamado e no detalhe. Uma lista só, vinda da API.
- Configurações → Grupos: membros de cada grupo. Configurações → Responsáveis: responsável
  padrão por grupo e tipo. A aba de campos não edita mais categorias.

Próxima entrega: fila do grupo com "Assumir" e "Transferir".
