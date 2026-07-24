import { Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AttachmentMetadata } from "@/lib/api";

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
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
];

export function AttachmentUpload({ onAttachmentsChange, disabled }: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<Array<AttachmentMetadata & { file: File }>>([]);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
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
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`${file.name} has unsupported file type`);
        return;
      }
    }

    const updated = [
      ...attachments,
      ...newFiles.map((file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        file,
      })),
    ];

    setAttachments(updated);
    onAttachmentsChange(
      updated.map(({ id, filename, mimeType, sizeBytes }) => ({
        id,
        filename,
        mimeType,
        sizeBytes,
      })),
    );
  };

  const removeAttachment = (id: string) => {
    const updated = attachments.filter((a) => a.id !== id);
    setAttachments(updated);
    onAttachmentsChange(
      updated.map(({ id, filename, mimeType, sizeBytes }) => ({
        id,
        filename,
        mimeType,
        sizeBytes,
      })),
    );
    setError(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
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
          Attach files
        </button>
        <span className="text-xs text-muted">
          {attachments.length}/{MAX_FILES} files
        </span>
      </div>
      {error && (
        <div className="rounded-lg border border-alert/40 bg-alert-soft p-2 text-xs text-alert">
          {error}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 rounded-lg border border-edge bg-surface p-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs">{attachment.filename}</span>
              <span className="text-xs text-muted">
                {(attachment.sizeBytes / 1024).toFixed(1)}KB
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="rounded p-1 hover:bg-surface/50"
                disabled={disabled}
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
