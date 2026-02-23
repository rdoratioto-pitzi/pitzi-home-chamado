# Fix Menu Order V3 - Projetos Abaixo de Reuniões

Mover "Projetos" para ficar abaixo de "Reuniões" no menu lateral.

## PROMPT 1: Reordenar Menu no Sidebar

IMPORTANTE: Ao gerar código, use o formato:
//ARQUIVO: caminho/do/arquivo.ts
[código aqui]

Encontre o arquivo do sidebar (provavelmente client/src/components/app-sidebar.tsx).

Localize o array de itens do menu que contém:
- Chamados
- Projetos
- Tarefas  
- Reuniões

Reordene APENAS para:
- Chamados
- Tarefas
- Reuniões
- Projetos (nova posição)

Exemplo de como deve ficar:

//ARQUIVO: client/src/components/app-sidebar.tsx
[todo o conteúdo do arquivo com a mudança aplicada]

REGRAS:
- Mostrar arquivo COMPLETO, não apenas o trecho
- Usar //ARQUIVO: no início
- Manter TODA a lógica existente
- APENAS reordenar posição de "Projetos"
