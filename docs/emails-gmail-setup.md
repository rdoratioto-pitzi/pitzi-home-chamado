# E-mails dos chamados pelo Gmail — configuração

Os e-mails automáticos da central de chamados saem pela caixa **chamados@pitzi.com.br**
(Google Workspace), usando a API do Gmail com uma **conta de serviço** que tem **delegação em
todo o domínio** restrita ao escopo de envio. Nenhuma senha de e-mail é usada.

Enquanto a configuração abaixo não estiver pronta, o sistema continua funcionando: cada e-mail
fica registrado em **Configurações → E-mail → Histórico** como "Falhou — envio não
configurado" e pode ser reenviado depois.

## 1. Caixa de e-mail

1. Admin do Google Workspace → **Usuários** → criar `chamados@pitzi.com.br` (ou um grupo
   colaborativo, se preferir uma caixa compartilhada — precisa ser um usuário com licença para a
   API do Gmail enviar em nome dele).
2. Entrar uma vez na caixa para aceitar os termos.

## 2. Conta de serviço (Google Cloud)

No projeto **pitzi-automations-prod** (console.cloud.google.com):

1. **APIs e serviços → Biblioteca** → ativar **Gmail API**.
2. **IAM e administrador → Contas de serviço → Criar conta de serviço**
   - Nome: `chamados-email`
   - Sem papéis no projeto (não precisa).
3. Abrir a conta criada → aba **Chaves → Adicionar chave → Criar nova chave → JSON**. Guarde o
   arquivo com cuidado (é uma credencial) e apague-o do computador depois do passo 4.
4. Anote o **ID do cliente** (número longo, campo "Unique ID"/"ID exclusivo") da conta.

## 3. Delegação em todo o domínio (Google Workspace)

Admin do Google Workspace (admin.google.com):

1. **Segurança → Acesso e controle de dados → Controles de API → Delegação em todo o domínio →
   Adicionar novo**.
2. **ID do cliente**: o número do passo 2.4.
3. **Escopos OAuth**: somente
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
4. Autorizar. A propagação pode levar alguns minutos.

Com esse escopo a conta de serviço só consegue **enviar** e-mails; não lê a caixa.

### 3.1 Respostas por e-mail (ler a caixa)

Para as respostas aos e-mails do chamado virarem comentário, edite o **mesmo** cliente na
delegação (Segurança → Controles de API → Delegação em todo o domínio → cliente do sistema de
chamados → Editar) e deixe os dois escopos, separados por vírgula:

```
https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.modify
```

`gmail.modify` permite ler as mensagens da caixa chamados@, marcar com os marcadores
"Chamados/Processado" e "Chamados/Ignorado" e tirar da caixa de entrada. Não permite apagar
mensagens de forma definitiva. Enquanto ele não estiver autorizado, só a leitura falha (o
envio continua com `gmail.send`) e Configurações → E-mail → "Respostas recebidas" mostra
"Autorize o escopo gmail.modify na delegação do Workspace". Depois de autorizar, use
"Ler a caixa agora" para conferir.

## 4. Segredos no Worker (Cloudflare)

No Mac, com o token da Cloudflare carregado (`set -a; . ~/.cloudflare-token; set +a`), dentro
da pasta `worker/` do checkout de deploy:

```bash
# e-mail da conta de serviço (campo "client_email" do JSON)
npx wrangler secret put GOOGLE_SA_CLIENT_EMAIL

# chave privada (campo "private_key" do JSON, inteiro, com BEGIN/END; pode colar com os \n)
npx wrangler secret put GOOGLE_SA_PRIVATE_KEY
```

O remetente já vem em `worker/wrangler.toml` (`GMAIL_SENDER = "chamados@pitzi.com.br"`).
Os segredos valem na hora, sem novo deploy.

Depois: **Configurações → E-mail → Enviar e-mail de teste**. O cartão "Conexão de envio" deve
mostrar "Conectado via Gmail como chamados@pitzi.com.br" e o teste deve aparecer como
"Enviado" no histórico. Se falhar, a mensagem de erro do Google aparece na linha do histórico:

