# 🔧 Problemas Comuns

## "Plan não encontrado"
```bash
# ✅ Correto: incluir /plan.md
npm run pitzi-dev run plans/nome/plan.md
```

## "Database não conectado"
```bash
# Verificar .env
cat .env | grep DATABASE_URL
```

## "Modelo não encontrado"
```bash
# Listar modelos
npm run pitzi-dev models
```

## QA reprovou
```bash
# Rodar novamente ou ajustar plan
npm run pitzi-dev run plans/nome/plan.md
```
