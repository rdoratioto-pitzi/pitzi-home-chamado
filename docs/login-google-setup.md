# Login com Google — configuração

O sistema de chamados aceita login **somente com Google** (contas `@pitzi.com.br`) assim que
o client id do Google estiver configurado no Worker. Até lá, o login por e-mail e senha
continua funcionando para todos — publicar esta versão antes da configuração não tranca ninguém.

## Como funciona

- A tela de login carrega o botão oficial "Fazer login com o Google" (Google Identity Services).
- O Google devolve um *ID token*; o Worker confere a assinatura com as chaves públicas do
  Google, o client id (`aud`), o emissor, a validade, o e-mail verificado e o domínio
  (`hd = pitzi.com.br`, ou seja, só contas do Google Workspace da empresa).
- **Primeiro acesso:** a pessoa é cadastrada automaticamente como **Usuário** (abre e acompanha
  os próprios chamados). Para virar técnico ou administrador, use Configurações → Usuários.
- **Quem já existe** é encontrado pelo e-mail e mantém o papel (admin/técnico).
- **Conta desativada** em Configurações → Usuários não entra, mesmo com Google.
- Não é usado client secret.

## 1. Criar o ID do cliente OAuth (Google Cloud)

1. Abra **console.cloud.google.com** e selecione o projeto **pitzi-automations-prod**.
2. **APIs e serviços → Tela de consentimento OAuth** (ou "Google Auth Platform → Público-alvo"):
   confira que o público é **Interno** (só contas da Pitzi). Se já estiver configurada para a
   intranet, não precisa mexer.
3. **APIs e serviços → Credenciais → + Criar credenciais → ID do cliente OAuth**.
   - **Tipo de aplicativo:** Aplicativo da Web
   - **Nome:** `Pitzi Chamados`
   - **Origens JavaScript autorizadas:**
     - `https://rdoratioto-pitzi.github.io`
     - `http://localhost:5050` (só para desenvolvimento local)
   - **URIs de redirecionamento autorizados:** deixe vazio (o botão do Google não usa redirecionamento).
4. Clique em **Criar** e copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
   O ID do cliente **não é segredo**; não é preciso guardar a "chave secreta do cliente".

## 2. Colocar o ID no Worker

Em `worker/wrangler.toml`, bloco `[vars]` (produção):

```toml
GOOGLE_LOGIN_CLIENT_ID = "COLE-AQUI.apps.googleusercontent.com"
ALLOWED_GOOGLE_DOMAINS = "pitzi.com.br"
PASSWORD_LOGIN_ENABLED = "false"
```

Depois publique o Worker (o frontend não precisa de novo build — ele lê `GET /api/auth/config`):

```bash
cd worker
set -a; . ~/.cloudflare-token; set +a
npx wrangler deploy
```

A partir daí a tela de login mostra só o botão do Google e `POST /api/auth/login` (senha)
responde "Entre com a sua conta Google da Pitzi." para todos, inclusive administradores.

## 3. Chave de emergência (se o Google der problema)

Para voltar a aceitar senha **só para administradores**:

```toml
PASSWORD_LOGIN_ENABLED = "true"
```

e `npx wrangler deploy` de novo. A tela de login passa a mostrar o link discreto
"Acesso de emergência (administradores)". Quando o problema passar, volte para `"false"` e publique.

Para desligar o Google de vez (todos voltam a entrar com senha), deixe
`GOOGLE_LOGIN_CLIENT_ID = ""` e publique.

## Situação na tela

Configurações → Autenticação mostra:
- "Login somente com Google (contas @pitzi.com.br)" quando configurado;
- "Google ainda não configurado — login por senha ativo" enquanto o ID estiver vazio;
- o estado da chave de emergência.
