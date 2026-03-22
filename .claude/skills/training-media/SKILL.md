---
name: training-media
description: >
  Generates training materials including AI-generated images and videos for
  Renov internal training modules. Use when creating training content, visual
  materials, educational assets, onboarding media. Trigger on: "material de
  treinamento", "gerar imagem", "criar vídeo", "training", "onboarding visual",
  "tutorial visual", "treinamento".
---

# Training Media — Visual Content for Renov Training

## Image Generation

### Structured Prompts
- Screenshots simulados de interfaces Renov
- Diagramas de fluxo para processos de trade-in
- Infográficos com KPIs e métricas
- Step-by-step visuais para onboarding

### Brand Compliance
All images/videos MUST follow `renov-brand`:
- **Verde Bandeira** (#00A137) como cor de destaque
- **Montserrat** como fonte principal
- Vocabulário aprovado (Vantagem, não Desconto; Valor de troca, não Preço)
- Dark mode: #0A0A0A / Light mode: #FFFFFF

## Video Generation

### Roteiros Curtos (30s-2min)
```
Título: [Nome do módulo]
Objetivo: [O que o usuário aprende]
Duração: [30s | 1min | 2min]

Cena 1: [Descrição visual] + [Narração]
Cena 2: [Descrição visual] + [Narração]
...
CTA: [Ação esperada do espectador]
```

## Training Module Structure

```markdown
## Módulo: [Título]

### Objetivo
[O que o colaborador deve saber/fazer após completar]

### Conteúdo Visual
- [ ] Imagem 1: [descrição]
- [ ] Imagem 2: [descrição]
- [ ] Vídeo: [roteiro resumido]

### Quiz / Validação
1. [Pergunta] — A) ... B) ... C) ...
2. [Pergunta] — A) ... B) ... C) ...
```

## Formats

- **Imagens**: PNG (screenshots, fotos), SVG (diagramas, ícones)
- **Vídeos**: MP4 (H.264, 1080p)

## Generation Methods

1. **HTML/CSS renderizado** — criar layout em HTML, capturar via `html2canvas` ou Playwright screenshot
2. **AI image generation** — via skills.sh ou infer.sh quando disponível
3. **Diagram tools** — Mermaid para fluxogramas, D2 para diagramas de arquitetura

## Alternativa: HTML como Imagem

Para assets rápidos sem ferramenta de design:
1. Criar HTML/CSS com layout do asset
2. Abrir no browser via Playwright
3. Capturar screenshot em resolução alta
4. Exportar como PNG
