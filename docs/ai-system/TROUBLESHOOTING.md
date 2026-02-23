# 🔧 Problemas Comuns

## "Plan não encontrado"
```bash
# ✅ Correto: incluir /plan.md
npm run renov-dev run plans/nome/plan.md
```

## "Database não conectado"
```bash
# Verificar .env
cat .env | grep DATABASE_URL
```

## "Modelo não encontrado"
```bash
# Listar modelos
npm run renov-dev models
```

## QA reprovou
```bash
# Rodar novamente ou ajustar plan
npm run renov-dev run plans/nome/plan.md
```
