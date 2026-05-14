import { useState, useCallback, useRef } from "react";
import MarkdownIt from "markdown-it";
import { Button } from "@/components/ui/button";
import { Copy, Download, Trash2, Eye, Edit3, Columns, WrapText } from "lucide-react";
import { cn } from "@/lib/utils";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

const STORAGE_KEY = "pitzi_markdown_content";

const PLACEHOLDER = `# Bem-vindo ao Editor Markdown Pitzi

Este é um **editor Markdown** com preview ao vivo, inspirado no [markdown-it](https://markdown-it.github.io/).

---

## Formatação de texto

- **Negrito** com \`**texto**\`
- *Itálico* com \`*texto*\`
- ~~Tachado~~ com \`~~texto~~\`
- \`código inline\` com crase

## Listas

1. Item numerado
2. Segundo item
   - Sub-item com recuo
   - Outro sub-item

## Código

\`\`\`javascript
// Exemplo de bloco de código
const pitzi = {
  brand: "#3B42DE",
  slogan: "Conectando você ao suporte",
};
console.log(pitzi.brand);
\`\`\`

## Tabela

| Coluna A | Coluna B | Coluna C |
|----------|----------|----------|
| Dado 1   | Dado 2   | Dado 3   |
| Dado 4   | Dado 5   | Dado 6   |

## Citação

> "Qualidade não é um acidente; é sempre o resultado de esforço inteligente."
> — John Ruskin

## Link e imagem

[Site Pitzi](https://pitzi.com.br) — suporte e gestão inteligente.
`;

type ViewMode = "split" | "editor" | "preview";

export default function MarkdownPage() {
  const [content, setContent] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || PLACEHOLDER;
    } catch {
      return PLACEHOLDER;
    }
  });
  const [mode, setMode] = useState<ViewMode>("split");
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saveToStorage = (val: string) => {
    try { localStorage.setItem(STORAGE_KEY, val); } catch {}
  };

  const handleChange = (val: string) => {
    setContent(val);
    saveToStorage(val);
  };

  const rendered = md.render(content);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const lineCount = content.split("\n").length;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = content.substring(0, start) + "  " + content.substring(end);
      handleChange(newVal);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }, [content]);

  const copyMarkdown = () => navigator.clipboard.writeText(content);
  const copyHtml = () => navigator.clipboard.writeText(rendered);
  const downloadMd = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "documento.md";
    a.click();
    URL.revokeObjectURL(url);
  };
  const clearContent = () => {
    if (confirm("Limpar todo o conteúdo?")) handleChange("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <span className="text-sm font-semibold text-foreground mr-2">Markdown</span>

        {/* View mode toggle */}
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button
            onClick={() => setMode("editor")}
            className={cn(
              "px-3 py-1.5 flex items-center gap-1.5 transition-colors",
              mode === "editor"
                ? "bg-[#3B42DE] text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editor
          </button>
          <button
            onClick={() => setMode("split")}
            className={cn(
              "px-3 py-1.5 flex items-center gap-1.5 transition-colors border-x",
              mode === "split"
                ? "bg-[#3B42DE] text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns className="w-3.5 h-3.5" />
            Dividido
          </button>
          <button
            onClick={() => setMode("preview")}
            className={cn(
              "px-3 py-1.5 flex items-center gap-1.5 transition-colors",
              mode === "preview"
                ? "bg-[#3B42DE] text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-1 ml-1">
          <Button variant="ghost" size="sm" onClick={() => setWordWrap(!wordWrap)} title="Quebra de linha">
            <WrapText className={cn("w-4 h-4", wordWrap ? "text-[#3B42DE]" : "text-muted-foreground")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={copyMarkdown} title="Copiar Markdown">
            <Copy className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">MD</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={copyHtml} title="Copiar HTML">
            <Copy className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">HTML</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadMd} title="Baixar .md">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearContent} title="Limpar">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>

        <div className="ml-auto text-xs text-muted-foreground hidden sm:flex gap-3">
          <span>{lineCount} linhas</span>
          <span>{wordCount} palavras</span>
          <span>{charCount} chars</span>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor pane */}
        {(mode === "editor" || mode === "split") && (
          <div className={cn("flex flex-col border-r", mode === "split" ? "w-1/2" : "w-full")}>
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/20 uppercase tracking-wide">
              Markdown
            </div>
            <textarea
              ref={textareaRef}
              className={cn(
                "flex-1 resize-none bg-background text-sm font-mono p-4 outline-none leading-relaxed",
                !wordWrap && "whitespace-nowrap overflow-x-auto"
              )}
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite seu Markdown aqui..."
              spellCheck={false}
              wrap={wordWrap ? "soft" : "off"}
            />
          </div>
        )}

        {/* Preview pane */}
        {(mode === "preview" || mode === "split") && (
          <div className={cn("flex flex-col overflow-hidden", mode === "split" ? "w-1/2" : "w-full")}>
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b bg-muted/20 uppercase tracking-wide">
              Preview
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 markdown-preview"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
