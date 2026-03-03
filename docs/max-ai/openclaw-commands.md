# 📋 OpenClaw Commands Cheatsheet

## 📱 Telegram Commands

### Gestão de Contexto
- `/new` - Reset session (USAR: após commits, antes de features grandes)
- `/status` - Ver uso de contexto atual (tokens, cache)
- `/compact` - Compactar histórico sem perder tudo
- `/model` - Trocar modelo ativo

### Modelos Recomendados
- **Grok 4.1 Fast** - Uso geral (rápido, balanceado) ⭐ PADRÃO
- **GPT-OSS-120B** - Planejamento econômico ($0.0005/msg)
- **MiniMax M2.5** - Linhas específicas de código
- **Qwen3 Coder** - TypeScript complexo
- **DeepSeek V3.2** - Análise técnica profunda

## 💻 Terminal Commands

### Controle do Gateway
```bash
max # Iniciar OpenClaw gateway
max-stop # Parar OpenClaw
max-logs # Ver logs em tempo real
max-status # Ver configuração de modelo atual
```

### Verificação de Ambiente
```bash
ls ~/.openclaw/agents/main/sessions/ # Ver sessions ativas
cat ~/.openclaw/openclaw.json | grep model # Ver modelo configurado
tail -f ~/.openclaw/logs/gateway.log # Logs ao vivo
```

## 🔄 Best Practices Workflow

### Workflow Padrão
1. `/new` - Começar sessão limpa
2. Solicitar plano detalhado
3. Revisar e aprovar plano
4. Executar implementação
5. `/new` - Limpar após conclusão

### Quando usar /new
✅ **SEMPRE:**
- Após cada commit importante
- Antes de feature grande
- Início do dia de trabalho
- Após 5-10 mensagens
- Se resposta >10 segundos

❌ **NÃO PRECISA:**
- Entre perguntas simples (<3 msgs)
- Durante discussão ativa
- No meio de implementação

## 📊 Token Management

### Monitoramento
```bash
# Ver: contexto atual / limite máximo
/status
```

### Limites Ideais
- 🟢 < 15k tokens: Ótimo
- 🟡 15-40k tokens: OK (monitorar)
- 🔴 > 40k tokens: USAR /new AGORA!

### Economia
- Use `/new` preventivamente
- Modelos baratos para planejamento
- Modelos caros só para código complexo

## 🎯 Seleção de Modelo por Tarefa
| Tarefa | Modelo | Motivo |
|--------|--------|--------|
| Planejamento rápido | GPT-OSS-120B | Mais barato ($0.0005) |
| Execução geral | Grok 4.1 Fast | Rápido + balanceado |
| Linhas específicas | MiniMax M2.5 | Identifica linhas exatas |
| Código TypeScript | Qwen3 Coder | Especialista em código |
| Análise profunda | DeepSeek V3.2 | Contexto técnico |

## 🚨 Troubleshooting

### Max lento (>1 min resposta)
```bash
1. /new (limpar contexto)
2. /model Grok 4.1 Fast
3. Testar novamente
```

### Tokens muito altos
```bash
1. /status (verificar uso)
2. /new (resetar)
3. Continuar trabalho
```

### Erro de execução
```bash
1. Verificar logs: max-logs
2. Reiniciar: max-stop && max
3. Tentar novamente
```

---
**Última atualização:** Março 2026
**Baseado em:** 50 OpenClaw Tips (Miles Deutscher)
