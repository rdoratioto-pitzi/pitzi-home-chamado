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
, 