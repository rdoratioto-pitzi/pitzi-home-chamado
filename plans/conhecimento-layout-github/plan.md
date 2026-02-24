# Feature: Layout Estilo GitHub para Base de Conhecimento

Transformar página "Visão Geral" do módulo Base de Conhecimento em layout de pastas estilo GitHub.

## PROMPT 1: Criar Componente de Lista Estilo GitHub

Criar novo componente: client/src/components/conhecimento/file-browser.tsx

Requisitos:
- Layout de lista com ícones de pasta/arquivo
- Colunas: Nome | Última Modificação | Descrição
- Ícones: Folder (pasta), FileText (documento)
- Hover effects
- Click para navegar/abrir
- Breadcrumbs para navegação

Stack:
- shadcn/ui: Table, Button
- lucide-react: Folder, FileText, ChevronRight
- Tailwind CSS

Estrutura:
```tsx
interface FileItem {
  type: 'folder' | 'file';
  name: string;
  description?: string;
  updatedAt: Date;
  path: string;
}
```

IMPORTANTE:
- Usar //ARQUIVO: client/src/components/conhecimento/file-browser.tsx
- Criar arquivo NOVO
- Componente completo e funcional

## PROMPT 2: Integrar na Página Visão Geral

Arquivo: client/src/pages/conhecimento/index.tsx

Substituir layout atual de cards/grid por:
- Importar FileBrowser component
- Passar dados de documentos existentes
- Manter busca e filtros
- Adicionar breadcrumbs no topo

Estrutura:
1. Header com título + breadcrumbs
2. Barra de busca e filtros
3. FileBrowser component
4. Footer com paginação

IMPORTANTE:
- Usar //ARQUIVO: client/src/pages/conhecimento/index.tsx
- Este arquivo tem >200 linhas, usar DIFF se possível
- Manter TODA a lógica de fetch e state
- Apenas mudar apresentação visual

## PROMPT 3: Adicionar Ordenação e Pastas Primeiro

Arquivo: client/src/components/conhecimento/file-browser.tsx

Adicionar:
- Click em header para ordenar (nome, data)
- Pastas sempre aparecem primeiro
- Ícone de seta indicando ordenação
- Estado de ordenação (asc/desc)

Usar:
- useState para sort state
- Array.sort() para ordenação
- Pastas vs arquivos separados

IMPORTANTE:
- Modificar arquivo criado no PROMPT 1
- Adicionar apenas funcionalidade de sort
