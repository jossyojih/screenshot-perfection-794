import { FileImage, Paperclip, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { uploadAttachments, type AttachmentMetadata } from "@/lib/api";

interface AttachmentUploadProps {
  onAttachmentsChange: (attachments: AttachmentMetadata[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/pdf",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
];

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);

interface PendingAttachment extends AttachmentMetadata {
  file: File;
  previewUrl?: string;
  uploading: boolean;
  progress: number;
  error?: string;
}

export function AttachmentUpload({ onAttachmentsChange, disabled }: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notifyParent = useCallback(
    (items: PendingAttachment[]) => {
      onAttachmentsChange(
        items
          .filter((a) => !a.uploading && !a.error)
          .map(({ id, filename, mimeType, sizeBytes }) => ({ id, filename, mimeType, sizeBytes })),
      );
    },
    [onAttachmentsChange],
  );

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    setError(undefined);

    const newFiles = Array.from(files);
    if (attachments.length + newFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} exceeds 10MB limit`);
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type) && file.type !== "") {
        setError(`${file.name} has unsupported file type`);
        return;
      }
    }

    const pending: PendingAttachment[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      file,
      previewUrl: IMAGE_TYPES.has(file.type) ? URL.createObjectURL(file) : undefined,
      uploading: true,
      progress: 0,
    }));

    const updated = [...attachments, ...pending];
    setAttachments(updated);

    try {
      const filesToUpload = pending.map((p) => p.file);
      const results = await uploadAttachments(filesToUpload);

      setAttachments((current) => {
        const next = current.map((a) => {
          const pendingIndex = pending.findIndex((p) => p.id === a.id);
          if (pendingIndex === -1) return a;
          const result = results[pendingIndex];
          if (result) {
            return {
              ...a,
              id: result.id,
              filename: result.filename,
              mimeType: result.mimeType,
              sizeBytes: result.sizeBytes,
              uploading: false,
              progress: 100,
            };
          }
          return { ...a, uploading: false, error: "Upload failed" };
        });
        notifyParent(next);
        return next;
      });
    } catch (err) {
      setAttachments((current) => {
        const next = current.map((a) => {
          if (pending.some((p) => p.id === a.id)) {
            return {
              ...a,
              uploading: false,
              error: err instanceof Error ? err.message : "Upload failed",
            };
          }
          return a;
        });
        notifyParent(next);
        return next;
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const removing = current.find((a) => a.id === id);
      if (removing?.previewUrl) URL.revokeObjectURL(removing.previewUrl);
      const next = current.filter((a) => a.id !== id);
      notifyParent(next);
      return next;
    });
    setError(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={(e) => void handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= MAX_FILES}
          className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2 text-xs hover:bg-surface/50 disabled:opacity-50"
        >
          <Paperclip className="size-4" />
          <span className="hidden sm:inline">Attach files</span>
          <span className="sm:hidden">Attach</span>
        </button>
        <span className="text-xs text-muted">
          {attachments.length}/{MAX_FILES}
        </span>
      </div>
      {error && (
        <div className="rounded-lg border border-alert/40 bg-alert-soft p-2 text-xs text-alert">
          {error}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex items-center gap-2 rounded-lg border border-edge bg-surface p-2"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.filename}
                  className="size-10 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded bg-void/40">
                  <FileImage className="size-4 text-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{attachment.filename}</div>
                <div className="text-[10px] text-muted">
                  {(attachment.sizeBytes / 1024).toFixed(1)}KB
                  {attachment.uploading && " · uploading…"}
                  {attachment.error && ` · ${attachment.error}`}
                </div>
                {attachment.uploading && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-edge">
                    <div
                      className="h-full animate-pulse rounded-full bg-glow"
                      style={{ width: "60%" }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="shrink-0 rounded p-1 hover:bg-surface/50"
                disabled={disabled}
                aria-label={`Remove ${attachment.filename}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
