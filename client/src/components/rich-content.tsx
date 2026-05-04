import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

interface RichContentProps {
  content: string;
  className?: string;
}

const HTML_TAG_RE = /<\/?[a-zA-Z][\s\S]*?>/;

// quill-mention v6 só insere o "@" no DOM; o nome do usuário fica em
// data-display-name. Para o display fora do editor, injetamos o nome
// diretamente no innerHTML para não depender de pseudo-element.
function injectMentionNames(html: string): string {
  return html.replace(
    /<span\b([^>]*\bclass="[^"]*\bmention\b[^"]*"[^>]*)>([\s\S]*?)<\/span>/gi,
    (match, attrs: string, inner: string) => {
      const m = attrs.match(/data-display-name="([^"]+)"/i);
      if (!m) return match;
      const displayName = m[1];
      // Já tem o nome dentro? Não duplica.
      if (inner.includes(displayName)) return match;
      // Insere o nome após o denotation char "@", ou no final se não houver.
      if (/<span[^>]*\bql-mention-denotation-char\b[^>]*>[^<]*<\/span>/i.test(inner)) {
        return `<span ${attrs}>${inner}${displayName}</span>`;
      }
      return `<span ${attrs}><span class="ql-mention-denotation-char">@</span>${displayName}</span>`;
    },
  );
}

function normalizeContent(raw: string): string {
  if (!raw) return "";
  if (!HTML_TAG_RE.test(raw)) {
    const escaped = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
  }
  return injectMentionNames(raw);
}

export function RichContent({ content, className }: RichContentProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const src = (target as HTMLImageElement).src;
      if (src) {
        setPreviewImage(src);
      }
    }
  };

  const html = normalizeContent(content || "");

  return (
    <>
      <div
        className={cn(
          "rich-text-content prose prose-sm dark:prose-invert max-w-none",
          className
        )}
        style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
        // eslint-disable-next-line react/no-danger -- backend sanitiza HTML via isomorphic-dompurify antes de persistir
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
          <VisuallyHidden>
            <DialogTitle>Visualização de Imagem</DialogTitle>
          </VisuallyHidden>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}