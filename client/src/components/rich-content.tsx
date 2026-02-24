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

  return (
    <>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          className
        )}
        style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
        dangerouslySetInnerHTML={{ __html: content || "" }}
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