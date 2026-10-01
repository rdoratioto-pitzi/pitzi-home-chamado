-- Completa module_permissions de todos os usuários com a lista inteira de módulos.
-- Cadastros incompletos (ex.: contas do login com Google, só com "chamados") faziam o
-- formulário de edição em Configurações falhar sem aviso. O que já está gravado é mantido;
-- chave ausente vale false (chamados: true). Daqui em diante o storage grava completo.
-- Idempotente.

UPDATE users
SET module_permissions = (
  '{"chamados":true,"projetos":false,"tarefas":false,"reunioes":false,"okrs":false,"metas":false,"fluxogramas":false,"diagramas":false,"logistica":false,"triagem":false,"pricing":false,"conhecimento":false,"apis":false,"configuracoes":false,"updates":false,"estoques":false,"avaliacoes":false,"comercial":false,"apoio_vendas":false,"campos_chamado":false}'::jsonb
  || COALESCE(NULLIF(module_permissions, '')::jsonb, '{}'::jsonb)
)::text
WHERE module_permissions IS NULL
   OR module_permissions = ''
   OR NOT (module_permissions::jsonb ?& ARRAY['chamados','projetos','tarefas','reunioes','okrs','metas','fluxogramas','diagramas','logistica','triagem','pricing','conhecimento','apis','configuracoes','updates','estoques','avaliacoes','comercial','apoio_vendas','campos_chamado']);
