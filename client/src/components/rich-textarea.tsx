import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadedImage {
  url: string;
  name: string;
}

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

    try {
      const requestRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type
        })
      });

      if (!requestRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await requestRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      return `/objects${objectPath}`;
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload da imagem.",
        variant: "destructive",
      });
      return null;
    }
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
    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"));

    if (imageItems.length === 0) return;

    e.preventDefault();
    setIsUploading(true);
    const newImages: string[] = [];

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        const url = await uploadImage(file);
        if (url) {
          newImages.push(url);
        }
      }
    }

    if (newImages.length > 0 && onImagesChange) {
      onImagesChange([...images, ...newImages]);
      toast({
        title: "Imagem colada",
        description: `${newImages.length} imagem(ns) adicionada(s) com sucesso.`,
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
            <div key={index} className="relative group rounded-lg overflow-hidden border">
              <img
                src={url}
                alt={`Anexo ${index + 1}`}
                className="w-full h-24 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={dataTestId ? `${dataTestId}-remove-image-${index}` : undefined}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
