"use client"

import * as React from "react"
import { Upload, X, File, Image as ImageIcon, FileText, CheckCircle2, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"

// ============================================================================
// Types
// ============================================================================

export interface FileUploadFile {
  id: string
  file: File
  preview?: string
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
}

export interface FileUploadButtonProps {
  /** Accepted file types */
  accept?: string
  /** Custom file type validation (overrides accept) */
  allowedTypes?: readonly string[]
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number
  /** Maximum number of files */
  maxFiles?: number
  /** Whether to allow multiple file selection */
  multiple?: boolean
  /** Whether the upload is disabled */
  disabled?: boolean
  /** Label for the dropzone */
  label?: string
  /** Description text */
  description?: string
  /** Callback when files are selected */
  onFilesChange?: (files: FileUploadFile[]) => void
  /** Custom upload handler (returns promise with progress updates) */
  uploadHandler?: (file: File, onProgress: (progress: number) => void) => Promise<void>
  /** Class name for custom styling */
  className?: string
}

// MIME types for allowed file types
const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const

const DEFAULT_ACCEPT = "image/*,.pdf,.docx"

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function getFileIcon(file: File): React.ElementType {
  if (file.type.startsWith("image/")) return ImageIcon
  if (file.type === "application/pdf") return FileText
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return FileText
  return File
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

async function getImagePreview(file: File): Promise<string | undefined> {
  if (!isImageFile(file)) return undefined

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}

// ============================================================================
// Component
// ============================================================================

const FileUploadButton = React.forwardRef<HTMLDivElement, FileUploadButtonProps>(
  (
    {
      accept = DEFAULT_ACCEPT,
      allowedTypes = DEFAULT_ALLOWED_TYPES,
      maxSize = 10 * 1024 * 1024, // 10MB
      maxFiles = 5,
      multiple = true,
      disabled = false,
      label = "Arraste arquivos aqui ou clique para selecionar",
      description = "Arquivos permitidos: imagens, PDF, DOCX (máx. 10MB)",
      onFilesChange,
      uploadHandler,
      className,
    },
    ref
  ) => {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    const [files, setFiles] = React.useState<FileUploadFile[]>([])
    const [isDragging, setIsDragging] = React.useState(false)
    const [dragCounter, setDragCounter] = React.useState(0)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // -------------------------------------------------------------------------
    // File Validation
    // -------------------------------------------------------------------------
    const validateFile = React.useCallback(
      (file: File): string | null => {
        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type as typeof allowedTypes[number])) {
          return `Tipo de arquivo não permitido: ${file.type || "desconhecido"}`
        }

        // Check file size
        if (file.size > maxSize) {
          return `Arquivo muito grande: ${formatFileSize(file.size)}. Máximo: ${formatFileSize(maxSize)}`
        }

        return null
      },
      [allowedTypes, maxSize]
    )

    // -------------------------------------------------------------------------
    // File Processing
    // -------------------------------------------------------------------------
    const processFiles = React.useCallback(
      async (fileList: FileList | File[]) => {
        const newFiles: File[] = Array.from(fileList)

        // Check max files limit
        const remainingSlots = maxFiles - files.length
        if (remainingSlots <= 0) {
          return
        }

        const filesToAdd = newFiles.slice(0, remainingSlots)
        const processedFiles: FileUploadFile[] = []

        for (const file of filesToAdd) {
          const error = validateFile(file)

          const fileUpload: FileUploadFile = {
            id: generateId(),
            file,
            preview: undefined,
            progress: 0,
            status: error ? "error" : "pending",
            error: error || undefined,
          }

          // Generate preview for images
          if (!error && isImageFile(file)) {
            fileUpload.preview = await getImagePreview(file)
          }

          processedFiles.push(fileUpload)
        }

        const updatedFiles = [...files, ...processedFiles]
        setFiles(updatedFiles)
        onFilesChange?.(updatedFiles)

        // Auto-start upload for valid files
        const validFiles = processedFiles.filter((f) => f.status === "pending")
        if (validFiles.length > 0 && uploadHandler) {
          for (const fileUpload of validFiles) {
            uploadFile(fileUpload.id)
          }
        }
      },
      [files, maxFiles, validateFile, onFilesChange, uploadHandler]
    )

    // -------------------------------------------------------------------------
    // Upload Handling
    // -------------------------------------------------------------------------
    const uploadFile = React.useCallback(
      async (fileId: string) => {
        const fileUpload = files.find((f) => f.id === fileId)
        if (!fileUpload || !uploadHandler) return

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "uploading" as const, progress: 0 } : f
          )
        )

        try {
          await uploadHandler(fileUpload.file, (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, progress } : f
              )
            )
          })

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: "success" as const, progress: 100 } : f
            )
          )
        } catch (error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: "error" as const, error: error instanceof Error ? error.message : "Upload failed" }
                : f
            )
          )
        }
      },
      [files, uploadHandler]
    )

    // -------------------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------------------
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setDragCounter((prev) => prev + 1)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setDragCounter((prev) => {
        const newCount = prev - 1
        if (newCount === 0) {
          setIsDragging(false)
        }
        return newCount
      })
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      setDragCounter(0)
      
      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles)
      }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles)
      }
      // Reset input value to allow selecting the same file again
      e.target.value = ""
    }

    const handleRemoveFile = (fileId: string) => {
      const updatedFiles = files.filter((f) => f.id !== fileId)
      setFiles(updatedFiles)
      onFilesChange?.(updatedFiles)
    }

    const handleRetry = (fileId: string) => {
      uploadFile(fileId)
    }

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
      <div
        ref={ref}
        className={cn("space-y-4", className)}
      >
        {/* Dropzone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
          onDrop={disabled ? undefined : handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-2">
            <Upload className={cn("h-10 w-10 text-muted-foreground", isDragging && "text-primary")} />
            <div className="text-sm">
              <span className="font-medium text-foreground">{label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((fileUpload) => (
              <Card key={fileUpload.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Preview or Icon */}
                    <div className="flex-shrink-0">
                      {fileUpload.preview ? (
                        <img
                          src={fileUpload.preview}
                          alt={fileUpload.file.name}
                          className="h-10 w-10 object-cover rounded"
                        />
                      ) : (
                        <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                          {React.createElement(getFileIcon(fileUpload.file), {
                            className: "h-5 w-5 text-muted-foreground"
                          })}
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileUpload.file.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(fileUpload.file.size)}
                        </p>
                        {fileUpload.status === "uploading" && (
                          <Progress value={fileUpload.progress} className="h-1 w-20" />
                        )}
                        {fileUpload.status === "error" && fileUpload.error && (
                          <p className="text-xs text-destructive truncate">{fileUpload.error}</p>
                        )}
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {fileUpload.status === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {fileUpload.status === "error" && (
                        <button
                          onClick={() => handleRetry(fileUpload.id)}
                          className="text-destructive hover:text-destructive/80"
                          title="Tentar novamente"
                        >
                          <AlertCircle className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* Remove Button */}
                    {fileUpload.status !== "uploading" && (
                      <button
                        onClick={() => handleRemoveFile(fileUpload.id)}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        title="Remover"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }
)

export { FileUploadButton }