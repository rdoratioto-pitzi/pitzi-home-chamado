# FEEDBACK PARA MAX - APRENDIZADOS E CORREÇÕES

## 1. Como usar este arquivo
- **Objetivo principal**: Documentar erros cometidos em tasks anteriores, suas consequências e lições aprendidas.
- **Referência rápida**: Consultar antes de tasks semelhantes (ex: renomeações, edições em massa) para evitar repetições.
- **Manutenção**: Sempre adicionar novos aprendizados por data. Review semanal durante heartbeats para atualizar MEMORY.md.
- **Regra de ouro**: NUNCA ignorar este arquivo em operações críticas como renomeações. Checklist é OBRIGATÓRIO.

## 2. Aprendizados por data

### 03/03/2026
**Task**: Renomear módulo &quot;Base de Conhecimento&quot; → &quot;Biblioteca&quot;.

**Erros cometidos**:
- Edit tool falhou em `app-sidebar.tsx` (26 chars mismatch) mas continuei sem alternativa (read/write/sed).
- Não executei `grep -r &quot;ConhecimentoPage&quot; client/src/` para verificar **TODAS** referências.
- Não testei `localhost:5050` antes de declarar &quot;concluído&quot;.
- Componente exportava `ConhecimentoPage` mas nova página deveria ser `BibliotecaPage` (inconsistência).
- Faltou atualizar imports em `App.tsx` e variáveis como `setBibliotecaOpen` (erro de digitação: deveria ser `setBibliotecaAberta`?).

**Consequências**:
- App quebrou: `Uncaught ReferenceError: ConhecimentoPage is not defined`.
- `setBibliotecaOpen is not defined` em múltiplos pontos.
- Matheus corrigiu manualmente ~5 arquivos, perda de ~2 horas de debug.
- Confiança abalada: &quot;quase ok&quot; não é ok.

**Como deveria ter feito**:
1. **Mapear**: `grep -r &quot;ConhecimentoPage|conhecimento&quot; client/src/ --include=&quot;*.tsx&quot;` **ANTES** de editar.
2. **SE edit falhar**: Parar imediatamente, usar `read app-sidebar.tsx`, analisar, `write` com correções precisas OU `exec sed -i`.
3. **Pós-edit**: grep final = ZERO refs residuais.
4. **Teste full**: `pkill -f vite && pkill -f tsx && npm run dev`, abrir `localhost:5050`, navegar TODAS rotas afetadas, screenshot.
5. **Só então**: git commit + push.
6. **Extra**: Usar `git diff` para review humano antes de push.

## 3. Checklist para renomeações (OBRIGATÓRIO - marque com x)
[ ] 1. `grep -r &quot;TERMO_ANTIGO&quot; client/src/` para mapear **TODAS** refs (arquivos, imports, exports, vars).
[ ] 2. Renomear pastas/arquivos (mv + git mv).
[ ] 3. Atualizar imports/exports em **cada** arquivo afetado (verificar com grep).
[ ] 4. Atualizar rotas (App.tsx, router).
[ ] 5. Atualizar permissões/vars/states (ex: useBibliotecaOpen).
[ ] 6. `grep -r &quot;TERMO_ANTIGO&quot;` = ZERO resultados residuais.
[ ] 7. `pkill -f vite && pkill -f tsx`.
[ ] 8. `npm run dev` e testar **todas** rotas no navegador.
[ ] 9. Screenshot de funcionamento + testes manuais.
[ ] 10. `git status && git diff`, review changes.
[ ] 11. `git commit -m &quot;feat/refactor: renomear X para Y&quot;` + `git push`.

## 4. Comandos úteis para você
```bash
# Buscar referências (sempre!)
grep -r &quot;TERMO&quot; client/src/ --include=&quot;*.tsx&quot;

# Substituir em massa (CUIDADO: backup git antes!)
find client/src -name &quot;*.tsx&quot; -exec sed -i &quot;s/OLD/NEW/g&quot; {} +

# Verificar mudanças
git status
git diff arquivo.tsx

# Matar processos dev
pkill -f vite &amp;&amp; pkill -f tsx

# Teste full
npm run dev
# Então abra localhost:5050
```

**REGRA CRÍTICA**:
- Edit tool falhou? = **PARE** e use read/write/exec sed.
- SEMPRE grep após edições.
- SEMPRE testar local **antes** commit/push.
- NUNCA assumir &quot;quase ok&quot;. Checklist 100% ou aborta.

## 5. Template para próximas renomeações
Copie este template para novo aprendizado:

```
### DATA (YYYY-MM-DD)
**Task**: [descrição breve]

**Erros cometidos**:
- [lista bullet]

**Consequências**:
- [impacto + tempo perdido]

**Como deveria ter feito**:
1. [passo 1]
...

**Checklist usado?** [SIM/NAO - link para git commit]
**Lições para MEMORY.md**: [resumo 1 linha]
```

---
*Última atualização: [data atual]. Consulte antes de qualquer renomeação!*
