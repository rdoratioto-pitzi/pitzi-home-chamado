# Produto ativo: central de chamados

Decisão de produto: 23/09/2026, solicitada por Rodrigo.

A aplicação é um sistema de chamados. A tela inicial (`/`) mantém o painel de
módulos, agora apenas com o card Chamados. `/chamados` tem lista, filtros,
indicadores, kanban e abertura de chamados. URLs antigas do workspace e dos
módulos desativados redirecionam para a tela inicial.

O menu oferece Início, Chamados, Novo chamado e Configurações, respeitando as permissões
existentes. Configurações mantém usuários, responsáveis, campos/SLA, autenticação,
notificações e marca. Permissões de módulos inativos deixam de aparecer no editor.

## APIs e serviços

`shared/active-routes.ts` define as APIs de suporte permitidas; middlewares no
Express e no Worker devolvem 404 antes dos handlers das demais APIs, inclusive
para administradores. Autenticação e autorização existentes continuam valendo.

Permanecem autenticação, chamados, responsáveis, usuários, configurações, SLA,
notificações, uploads, versão/saúde, consulta externa de chamados e cadastro
auxiliar de áreas usado pelos usuários. A entrega de `/objects/*` mantém a
proteção própria por sessão/assinatura/marca pública.

Jobs locais de recorrência, Git Analytics, biblioteca e pré-aquecimento de estoque
não iniciam; o startup também não altera a configuração Omie. Dados e schemas dos
módulos legados não são removidos. Integrações externas dos módulos desativados
passam a receber 404; isso é intencional.

## Validação e auditoria renov-security

- Branch `feat/chamados-only`, base `fix/itsm-phase0-security-3`; mantém a cadeia do fork.
- 111 testes locais passaram; 30 de PostgreSQL ficam para o CI com banco descartável.
- 28 novos casos verificam os dois middlewares, incluindo leitura/escrita bloqueada,
  autenticação, comentários, uploads e configurações preservados.
- Build Vite e bundle Worker dry-run passaram. `git diff --check` sem erros.
- Sem dependências, migrations, arquivos `.env` ou credenciais adicionados.
- Supply chain permanece conforme auditoria da Fase 0: sem alertas altos/críticos;
  há alertas moderados/baixos preexistentes na raiz. Nenhum pacote novo instalado.
- Status: APROVADO COM RESSALVAS (diff grande por remoção da navegação legada;
  não houve validação manual no navegador). Não é aprovação de deploy.
- Revisão de Marcelo continua pendente de acesso como colaborador ao fork.

Publicação depende de revisão/merge e deploy dos dois componentes. Nenhum banco
de desenvolvimento/produção foi alterado por esta implementação.
