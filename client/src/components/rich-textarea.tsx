import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageIcon, X, Loader2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  "data-testid"?: string;
}

export function RichTextarea({
  value,
  onChange,
  images = [],
  onImagesChange,
  placeholder,
  rows = 4,
  maxLength = 1000,
  disabled = false,
  "data-testid": dataTestId,
}: RichTextareaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie apenas arquivos de imagem.",
        variant: "destructive",
      });
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => {
        toast({
          title: "Erro na leitura",
          description: "Não foi possível ler o arquivo de imagem.",
          variant: "destructive",
        });
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }, [toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) {
        newImages.push(url);
      }
    }

    if (newImages.length > 0 && onImagesChange) {
      onImagesChange([...images, ...newImages]);
      toast({
        title: "Imagem adicionada",
        description: `${newImages.length} imagem(ns) adicionada(s) com sucesso.`,
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [images, onImagesChange, uploadImage, toast]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const url = await uploadImage(file);
      if (url) {
        uploadedUrls.push(url);
      }
    }

    if (uploadedUrls.length > 0 && onImagesChange) {
      onImagesChange([...images, ...uploadedUrls]);
      toast({
        title: "Imagem colada",
        description: `${uploadedUrls.length} imagem(ns) adicionada(s) via área de transferência.`,
      });
    }

    setIsUploading(false);
  }, [images, onImagesChange, uploadImage, toast]);

  const removeImage = useCallback((index: number) => {
    if (onImagesChange) {
      const newImages = [...images];
      newImages.splice(index, 1);
      onImagesChange(newImages);
    }
  }, [images, onImagesChange]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled || isUploading}
          data-testid={dataTestId}
          className="pr-10"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            data-testid={dataTestId ? `${dataTestId}-upload-btn` : undefined}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <ImageIcon className="h-4 w-4 mr-1" />
            )}
            Adicionar Imagem
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Você também pode colar imagens (Ctrl+V)
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {images.map((url, index) => (
            <div key={index} className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center">
              <img
                src={url}
                alt={`Anexo ${index + 1}`}
                className="max-w-full max-h-full object-contain cursor-pointer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="secondary" className="h-8 w-8">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                    <VisuallyHidden>
                      <DialogTitle>Visualização de Imagem</DialogTitle>
                    </VisuallyHidden>
                    <img 
                      src={url} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain" 
                    />
                  </DialogContent>
                </Dialog>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => removeImage(index)}
                  data-testid={dataTestId ? `${dataTestId}-remove-image-${index}` : undefined}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
