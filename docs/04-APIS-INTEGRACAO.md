# Renov Home - APIs e Integrações

**📅 Última atualização:** Fevereiro 2026  
**🔗 Repositório:** https://github.com/renov-tech/renov-home

---

## 🎯 Visão Geral

O Renov Home integra-se com diversos serviços externos para expandir suas funcionalidades. Este documento centraliza todas as integrações, suas configurações e melhores práticas.

---

## 🤖 Integrações de IA

### OpenAI API

#### Uso Atual
- **Módulo:** Macgyver AI
- **Modelos utilizados:**
  - GPT-4 (análises complexas)
  - GPT-3.5-turbo (respostas rápidas)
- **Funcionalidades:**
  - Chat conversacional
  - Análise de texto
  - Geração de insights

#### Configuração

```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-... # opcional
```

#### Código de Exemplo

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chat(messages: Array<{role: string, content: string}>) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return completion.choices[0].message.content;
}
```

#### Custos
- **GPT-4:** ~$0.03/1K input tokens, ~$0.06/1K output tokens
- **GPT-3.5:** ~$0.0015/1K input tokens, ~$0.002/1K output tokens
- **Budget mensal:** [Definir]

#### Rate Limits
- Tier 1: 3,500 RPM (requests per minute)
- Tier 2+: Verificar em https://platform.openai.com/account/limits

#### Documentação Oficial
https://platform.openai.com/docs

---

### OpenRouter

#### Uso Atual
- **Módulo:** Macgyver AI
- **Propósito:** Acesso multi-modelo com roteamento inteligente
- **Modelos acessíveis:**
  - Claude (Anthropic)
  - GPT-4, GPT-3.5 (OpenAI)
  - Llama, Mistral, etc.
  - [Outros modelos disponíveis]

#### Vantagens
- ✅ Um único endpoint para múltiplos modelos
- ✅ Roteamento automático baseado em custo/performance
- ✅ Fallback automático se modelo indisponível
- ✅ Preços competitivos

#### Configuração

```bash
# .env
OPENROUTER_API_KEY=sk-or-...
```

#### Código de Exemplo

```typescript
import axios from 'axios';

async function chatOpenRouter(
  model: string,
  messages: Array<{role: string, content: string}>
) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model, // ex: "anthropic/claude-3-opus"
      messages: messages,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://renov-home.com', // opcional
        'X-Title': 'Renov Home', // opcional
      }
    }
  );
  
  return response.data.choices[0].message.content;
}
```

#### Modelos Disponíveis
```typescript
const MODELS = {
  CLAUDE_OPUS: 'anthropic/claude-3-opus',
  CLAUDE_SONNET: 'anthropic/claude-3-sonnet',
  GPT4: 'openai/gpt-4',
  GPT35: 'openai/gpt-3.5-turbo',
  LLAMA: 'meta-llama/llama-3-70b',
  // Ver lista completa em: https://openrouter.ai/models
};
```

#### Custos
- Variável por modelo
- Ver preços atualizados: https://openrouter.ai/models

#### Documentação Oficial
https://openrouter.ai/docs

---

### Claude API (Anthropic)

#### Uso Planejado
- **Módulo:** Macgyver AI
- **Modelos:**
  - Claude 3 Opus (análises profundas)
  - Claude 3 Sonnet (balanço custo/qualidade)
  - Claude 3 Haiku (respostas rápidas)

#### Diferenciais
- ✅ Context window grande (200K tokens)
- ✅ Excelente para análise de documentos
- ✅ Boa performance em código
- ✅ Vision capabilities (imagens)

#### Configuração

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Status
📋 Planejado - Em avaliação

#### Documentação Oficial
https://docs.anthropic.com

---

## 📧 Email

### SendGrid (Planejado)

#### Uso Planejado
- Notificações de tickets
- Convites de reunião
- Alertas de sistema
- Relatórios agendados

#### Configuração

```bash
# .env
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@renov.com
SENDGRID_FROM_NAME=Renov Home
```

#### Template de Código

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const msg = {
    to: to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME,
    },
    subject: subject,
    html: html,
  };
  
  await sgMail.send(msg);
}
```

#### Custos
- Free tier: 100 emails/dia
- Essentials: $19.95/mês (40K emails)

#### Status
📋 Planejado

---

## 📊 Analytics e Monitoramento

### Google Analytics (Planejado)

#### Uso Planejado
- Tracking de uso dos módulos
- Métricas de engajamento
- Funnel analysis

#### Configuração

```bash
# .env
GA_TRACKING_ID=G-...
```

#### Status
📋 Planejado

---

### Sentry (Error Tracking)

#### Uso Planejado
- Monitoramento de erros em produção
- Performance monitoring
- Release tracking

#### Configuração

```bash
# .env
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENV=production
```

#### Template de Código

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV,
  tracesSampleRate: 1.0,
});

// Capturar erro
try {
  // código
} catch (error) {
  Sentry.captureException(error);
}
```

#### Custos
- Developer (free): 5K errors/mês
- Team: $26/mês (50K errors)

#### Status
📋 Planejado

---

## 🗺️ Maps e Localização

### Google Maps API (Se necessário)

#### Uso Potencial
- Visualização de logística
- Geocoding de endereços

#### Status
💭 Em avaliação

---

## 💳 Pagamentos (Futuro)

### Stripe (Planejado para SaaS)

#### Uso Planejado
- Cobranças de assinaturas
- Marketplace de módulos
- Pagamentos one-time

#### Status
📋 Planejado (longo prazo)

---

## 🔐 Autenticação

### OAuth Providers (Planejado)

#### Google OAuth
- Login com conta Google
- Acesso a Google Calendar (reuniões)

#### Microsoft OAuth
- Login com conta Microsoft
- Integração com Outlook Calendar

#### Status
📋 Planejado

---

## 📦 Storage

### AWS S3 / Cloudflare R2 (Planejado)

#### Uso Planejado
- Upload de arquivos em tickets
- Armazenamento de anexos
- Backup de documentos

#### Configuração

```bash
# .env (AWS S3)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET_NAME=renov-home-uploads

