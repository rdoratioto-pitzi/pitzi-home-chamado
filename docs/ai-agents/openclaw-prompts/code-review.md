# 🔍 Code Review Template

## Arquivo/PR para Review
**Caminho:** `[ARQUIVO_OU_PR_URL]`

## Aspectos a Verificar

### Obrigatórios
- ✅ TypeScript types corretos e completos
- ✅ Error handling adequado (try/catch)
- ✅ Validação de inputs
- ✅ Performance (loops, queries, re-renders)
- ✅ Security concerns (XSS, injection, auth)
- ✅ Best practices do projeto
- ✅ Testes cobrem casos principais

### Opcionais
- Legibilidade do código
- Nomenclatura consistente
- Comentários úteis (não óbvios)
- Documentação atualizada

## Formato de Resposta
Fornecer:
1. **Issues Encontrados** (se houver)
   - Descrição do problema
   - Localização (arquivo:linha)
   - Severidade (🔴 Crítico / 🟡 Alto / 🟢 Baixo)
   - Sugestão de correção
2. **Sugestões de Melhoria** (opcional)
   - Otimizações possíveis
   - Patterns melhores
3. **Aprovação**
   - ✅ Aprovado (pode mergear)
   - ⚠️ Aprovado com ressalvas (pequenos ajustes)
   - ❌ Mudanças necessárias (bloquear merge)
