"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2, ScanText, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface UploadedFile {
  file_id: string;
  original_filename: string;
  size_mb: number;
  status: "uploading" | "uploaded" | "processing" | "processed" | "graphing" | "graphed" | "error";
  ocr_used?: boolean;
  char_count?: number;
  preview?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function FileUploader() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const tempEntry: UploadedFile = {
      file_id: crypto.randomUUID(),
      original_filename: file.name,
      size_mb: file.size / (1024 * 1024),
      status: "uploading",
    };
    setFiles((prev) => [...prev, tempEntry]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload/`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFiles((prev) =>
        prev.map((f) => (f.file_id === tempEntry.file_id ? { ...f, ...data, status: "uploaded" } : f))
      );
    } catch {
      setFiles((prev) => prev.map((f) => (f.file_id === tempEntry.file_id ? { ...f, status: "error" } : f)));
    }
  };

  const processFile = async (file_id: string) => {
    setFiles((prev) => prev.map((f) => (f.file_id === file_id ? { ...f, status: "processing" } : f)));
    try {
      const res = await fetch(`${API_BASE}/process/${file_id}`, { method: "POST" });
      if (!res.ok) throw new Error("Processing failed");
      const data = await res.json();
      setFiles((prev) =>
        prev.map((f) =>
          f.file_id === file_id
            ? { ...f, status: "processed", ocr_used: data.ocr_used, char_count: data.char_count, preview: data.preview }
            : f
        )
      );
      // fire-and-forget: embed for RAG + extract for the knowledge graph
      fetch(`${API_BASE}/embed/${file_id}`, { method: "POST" }).catch(() => {});
      buildGraph(file_id);
    } catch {
      setFiles((prev) => prev.map((f) => (f.file_id === file_id ? { ...f, status: "error" } : f)));
    }
  };

  const buildGraph = async (file_id: string) => {
    setFiles((prev) => prev.map((f) => (f.file_id === file_id ? { ...f, status: "graphing" } : f)));
    try {
      await api.extractGraph(file_id);
      setFiles((prev) => prev.map((f) => (f.file_id === file_id ? { ...f, status: "graphed" } : f)));
    } catch {
      setFiles((prev) => prev.map((f) => (f.file_id === file_id ? { ...f, status: "error" } : f)));
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach(uploadFile);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (file_id: string) => setFiles((prev) => prev.filter((f) => f.file_id !== file_id));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-2">Drag & drop documents here, or</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <p className="text-xs text-muted-foreground mt-3">PDF, DOCX, XLSX, PPTX, images, CSV - up to 25MB each</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.file_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.original_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.size_mb.toFixed(2)} MB
                      {f.status !== "uploading" && f.char_count !== undefined && (
                        <> · {f.char_count.toLocaleString()} chars{f.ocr_used ? " · OCR used" : ""}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {f.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {f.status === "uploaded" && (
                    <Button size="sm" variant="outline" onClick={() => processFile(f.file_id)}>
                      <ScanText className="h-3.5 w-3.5 mr-1" /> Process
                    </Button>
                  )}
                  {(f.status === "processing" || f.status === "graphing") && (
                    <div className="flex items-center gap-1 text-xs">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {f.status === "processing" ? "Extracting..." : "Building graph..."}
                    </div>
                  )}
                  {f.status === "graphed" && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Network className="h-3.5 w-3.5" /> Ready
                    </span>
                  )}
                  {f.status === "processed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {f.status === "error" && <span className="text-red-500 text-xs">Failed</span>}
                  <button onClick={() => removeFile(f.file_id)}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>

              {f.status !== "uploading" && f.preview && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {f.preview}
                  {f.char_count && f.char_count > 500 && "..."}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
