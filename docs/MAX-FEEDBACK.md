# FEEDBACK PARA MAX - APRENDIZADOS

## 📅 03/03/2026 - Renomear Módulo Biblioteca

### ❌ ERRO COMETIDO:

**Task:** Renomear "Base de Conhecimento" → "Biblioteca"

**Problema:**
1. Max renomeou componentes mas **não editou TODAS as referências**
2. Arquivo `app-sidebar.tsx` **falhou ao editar** (26 chars failed)
3. Não verificou com `grep` se havia referências residuais
4. Não testou localmente antes de commitar

**Resultado:**
- Aplicação não carregou (ConhecimentoPage is not defined)
- Perda de tempo com debug
- Matheus teve que corrigir manualmente

---

### ✅ COMO DEVERIA TER FEITO:

**PASSO A PASSO CORRETO PARA RENOMEAR COMPONENTE:**

1. **PLANEJAR MUDANÇAS:**
```bash
   # Listar TODAS as referências
   grep -r "ConhecimentoPage" client/src/
   grep -r "conhecimento" client/src/ | grep -v node_modules
```

2. **RENOMEAR ARQUIVOS:**
```bash
   # Pasta do módulo
   mv client/src/pages/conhecimento client/src/pages/biblioteca
   
   # Componente principal (se existir)
   mv ConhecimentoPage.tsx BibliotecaPage.tsx
```

3. **ATUALIZAR IMPORTS (TODOS!):**
   - App.tsx
   - routes.tsx
   - sidebar.tsx
   - Qualquer arquivo que importe

4. **ATUALIZAR ROTAS:**
```typescript
   // DE:
   path: "/conhecimento/*"
   // PARA:
   path: "/biblioteca/*"
```

5. **ATUALIZAR PERMISSÕES:**
```typescript
   // DE:
   permissions.conhecimento
   // PARA:
   permissions.biblioteca
```

6. **ATUALIZAR VARIÁVEIS:**
```typescript
   // DE:
   const conhecimentoSubItems = ...
   const conhecimentoOpen = ...
   // PARA:
   const bibliotecaSubItems = ...
   const bibliotecaOpen = ...
```

7. **VERIFICAR SE NÃO SOBROU NADA:**
```bash
   grep -r "conhecimento" client/src/ | grep -v node_modules | grep -v Omie
   # Resultado deve ser ZERO (exceto preservados como Omie)
```

8. **MATAR PROCESSOS E TESTAR:**
```bash
   pkill -f vite && pkill -f tsx
   npm run dev
```

9. **ABRIR NAVEGADOR E VALIDAR:**
   - http://localhost:5050
   - Navegar para /biblioteca
   - Verificar menu
   - Verificar todas as sub-rotas

10. **SÓ COMMITAR SE 100% FUNCIONAL!**

---

### 🎯 LIÇÕES APRENDIDAS:

1. **SEMPRE usar `grep` ANTES de dizer "terminado"**
2. **SEMPRE testar localmente ANTES de commitar**
3. **NUNCA assumir que "Edit failed" é aceitável**
4. **SE edit falhar, usar outro método (sed, manual, etc)**
5. **Renomear = MUITO MAIS que mudar nome de arquivo**
6. **Verificar:**
   - Imports
   - Exports
   - Rotas
   - Permissões
   - Variáveis
   - Strings hardcoded

---

### 📝 TEMPLATE PARA PRÓXIMAS RENOMEAÇÕES:
```
TASK: Renomear [ANTIGO] → [NOVO]

CHECKLIST OBRIGATÓRIO:

[ ] 1. Grep todas refs: grep -r "ANTIGO" client/src/
[ ] 2. Renomear pastas/arquivos
[ ] 3. Atualizar imports (TODOS!)
[ ] 4. Atualizar rotas
[ ] 5. Atualizar permissões
[ ] 6. Atualizar variáveis
[ ] 7. Grep final: deve ser ZERO refs residuais
[ ] 8. Matar processos
[ ] 9. npm run dev
[ ] 10. Testar navegador (TODAS as rotas)
[ ] 11. Screenshot funcionando
[ ] 12. Commit + push

SE QUALQUER PASSO FALHAR → PARAR E REPORTAR!
NÃO commitar até 100% funcional!
```

---

## 🔍 COMANDOS ÚTEIS:

**Buscar referências:**
```bash
grep -r "TERMO" client/src/ --include="*.tsx" --include="*.ts"
```

**Substituir em massa (cuidado!):**
```bash
find client/src -name "*.tsx" -exec sed -i 's/ANTIGO/NOVO/g' {} +
```

**Verificar arquivos modificados:**
```bash
git status
git diff client/src/components/app-sidebar.tsx
```

---

## 💪 PRÓXIMA VEZ: FAZER DIREITO NA PRIMEIRA!

**Lembre-se:**
- Renomear ≠ apenas mudar nome
- Grep é seu amigo
- Testar localmente é OBRIGATÓRIO
- Edit failed = PROBLEMA, não "quase ok"
