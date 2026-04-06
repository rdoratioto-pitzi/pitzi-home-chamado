import { useState, useRef, useCallback, useMemo } from "react";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from "@/components/ui/button";
import { 
  X, Loader2, Maximize2, Video, FileText, Paperclip, FileSpreadsheet, File, Download,
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
  attachments?: { name: string; url: string }[];
  onAttachmentsChange?: (attachments: { name: string; url: string }[]) => void;
  /** @deprecated Use attachments/onAttachmentsChange instead */
  images?: string[];
  /** @deprecated Use attachments/onAttachmentsChange instead */
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
  attachments: attachmentsProp,
  onAttachmentsChange,
  images: imagesProp,
  onImagesChange,
  placeholder,
  disabled = false,
  className: externalClassName,
  "data-testid": dataTestId,
}: RichTextareaProps) {
  // Support both new (attachments) and legacy (images) props
  const attachments: { name: string; url: string }[] = (attachmentsProp ?? (imagesProp || []).map((url, i) => ({ name: `Arquivo_${i + 1}`, url }))).filter(a => a != null && a.url);
  const handleAttachmentsChange = useCallback((newAttachments: { name: string; url: string }[]) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(newAttachments);
    } else if (onImagesChange) {
      onImagesChange(newAttachments.map(a => a.url));
    }
  }, [onAttachmentsChange, onImagesChange]);
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
      ]
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
    const newFiles: { name: string; url: string }[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) {
        newFiles.push({ name: file.name, url });
      }
    }

    if (newFiles.length > 0) {
      handleAttachmentsChange([...attachments, ...newFiles]);
      toast({
        title: "Anexo adicionado",
        description: `${newFiles.length} arquivo(s) adicionado(s) com sucesso.`,
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [attachments, handleAttachmentsChange, uploadFile, toast]);

  const removeAttachment = useCallback((index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    handleAttachmentsChange(newAttachments);
  }, [attachments, handleAttachmentsChange]);

  const openFileInNewTab = useCallback((att: { name: string; url: string }, index: number) => {
    const fileName = att.name || getFileNameFromDataUrl(att.url, index);
    const link = document.createElement("a");
    link.href = att.url;
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
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;

    e.preventDefault();
    setIsUploading(true);

    const newFiles: { name: string; url: string }[] = [];
    for (const file of imageFiles) {
      const url = await uploadFile(file);
      if (url) {
        const ext = file.type.split('/')[1] || 'png';
        newFiles.push({ name: file.name || `imagem_colada.${ext}`, url });
      }
    }

    if (newFiles.length > 0) {
      handleAttachmentsChange([...attachments, ...newFiles]);
      toast({
        title: "Imagem colada",
        description: "A imagem foi adicionada aos anexos.",
      });
    }

    setIsUploading(false);
  }, [attachments, handleAttachmentsChange, uploadFile, toast]);

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
        <div className="[&_.ql-editor]:text-foreground [&_.ql-editor]:dark:text-gray-100 [&_.ql-toolbar]:dark:border-gray-700 [&_.ql-toolbar]:dark:bg-gray-900/50 [&_.ql-container]:dark:border-gray-700 [&_.ql-editor.ql-blank]:dark:text-gray-400">
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
        </div>
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

      {attachments.length > 0 && (
        <div className="space-y-2 mt-2">
          {attachments.map((att, index) => {
            const fileType = getFileTypeFromDataUrl(att.url);
            const isMedia = fileType === "image" || fileType === "video";
            const displayName = att.name || getFileNameFromDataUrl(att.url, index);
            
            if (isMedia) {
              return (
                <div key={index} className="relative group rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center" style={{ maxHeight: "200px" }}>
                  {fileType === "video" ? (
                    <video src={att.url} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <img src={att.url} alt={displayName} className="max-w-full max-h-full object-contain cursor-pointer" />
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
                          <video src={att.url} controls autoPlay className="max-w-full max-h-full" />
                        ) : (
                          <img src={att.url} alt="Preview" className="max-w-full max-h-full object-contain" />
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
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                    {displayName}
                  </div>
                </div>
              );
            }
            
            return (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 group">
                <FileIcon type={fileType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{fileType === "pdf" ? "PDF" : fileType === "excel" ? "Planilha" : fileType === "document" ? "Documento" : "Arquivo"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openFileInNewTab(att, index)}
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
