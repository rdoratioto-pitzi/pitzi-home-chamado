# ReactBits MCP

> Referência de 135+ componentes React animados — eleve a qualidade visual do frontend.

## Pacote
`reactbits-dev-mcp-server`

## Fonte
[reactbits.dev](https://reactbits.dev) — biblioteca de componentes animados para React

## Casos de Uso neste Projeto
- Adicionar animações de alta qualidade a componentes existentes (kanban, drawers, modais)
- Substituir loaders e spinners por versões animadas profissionais
- Adicionar backgrounds animados a páginas de dashboard ou landing
- Melhorar transições entre estados (loading, erro, vazio, preenchido)
- Encontrar componentes de cursor, texto animado e outros efeitos visuais

## Configuração no `.mcp.json`
```json
"reactbits": {
  "command": "npx",
  "args": ["-y", "reactbits-dev-mcp-server"]
}
```

## Variáveis de Ambiente
Nenhuma necessária.

## Categorias de Componentes Disponíveis

| Categoria | Exemplos | Qualidade |
|---|---|---|
| **Backgrounds** | Aurora, Beams, Particles, DotGrid | ⭐⭐⭐⭐⭐ |
| **Cursors** | BlobCursor, SplashCursor, Magnet | ⭐⭐⭐⭐⭐ |
| **Text Animations** | BlurText, CountUp, CircularText, ShinyText | ⭐⭐⭐⭐ |
| **Components** | InfiniteMenu, CardCarousel, SpotlightCard | ⭐⭐⭐⭐ |
| **Buttons** | AnimatedButton, MagneticButton | ⭐⭐⭐ |
| **Loaders** | Ripple, Ring, Spinner animado | ⭐⭐⭐ |

## Exemplos de Uso
```
"Mostre componentes de background animado compatíveis com Tailwind"
"Encontre um loader animado profissional para usar durante carregamento do kanban"
"Liste todos os componentes de text animation disponíveis"
"Mostre o código do componente Aurora para usar como background da homepage"
"Quais componentes funcionam bem com dark mode?"
"Encontre um componente de card com hover effect para usar nos cards de projeto"
```

## Integração com o Projeto

O projeto usa:
- **Tailwind CSS** — maioria dos componentes ReactBits são compatíveis
- **Framer Motion** (já instalado) — muitos componentes usam Framer Motion
- **shadcn/ui** — complementa, não substitui
- **React 18** — todos os componentes são compatíveis

## Notas
- Os componentes são referências de código — você copia e adapta, não instala como pacote
- Verificar compatibilidade com TypeScript antes de integrar (maioria suporta)
- Framer Motion já está no `package.json` do projeto — facilita integração