| Erro | Causa provável |
|---|---|
| `unauthorized_client` | Delegação (passo 3) ausente, com outro ID de cliente ou ainda propagando |
| `invalid_grant` | `GMAIL_SENDER` não é um usuário do domínio, ou relógio/chave inválidos |
| `403 ... Gmail API has not been used` | Gmail API não ativada no projeto (passo 2.1) |

## 5. Entregabilidade (DNS do pitzi.com.br)

Quem administra o DNS do domínio deve conferir, uma única vez:

- **SPF** — registro TXT na raiz contendo o Google:
  `v=spf1 include:_spf.google.com ~all` (se já existir um SPF, só acrescente
  `include:_spf.google.com`; o domínio deve ter **um único** registro SPF).
- **DKIM** — Admin do Workspace → **Apps → Google Workspace → Gmail → Autenticar e-mail** →
  gerar a chave (2048 bits) → publicar o TXT `google._domainkey` no DNS → **Iniciar
  autenticação**.
- **DMARC** — TXT em `_dmarc.pitzi.com.br`, começando em modo de observação:
  `v=DMARC1; p=none; rua=mailto:dmarc@pitzi.com.br` e, depois de algumas semanas sem
  problemas, subir para `p=quarantine`.

## Como funciona (resumo técnico)

- Cada evento (abertura, atribuição, respostas, status, encerramento; senha e menções) grava
  uma linha em `email_outbox` e tenta enviar logo em seguida, sem segurar a requisição.
- O cron do Worker (a cada minuto) repete as falhas com espera crescente (1, 4, 16 e 60
  minutos; máximo de 5 tentativas) e devolve à fila linhas presas em "enviando".
- As mensagens de um chamado usam o assunto `[CHA-0001] Título` e o mesmo `References`
  (`<ticket-{id}@pitzi.com.br>`), para o Gmail agrupar a conversa; cada mensagem guarda o
  próprio `Message-ID` (base para, numa fase seguinte, receber respostas por e-mail).
- Mensagens levam `Auto-Submitted: auto-generated`, para respostas automáticas (férias, etc.)
  não voltarem em loop.
- Notas internas nunca são enviadas. Usuários inativos ou sem e-mail ficam como "Não enviado".
- **Respostas por e-mail** (`worker/src/lib/inbound-email.ts`): o mesmo cron lê a caixa
  (`in:inbox` sem os marcadores, últimos 14 dias, até 25 por execução). O chamado é achado pelo
  `In-Reply-To`/`References` (Message-IDs que nós enviamos, ou a raiz `<ticket-{id}@...>`) e,
  em último caso, pelo `[CHA-XXXX]` do assunto. O histórico citado ("Em ... escreveu:",
  "On ... wrote:", bloco De/Enviado do Outlook, linhas com ">", assinatura "-- ") é removido.
  O texto vira comentário **público** de quem respondeu, marcado "via e-mail", com os mesmos
  efeitos do comentário feito na tela (1ª resposta, e-mail para a outra parte, avisos).
  Se o chamado estava em "Aguardando solicitante" e quem respondeu é o solicitante, volta para
  "Em andamento". Ignoradas (marcador "Chamados/Ignorado"): a própria caixa, respostas
  automáticas/devoluções/listas, chamado não identificado, remetente sem cadastro ativo ou sem
  acesso ao chamado, resposta vazia. Anexos (imagens, PDF, Office, texto; até 5 de 10 MB) são
  importados para o R2; os demais viram a nota "(anexos enviados por e-mail não foram
  importados)". `inbound_email_log` e o índice único em `ticket_comments.inbound_email_id`
  garantem que uma mensagem não vira dois comentários.
- **Resposta do solicitante** (na tela ou por e-mail) vai para o responsável; sem responsável,
  para os técnicos ativos do grupo do chamado; grupo sem técnicos, para os admins ativos.
- **Alteração pela equipe** (evento `ticket_updated`): mudar o grupo ou o título avisa o
  solicitante. Gravidade, prioridade, responsável, Objeto da Requisição e campos personalizados
  não geram e-mail.
