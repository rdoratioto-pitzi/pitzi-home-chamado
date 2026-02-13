# Como Adicionar Z.AI e OpenRouter como Agentes no Cursor IDE

> **Objetivo:** Usar modelos Z.AI e OpenRouter **dentro do Cursor IDE** para ajudar no desenvolvimento, selecionando-os como agentes quando desejar.

O Cursor permite adicionar providers customizados compatíveis com a API OpenAI. Tanto **OpenRouter** quanto **Z.AI** expõem endpoints nesse formato, então podem ser configurados diretamente.

---

## Pré-requisitos

- **Cursor Pro+** — necessário para usar modelos/APIs de terceiros
- Chaves de API válidas de Z.AI e OpenRouter

> ⚠️ **Segurança:** Nunca compartilhe suas chaves. Use-as apenas nos campos de configuração do Cursor (Settings > Models).

---

## 1. Adicionar OpenRouter no Cursor

### Passo a passo

1. Abra as **configurações** do Cursor (ícone de engrenagem no canto inferior esquerdo)
2. Vá em **Models** (Modelos)
3. Role até a seção **API Keys** e expanda
4. Em **OpenAI API Key**, configure:
   - Marque **Override OpenAI Base URL**
   - No campo da URL base, cole:  
     `https://openrouter.ai/api/v1`
   - No campo de API Key, cole sua chave OpenRouter (ex: `sk-or-v1-...`)
5. Clique em **Add New Model**
6. Digite o nome do modelo **exatamente** como consta no OpenRouter, por exemplo:
   - `google/gemini-2.0-flash-001`
   - `anthropic/claude-3.5-sonnet`
   - `z-ai/glm-4.5`
   - `z-ai/glm-4.5-air:free` (modelo gratuito)
7. Clique em **Verify** para testar
8. Salve as alterações

### Onde pegar o nome do modelo

- Acesse: [https://openrouter.ai/models](https://openrouter.ai/models)
- O nome exato aparece no formato `provedor/modelo` (ex: `z-ai/glm-4.5`)

---

## 2. Adicionar Z.AI no Cursor

Para usar **Z.AI diretamente** (fora do OpenRouter):

### Passo a passo

1. Abra as **configurações** do Cursor > **Models**
2. Na seção **API Keys**, use **Add model** (ou outra opção para modelo extra)
3. Configure:
   - Marque **Override OpenAI Base URL**
   - URL base: `https://api.z.ai/api/paas/v4/`
   - API Key: sua chave Z.AI (formato `xxxxx.xxxxx`)
4. Clique em **Add New Model**
5. Digite o nome do modelo, por exemplo:
   - `glm-5`
   - `glm-4`
   - `glm-4-flash`
6. Clique em **Verify**
7. Salve

### Modelos Z.AI comuns

Consulte a [documentação Z.AI](https://docs.z.ai/) para lista atual. Exemplos: `glm-5`, `glm-4`, `glm-4-flash`.

---

## 3. Escolher entre OpenRouter e Z.AI

O Cursor costuma permitir **um único override** de Base URL por configuração de API Key. Para usar ambos:

- **Opção A – Dois modelos na mesma conta:**  
  Algumas versões permitem múltiplos modelos com URLs diferentes. Experimente adicionar um modelo OpenRouter e outro Z.AI e ver se ambos aparecem.

- **Opção B – Usar só OpenRouter:**  
  O OpenRouter já oferece vários modelos Z.AI (ex: `z-ai/glm-4.5`). Com uma chave OpenRouter, você acessa esses modelos e outros sem configurar Z.AI separadamente.

---

## 4. Usar o agente no dia a dia

1. Abra o chat do Cursor (Cmd/Ctrl + L ou ícone do chat)
2. Use o seletor de modelo no topo do painel de chat
3. Selecione o modelo desejado (ex: `z-ai/glm-4.5` ou `glm-5`)
4. Interaja normalmente; o Cursor usará esse modelo como agente

---

## 5. Resumo de configurações

| Provider    | Base URL                         | Exemplo de modelo        |
|-------------|----------------------------------|---------------------------|
| OpenRouter  | `https://openrouter.ai/api/v1`   | `z-ai/glm-4.5`           |
| Z.AI direto | `https://api.z.ai/api/paas/v4/`  | `glm-5`                  |

---

## Referências

- [OpenRouter Models](https://openrouter.ai/models)
- [Z.AI Docs](https://docs.z.ai/) — introdução e chat completion
- [OpenRouter no Cursor](https://marcuyyy.com/blog/007-openrouter-integration-on-cursor)
