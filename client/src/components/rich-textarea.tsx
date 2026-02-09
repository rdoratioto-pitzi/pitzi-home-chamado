import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  ImageIcon, X, Loader2, Maximize2, Video, FileText, Paperclip, FileSpreadsheet, File, Download,
  Bold, Italic, List, ListOrdered, CheckSquare, Link2, Code, Heading1, Heading2, Strikethrough, Quote, Minus,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  showToolbar?: boolean;
  className?: string;
  "data-testid"?: string;
}

function getFileTypeFromDataUrl(url: string): "image" | "video" | "pdf" | "excel" | "document" | "other" {
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

interface ToolbarAction {
  icon: typeof Bold;
  label: string;
  action: "wrap" | "prefix" | "insert";
  wrap?: string;
  prefix?: string;
  insert?: string;
  testId: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Heading1, label: "Titulo", action: "prefix", prefix: "# ", testId: "toolbar-h1" },
  { icon: Heading2, label: "Subtitulo", action: "prefix", prefix: "## ", testId: "toolbar-h2" },
  { icon: Bold, label: "Negrito", action: "wrap", wrap: "**", testId: "toolbar-bold" },
  { icon: Italic, label: "Italico", action: "wrap", wrap: "_", testId: "toolbar-italic" },
  { icon: Strikethrough, label: "Riscado", action: "wrap", wrap: "~~", testId: "toolbar-strike" },
  { icon: Code, label: "Codigo", action: "wrap", wrap: "`", testId: "toolbar-code" },
  { icon: List, label: "Lista", action: "prefix", prefix: "- ", testId: "toolbar-ul" },
  { icon: ListOrdered, label: "Lista Numerada", action: "prefix", prefix: "1. ", testId: "toolbar-ol" },
  { icon: CheckSquare, label: "Checklist", action: "prefix", prefix: "- [ ] ", testId: "toolbar-check" },
  { icon: Quote, label: "Citacao", action: "prefix", prefix: "> ", testId: "toolbar-quote" },
  { icon: Minus, label: "Separador", action: "insert", insert: "\n---\n", testId: "toolbar-hr" },
  { icon: Link2, label: "Link", action: "insert", insert: "[texto](url)", testId: "toolbar-link" },
];

function FormattingToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
  onAttach,
  isUploading,
  dataTestId,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onAttach: () => void;
  isUploading: boolean;
  dataTestId?: string;
}) {
  const applyFormat = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    let newValue = value;
    let newCursorPos = end;

    if (action.action === "wrap" && action.wrap) {
      const w = action.wrap;
      if (selected) {
        newValue = value.substring(0, start) + w + selected + w + value.substring(end);
        newCursorPos = end + w.length * 2;
      } else {
        newValue = value.substring(0, start) + w + w + value.substring(end);
        newCursorPos = start + w.length;
      }
    } else if (action.action === "prefix" && action.prefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const needsNewline = lineStart > 0 && value[lineStart - 1] !== "\n" && start > 0 && value.substring(lineStart, start).trim().length > 0;
      if (needsNewline && start === end) {
        newValue = value.substring(0, start) + "\n" + action.prefix + value.substring(end);
        newCursorPos = start + 1 + action.prefix.length;
      } else {
        newValue = value.substring(0, lineStart) + action.prefix + value.substring(lineStart);
        newCursorPos = end + action.prefix.length;
      }
    } else if (action.action === "insert" && action.insert) {
      newValue = value.substring(0, start) + action.insert + value.substring(end);
      newCursorPos = start + action.insert.length;
    }

    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [textareaRef, value, onChange]);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 rounded-t-md overflow-visible flex-wrap" data-testid={dataTestId ? `${dataTestId}-toolbar` : "formatting-toolbar"}>
      {TOOLBAR_ACTIONS.map((action, idx) => {
        const Icon = action.icon;
        const showSep = idx === 1 || idx === 5 || idx === 8 || idx === 9;
        return (
          <span key={action.testId} className="contents">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="no-default-hover-elevate no-default-active-elevate [&]:h-7 [&]:w-7 text-muted-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFormat(action)}
                  disabled={disabled}
                  data-testid={action.testId}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {action.label}
              </TooltipContent>
            </Tooltip>
            {showSep && <div className="w-px h-4 bg-border mx-0.5 shrink-0" />}
          </span>
        );
      })}
      <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="no-default-hover-elevate no-default-active-elevate [&]:h-7 [&]:w-7 text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onAttach}
            disabled={disabled || isUploading}
            data-testid={dataTestId ? `${dataTestId}-upload-btn` : "toolbar-attach"}
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Anexar Arquivo</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function RichTextarea({
  value,
  onChange,
  images = [],
  onImagesChange,
  placeholder,
  rows = 4,
  maxLength = 5000,
  disabled = false,
  showToolbar = true,
  className: externalClassName,
  "data-testid": dataTestId,
}: RichTextareaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) files.push(file);
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
        description: `${uploadedUrls.length} arquivo(s) adicionado(s) via area de transferencia.`,
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
    const currentLine = value.substring(lineStart, cursorPos);

    const numberedMatch = currentLine.match(/^(\d+)\.\s/);
    const unorderedMatch = currentLine.match(/^-\s(?!\[[ x]\]\s)/);
    const checklistMatch = currentLine.match(/^-\s\[[ x]\]\s/);
    const blockquoteMatch = currentLine.match(/^>\s/);

    let prefix = "";
    let isEmptyItem = false;

    if (numberedMatch) {
      const num = parseInt(numberedMatch[0], 10);
      prefix = `${num + 1}. `;
      isEmptyItem = currentLine.trim() === `${num}.`;
    } else if (checklistMatch) {
      prefix = "- [ ] ";
      isEmptyItem = currentLine.trim() === "- [ ]" || currentLine.trim() === "- [x]";
    } else if (unorderedMatch) {
      prefix = "- ";
      isEmptyItem = currentLine.trim() === "-";
    } else if (blockquoteMatch) {
      prefix = "> ";
      isEmptyItem = currentLine.trim() === ">";
    }

    if (!prefix) return;

    e.preventDefault();

    if (isEmptyItem) {
      const newValue = value.substring(0, lineStart) + "\n" + value.substring(cursorPos);
      onChange(newValue);
      const newPos = lineStart + 1;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      const insert = "\n" + prefix;
      const newValue = value.substring(0, cursorPos) + insert + value.substring(cursorPos);
      onChange(newValue);
      const newPos = cursorPos + insert.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  }, [value, onChange, textareaRef]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  }, []);

  const toolbarVisible = showToolbar && (isFocused || value.length > 0);

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef}
        className={cn(
          "relative border rounded-md transition-all",
          toolbarVisible ? "border-primary/50 ring-1 ring-primary/20" : "border-input",
          disabled && "opacity-60"
        )}
        onBlur={handleBlur}
      >
        {toolbarVisible && (
          <FormattingToolbar
            textareaRef={textareaRef}
            value={value}
            onChange={onChange}
            disabled={disabled}
            onAttach={() => fileInputRef.current?.click()}
            isUploading={isUploading}
            dataTestId={dataTestId}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled || isUploading}
          data-testid={dataTestId}
          className={cn(
            "border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
            toolbarVisible ? "rounded-t-none" : "",
            externalClassName
          )}
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
        {!toolbarVisible && (
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
        )}
        <span className={cn("text-[10px] text-muted-foreground", toolbarVisible && "ml-auto")}>
          {value.length}/{maxLength}
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