# ou (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=renov-home-uploads
```

#### Decisão
💭 S3 vs R2: Avaliar custo/benefício
- R2: Sem custo de egress
- S3: Mais features, maior ecosystem

#### Status
📋 Planejado

---

## 🔔 Notificações

### Slack (Opcional)

#### Uso Potencial
- Notificações de tickets críticos
- Alertas de sistema
- Webhooks de deploys

#### Status
💭 Em avaliação

---

### Discord (Opcional)

#### Uso Potencial
- Comunicação interna do time
- Webhooks de eventos importantes

#### Status
💭 Em avaliação

---

## 📊 Integrações de Business Intelligence

### Metabase (Planejado)

#### Uso Planejado
- Dashboards avançados
- SQL queries visuais
- Compartilhamento de relatórios

#### Configuração
- Self-hosted ou cloud
- Conexão direta com PostgreSQL

#### Status
📋 Planejado

---

## 🔄 Webhooks (Outbound)

### Estrutura de Webhooks

```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

// Exemplo: Ticket criado
{
  event: "ticket.created",
  timestamp: "2026-02-20T10:30:00Z",
  data: {
    id: 123,
    title: "Bug no módulo X",
    priority: "high",
    requester: {
      id: 1,
      name: "João Silva"
    }
  }
}
```

### Eventos Disponíveis (Planejados)

#### Tickets
- `ticket.created`
- `ticket.updated`
- `ticket.assigned`
- `ticket.resolved`
- `ticket.closed`

#### Projects
- `project.created`
- `project.updated`
- `task.completed`

#### Meetings
- `meeting.scheduled`
- `meeting.started`
- `meeting.ended`

#### Status
📋 Planejado

---

## 🔒 Segurança de Integrações

### Melhores Práticas

#### 1. Armazenamento de Secrets
```bash
# ❌ NUNCA commitar
API_KEY=sk-123456789

# ✅ Usar .env (local)
# .env
API_KEY=sk-123456789

# ✅ Usar secrets manager (produção)
# GitHub Secrets, AWS Secrets Manager, etc.
```

#### 2. Validação de Webhooks
```typescript
// Verificar signature em webhooks recebidos
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

#### 3. Rate Limiting
```typescript
// Implementar rate limiting em chamadas de API
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests
  message: 'Too many requests from this IP'
});

app.use('/api/external', apiLimiter);
```

#### 4. Timeouts
```typescript
// Sempre definir timeouts em requests externos
axios.get('https://api.external.com', {
  timeout: 5000 // 5 segundos
})
```

#### 5. Error Handling
```typescript
// Tratar erros de APIs externas gracefully
try {
  const response = await externalAPI.call();
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limit - aguardar e tentar novamente
    await sleep(60000);
    return retry();
  } else if (error.response?.status >= 500) {
    // Erro do servidor - usar fallback
    return fallbackResponse();
  }
  // Logar erro e continuar
  logger.error('External API error', error);
  return defaultResponse();
}
```

---

## 📋 Checklist de Nova Integração

Ao adicionar nova integração:

- [ ] Documentar neste arquivo
- [ ] Adicionar variáveis de ambiente em `.env.example`
- [ ] Implementar com error handling robusto
- [ ] Adicionar testes de integração
- [ ] Configurar secrets em produção
- [ ] Documentar custos estimados
- [ ] Adicionar monitoramento/alertas
- [ ] Revisar com Marcelo (CTO)
- [ ] Atualizar documentação de módulo específico

---

## 📊 Dashboard de Integrações

### Status Atual

| Integração | Status | Módulo | Responsável | Custo/Mês |
|------------|--------|--------|-------------|-----------|
| OpenAI API | ✅ Ativo | Macgyver AI | Matheus | ~$50 |
| OpenRouter | ✅ Ativo | Macgyver AI | Matheus | Variável |
| SendGrid | 📋 Planejado | Todos | [Definir] | Free tier |
| Sentry | 📋 Planejado | Core | [Definir] | Free tier |
| AWS S3/R2 | 📋 Planejado | Tickets, KB | [Definir] | ~$5-10 |
| Google OAuth | 📋 Planejado | Auth | Marcelo | Free |

**Total estimado:** ~$50-70/mês (atual + planejado)

---

## 🆘 Troubleshooting

### Problemas Comuns

**API Key Inválida:**
```
Error: Invalid API key
```
- Verificar se key está correta no `.env`
- Verificar se não há espaços extras
- Regenerar key se necessário

**Rate Limit:**
```
Error: 429 Too Many Requests
```
- Implementar exponential backoff
- Considerar upgrade de tier
- Adicionar caching

**Timeout:**
```
Error: Request timeout
```
- Verificar conectividade
- Aumentar timeout se API lenta
- Implementar retry logic

---

## 📚 Recursos Úteis

### Documentações
- [OpenAI API Docs](https://platform.openai.com/docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Anthropic Docs](https://docs.anthropic.com)

### Ferramentas
- [Postman](https://postman.com) - Testar APIs
- [Insomnia](https://insomnia.rest) - Testar APIs
- [Webhook.site](https://webhook.site) - Testar webhooks

---

**Dúvidas sobre integrações?**  
Consulte esta documentação ou fale com o responsável do módulo.

*Última atualização: Fevereiro 2026*  
*Próxima revisão: Março 2026*
