# Fase 0 — validação do terceiro lote

Data: 23/09/2026. Branch: `fix/itsm-phase0-security-3`.
Base da revisão: `fix/itsm-phase0-security-2` (PR #2, dependente do PR #1).

## Estado

Implementação do terceiro lote validada localmente; Fase 0 ainda depende de revisão,
merge e validação no ambiente de destino. Fase 1 não iniciada.

O lote adiciona migrations versionadas antes do deploy, sessões revogáveis,
isolamento de chamados e usuários por tenant, recuperação por link de uso único,
leitura privada de anexos, permissões de módulo na API e proteção da automação Git.
ADR 0001 define Worker/Hono como backend principal para os novos módulos ITSM.

## Correções encontradas na revisão

- Caminhos gerados pelos agentes recusam symlinks e metadados `.git`.
- Git trata caminhos literalmente e commita apenas os arquivos indicados, preservando
  alterações previamente preparadas por outra pessoa fora do commit.
- Recuperação de senha aguarda o envio do e-mail antes de devolver a resposta;
  a operação não fica pendente após o encerramento da requisição do Worker.
- Overrides específicos atualizam nanoid do Excalidraw para 3.3.19 e do conversor
  Mermaid para 5.1.16. O conversor usa o export ESM `nanoid`, mantido na versão 5;
  build validado, mas conversão visual ainda requer teste manual.

## Validação

- PostgreSQL 16 descartável, separado dos bancos do projeto: schema preparado e
  migrations 0017, 0019, 0020 e 0021 aplicadas sem erro.
- `npm test` com `TEST_DATABASE_URL`: 113 testes passaram, 22 arquivos, nenhum ignorado.
- `npx vite build`: passou; aviso de chunks maiores que 500 kB.
- Worker: `npx wrangler deploy --dry-run`: passou, sem publicação.
- `git diff --check`: passou.
- `npm ls --all`: árvore de dependências sem problemas reportados.
- Typecheck global e navegação manual não executados nesta revisão.

## Renov Security Audit v2.0

Status: **APROVADO COM RESSALVAS para revisão em PR; não equivale a aprovação de deploy**.

### Supply chain

- `.npmrc` com `min-release-age=7` na raiz, Worker e agents. A presença dessa
  configuração não foi tomada como garantia de enforcement pelo npm.
- Nenhuma ocorrência das versões bloqueadas de axios nem de plain-crypto-js nos lockfiles.
- Versões nanoid consultadas no registro npm: 3.3.19 publicada em 10/09/2026;
  5.1.16 em 24/06/2026, ambas com mais de sete dias.
- `npm audit` raiz: 0 críticas, 0 altas, 5 moderadas e 3 baixas.
- `npm audit` Worker: zero vulnerabilidades reportadas.
- Restam alertas em dependências do editor Quill, Google Cloud Storage e esbuild;
  atualizações que exigem alteração de versão principal não foram aplicadas automaticamente.

### Credenciais

- Nenhum arquivo `.env` incluído no diff.
- Varredura de padrões conhecidos de chaves privadas e tokens no diff sem ocorrências.
  Não substitui análise especializada de todo o histórico.
- Literais de senha/token nos testes são fixtures; logs operacionais permanecem
  nos agentes e no runner de migrations. Nenhuma credencial real nova identificada.

### Código e fluxo

- Diff amplo (52 arquivos antes das correções desta revisão, incluindo lockfiles):
  requer revisão por partes.
- Repositório é o fork `rdoratioto-pitzi/pitzi-home-chamado`, sem branch `develop`.
  A cadeia existente é PR #1 → main, PR #2 → branch do PR #1; este lote segue
  sobre a branch do PR #2. Não criar uma base `develop` artificial neste lote.
- ADR 0001 documenta a diferença de runtime: controles de middleware são do Worker.
  Express não deve ser exposto publicamente.
- O isolamento testado cobre chamados e usuários; não certifica isolamento completo
  de todos os módulos legados, como projetos e kanban.

## Pendências antes de encerrar a Fase 0

1. Revisar a cadeia de PRs com Marcelo; nenhum merge autorizado pela revisão local.
2. Confirmar CI remoto, segredos de deploy e `LOGISTICA_WEBHOOK_SECRET` citado no PR #2.
3. Validar no navegador login/logout, recuperação de senha, anexos e conversão Mermaid.
4. Tratar ou aceitar explicitamente os alertas npm moderados/baixos remanescentes.
5. Fazer deploy somente após aprovação e validar o ambiente de destino.

Não houve deploy nem alteração em banco de desenvolvimento/produção nesta validação.

## Validação remota do PR #3

PR: https://github.com/rdoratioto-pitzi/pitzi-home-chamado/pull/3 (rascunho).
Primeira execução remota passou testes/migrations/build frontend e identificou
Node 20 incompatível com o Wrangler instalado, que exige Node 22. Workflows de
CI e deploy foram alinhados em Node 22; nova execução deve confirmar o resultado.

A API do GitHub recusou a solicitação de revisão de `marcelo-maciel` (HTTP 422):
ele não é colaborador deste fork. O responsável pelo repositório precisa conceder
acesso antes de ser possível solicitar formalmente a revisão obrigatória.
