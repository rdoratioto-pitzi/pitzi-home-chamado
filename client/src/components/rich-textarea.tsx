import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageIcon, X, Loader2, Maximize2, Video, FileText } from "lucide-react";
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
  maxLength = 2000,
  disabled = false,
  "data-testid": dataTestId,
}: RichTextareaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie apenas arquivos de imagem ou vídeo.",
        variant: "destructive",
      });
      return null;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for video, 10MB for image
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O tamanho máximo é ${isVideo ? "50MB" : "10MB"}.`,
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
          description: "Não foi possível ler o arquivo.",
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
    const newAttachments: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) {
        newAttachments.push(url);
      }
    }

    if (newAttachments.length > 0 && onImagesChange) {
      onImagesChange([...images, ...newAttachments]);
      toast({
        title: "Anexo adicionado",
        description: `${newAttachments.length} arquivo(s) adicionado(s) com sucesso.`,
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [images, onImagesChange, uploadFile, toast]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const url = await uploadFile(file);
      if (url) {
        uploadedUrls.push(url);
      }
    }

    if (uploadedUrls.length > 0 && onImagesChange) {
      onImagesChange([...images, ...uploadedUrls]);
      toast({
        title: "Arquivo colado",
        description: `${uploadedUrls.length} arquivo(s) adicionado(s) via área de transferência.`,
      });
    }

    setIsUploading(false);
  }, [images, onImagesChange, uploadFile, toast]);

  const removeAttachment = useCallback((index: number) => {
    if (onImagesChange) {
      const newImages = [...images];
      newImages.splice(index, 1);
      onImagesChange(newImages);
    }
  }, [images, onImagesChange]);

  const isVideoUrl = (url: string) => url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");

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
          accept="image/*,video/*"
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
              <div className="flex items-center gap-1">
                <ImageIcon className="h-4 w-4" />
                <Video className="h-4 w-4" />
              </div>
            )}
            <span className="ml-1">Adicionar Imagem/Vídeo</span>
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Suporta Colar (Ctrl+V)
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {images.map((url, index) => {
            const isVideo = isVideoUrl(url);
            return (
              <div key={index} className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center">
                {isVideo ? (
                  <video
                    src={url}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Anexo ${index + 1}`}
                    className="max-w-full max-h-full object-contain cursor-pointer"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="secondary" className="h-8 w-8">
                        {isVideo ? <Video className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                      <VisuallyHidden>
                        <DialogTitle>Visualização de {isVideo ? "Vídeo" : "Imagem"}</DialogTitle>
                      </VisuallyHidden>
                      {isVideo ? (
                        <video 
                          src={url} 
                          controls
                          autoPlay
                          className="max-w-full max-h-full" 
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt="Preview" 
                          className="max-w-full max-h-full object-contain" 
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={() => removeAttachment(index)}
                    data-testid={dataTestId ? `${dataTestId}-remove-attachment-${index}` : undefined}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isVideo && (
                  <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-md">
                    <Video className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
