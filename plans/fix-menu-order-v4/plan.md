# Fix Menu Order V4 - Projetos Abaixo de Reuniões

Mover "Projetos" para abaixo de "Reuniões" no menu lateral.

## PROMPT 1: Reordenar Menu

INSTRUÇÕES CRÍTICAS PARA O LLM:

1. PRIMEIRO: Leia o arquivo client/src/components/app-sidebar.tsx COMPLETO
2. Encontre o array `allMenuItems` (ou similar) que contém os itens do menu
3. Identifique EXATAMENTE onde estão "Projetos" e "Reuniões"
4. Reordene APENAS para colocar "Projetos" logo APÓS "Reuniões"
5. Mantenha TODO o resto do arquivo IDÊNTICO

FORMATO DE SAÍDA OBRIGATÓRIO:

//ARQUIVO: client/src/components/app-sidebar.tsx
[ARQUIVO COMPLETO MODIFICADO AQUI - TODO O CONTEÚDO]

REGRAS:
- Mostrar arquivo COMPLETO (todos os imports, toda lógica, tudo)
- APENAS reordenar posição no array
- NÃO adicionar explicações após o código
- NÃO usar markdown com ```
- Código TypeScript válido puro

ORDEM ESPERADA NO ARRAY:
- Início
- Macgyver IA  
- Chamados
- Tarefas
- Reuniões
- Projetos ← MOVER PARA CÁ (atualmente está antes de Tarefas)

O arquivo usa:
- shadcn/ui (NÃO Semantic UI)
- Wouter (NÃO Next.js router)
- lucide-react para ícones
- TypeScript
