import { useState, useRef, useCallback, useMemo } from "react";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from "@/components/ui/button";
import { 
  ImageIcon, X, Loader2, Maximize2, Video, FileText, Paperclip, FileSpreadsheet, File, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

function getFileTypeFromDataUrl(url: string): "image" | "video" | "pdf" | "excel" | "document" | "other" {
  // Garantir que url não seja null/undefined antes de usar startsWith/endsWith
  if (!url || typeof url !== 'string') return "other";
  if (url.startsWith("data:image/")) return "image";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:application/pdf")) return "pdf";
  if (url.startsWith("data:application/vnd.ms-excel") ||
      url.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheet") ||
      url.startsWith("data:text/csv")) return "excel";
  if (url.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessing") ||
      url.startsWith("data:application/msword")) return "document";
  if (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg")) return "video";
  if (url.endsWith(".pdf")) return "pdf";
  if (url.endsWith(".xlsx") || url.endsWith(".xls") || url.endsWith(".csv")) return "excel";
  return "other";
}

function getFileNameFromDataUrl(url: string, index: number): string {
  const mimeMatch = url.match(/^data:([^;]+);/);
  if (mimeMatch) {
    const mime = mimeMatch[1];
    const extMap: Record<string, string> = {
      "application/pdf": "pdf",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "text/csv": "csv",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/zip": "zip",
      "application/x-rar-compressed": "rar",
      "text/plain": "txt",
    };
    const ext = extMap[mime] || mime.split("/")[1] || "arquivo";
    return `Arquivo_${index + 1}.${ext}`;
  }
  return `Arquivo_${index + 1}`;
}

function FileIcon({ type }: { type: string }) {
  switch (type) {
    case "pdf": return <FileText className="h-6 w-6 text-red-500" />;
    case "excel": return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
    case "document": return <FileText className="h-6 w-6 text-blue-500" />;
    default: return <File className="h-6 w-6 text-muted-foreground" />;
  }
}

export function RichTextarea({
  value,
  onChange,
  images = [],
  onImagesChange,
  placeholder,
  disabled = false,
  className: externalClassName,
  "data-testid": dataTestId,
}: RichTextareaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'strike', 'code'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],  // Ordem correta: ordered (1.) primeiro, bullet (•) depois
        ['blockquote'],
        ['link'],
        ['clean']
      ],
    },
    keyboard: {
      bindings: {
        tab: {
          key: 9,
          handler: function (this: any, range: any, context: any) {
            const quill = this.quill;
            quill.history.cutoff();
            quill.history.push('user', 'api');
            if (context.format.list) {
              quill.format('indent', '+1', 'user');
            } else {
              quill.insertText(range.index, '  ');
            }
            quill.history.cutoff();
            quill.history.push('user', 'api');
          }
        },
        'shift-tab': {
          key: 9,
          shiftKey: true,
          handler: function (this: any, range: any, context: any) {
            const quill = this.quill;
            quill.history.cutoff();
            quill.history.push('user', 'api');
            if (context.format.list) {
              quill.format('indent', '-1', 'user');
            }
            quill.history.cutoff();
            quill.history.push('user', 'api');
          }
        },
      },
    },
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'strike', 'code',
    'list', 'blockquote',
    'link',
    'indent',
  ];

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho maximo e 50MB.",
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
          description: "Nao foi possivel ler o arquivo.",
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

  const removeAttachment = useCallback((index: number) => {
    if (onImagesChange) {
      const newImages = [...images];
      newImages.splice(index, 1);
      onImagesChange(newImages);
    }
  }, [images, onImagesChange]);

  const openFileInNewTab = useCallback((url: string, index: number) => {
    const fileName = getFileNameFromDataUrl(url, index);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleQuillChange = useCallback((content: string, delta: any, source: any, editor: any) => {
    onChange(content);
  }, [onChange]);

  const handleQuillFocus = useCallback(() => setIsFocused(true), []);
  const handleQuillBlur = useCallback(() => setIsFocused(false), []);

  const handleQuillPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) files.push(file);
    }

    if (files.length === 0) return;

    e.preventDefault(); // Prevent Quill's default paste behavior for files

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
        description: `${uploadedUrls.length} arquivo(s) adicionado(s) via area de transferencia.`,}
      );
    }

    setIsUploading(false);
  }, [images, onImagesChange, uploadFile, toast]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  }, []);

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef}
        className={cn(
          "relative border rounded-md transition-all",
          isFocused ? "border-primary/50 ring-1 ring-primary/20" : "border-input",
          disabled && "opacity-60"
        )}
        onBlur={handleBlur}
      >
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value || ''}
          onChange={handleQuillChange}
          onFocus={handleQuillFocus}
          onBlur={handleQuillBlur}
          readOnly={disabled || isUploading}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          className={cn(
            "quill-editor border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
            externalClassName
          )}
          data-testid={dataTestId}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid={dataTestId ? `${dataTestId}-file-input` : undefined}
        />
      </div>
      
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            data-testid={dataTestId ? `${dataTestId}-upload-btn-alt` : undefined}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            <span className="ml-1">Anexar</span>
          </Button>
        </div>
        <span className={cn("text-[10px] text-muted-foreground", "ml-auto")}>
          {(value || '').length}
        </span>
      </div>

      {images.length > 0 && (
        <div className="space-y-2 mt-2">
          {images.map((url, index) => {
            const fileType = getFileTypeFromDataUrl(url);
            const isMedia = fileType === "image" || fileType === "video";
            
            if (isMedia) {
              return (
                <div key={index} className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center" style={{ maxHeight: "200px" }}>
                  {fileType === "video" ? (
                    <video src={url} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <img src={url} alt={`Anexo ${index + 1}`} className="max-w-full max-h-full object-contain cursor-pointer" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="secondary" className="h-8 w-8">
                          {fileType === "video" ? <Video className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-black/95 border-none flex items-center justify-center">
                        <VisuallyHidden>
                          <DialogTitle>Visualizacao de {fileType === "video" ? "Video" : "Imagem"}</DialogTitle>
                        </VisuallyHidden>
                        {fileType === "video" ? (
                          <video src={url} controls autoPlay className="max-w-full max-h-full" />
                        ) : (
                          <img src={url} alt="Preview" className="max-w-full max-h-full object-contain" />
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
                  {fileType === "video" && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white p-1 rounded-md">
                      <Video className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 group">
                <FileIcon type={fileType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{getFileNameFromDataUrl(url, index)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{fileType === "pdf" ? "PDF" : fileType === "excel" ? "Planilha" : fileType === "document" ? "Documento" : "Arquivo"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openFileInNewTab(url, index)}
                    data-testid={dataTestId ? `${dataTestId}-open-attachment-${index}` : undefined}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeAttachment(index)}
                    data-testid={dataTestId ? `${dataTestId}-remove-attachment-${index}` : undefined}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
