"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, FileText, Globe, Upload, Check, Trash2, Loader2, Link2 } from "lucide-react";
import { timeAgo, formatBytes } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/firebase";

const typeConfig: Record<string, { color: string; icon: string }> = {
  PDF:    { color: "bg-red-100 text-red-700",    icon: "📄" },
  DOCX:   { color: "bg-blue-100 text-blue-700",  icon: "📝" },
  TXT:    { color: "bg-gray-100 text-gray-700",  icon: "📃" },
  CSV:    { color: "bg-green-100 text-green-700", icon: "📊" },
  URL:    { color: "bg-purple-100 text-purple-700", icon: "🌐" },
  MANUAL: { color: "bg-indigo-100 text-indigo-700", icon: "✏️" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "Pending",    color: "bg-gray-100 text-gray-600"  },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-blue-600"  },
  READY:      { label: "Ready",      color: "bg-green-100 text-green-700" },
  FAILED:     { label: "Failed",     color: "bg-red-100 text-red-700"    },
};

// ── Types for dialog modes ───────────────────────────────────────────────────
type DialogMode = "url" | "file" | "manual" | null;

interface KBItem {
  _id: string; name: string; type: string; status: string;
  description?: string; fileSize?: number; createdAt: string;
  usageCount: number; tags: string[]; sourceUrl?: string;
}

export default function KnowledgeBasePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<DialogMode>(null);

  // URL mode state
  const [url, setUrl]             = useState("");
  const [urlName, setUrlName]     = useState("");
  const [urlDesc, setUrlDesc]     = useState("");
  const [urlTags, setUrlTags]     = useState("");
  const [fetchingTitle, setFetchingTitle] = useState(false);

  // File mode state
  const [file, setFile]           = useState<File | null>(null);
  const [fileType, setFileType]   = useState<"PDF" | "DOCX" | "TXT" | "CSV">("PDF");
  const [fileName2, setFileName2] = useState("");
  const [fileDesc, setFileDesc]   = useState("");
  const [fileTags, setFileTags]   = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Manual mode state
  const [manName, setManName]     = useState("");
  const [manContent, setManContent] = useState("");
  const [manDesc, setManDesc]     = useState("");
  const [manTags, setManTags]     = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-base", search],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-base?limit=50");
      const d = await res.json();
      return d.data as KBItem[];
    },
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Document added successfully!" });
        resetAll();
        setMode(null);
        qc.invalidateQueries({ queryKey: ["knowledge-base"] });
      } else {
        toast({ title: res.error || "Failed to add", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      qc.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
  });

  function resetAll() {
    setUrl(""); setUrlName(""); setUrlDesc(""); setUrlTags("");
    setFile(null); setFileName2(""); setFileDesc(""); setFileTags(""); setUploadProgress(0);
    setManName(""); setManContent(""); setManDesc(""); setManTags("");
  }

  // Auto-fetch page title from URL
  async function fetchPageTitle() {
    if (!url || !url.startsWith("http")) return;
    setFetchingTitle(true);
    try {
      const res = await fetch(`/api/knowledge-base/fetch-title?url=${encodeURIComponent(url)}`);
      const d = await res.json();
      if (d.title) setUrlName(d.title);
      if (d.description && !urlDesc) setUrlDesc(d.description);
    } catch {
      // fallback: use hostname as name
      try { setUrlName(new URL(url).hostname.replace("www.", "")); } catch {}
    } finally {
      setFetchingTitle(false);
    }
  }

  // Submit URL document
  async function submitUrl() {
    if (!url) { toast({ title: "Please enter a URL", variant: "destructive" }); return; }
    const name = urlName || new URL(url).hostname.replace("www.", "");
    createMutation.mutate({
      name, description: urlDesc, type: "URL", sourceUrl: url,
      tags: urlTags ? urlTags.split(",").map((t) => t.trim()) : ["website"],
    });
  }

  // Submit file document — tries server-side text extraction first, falls back to Firebase
  async function submitFile() {
    if (!file) { toast({ title: "Please select a file", variant: "destructive" }); return; }
    const name = fileName2 || file.name.replace(/\.[^/.]+$/, "");
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    setUploading(true);
    try {
      // TXT / CSV — use server-side text reader, no Firebase needed
      if (["txt", "csv", "md"].includes(ext)) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (d.success && d.data.content) {
          createMutation.mutate({
            name, description: fileDesc, type: fileType === "CSV" ? "CSV" : "TXT",
            content: d.data.content, fileSize: file.size,
            tags: fileTags ? fileTags.split(",").map((t) => t.trim()) : [],
          });
          return;
        }
      }

      // PDF / DOCX — try Firebase
      try {
        const result = await uploadFile(file, `knowledge-base/${Date.now()}-${file.name}`, setUploadProgress);
        createMutation.mutate({
          name, description: fileDesc, type: fileType,
          fileUrl: result.url, fileName: result.name, fileSize: result.size,
          tags: fileTags ? fileTags.split(",").map((t) => t.trim()) : [],
        });
      } catch {
        toast({
          title: "Firebase not configured",
          description: "PDF/DOCX upload requires Firebase. Use the 'Write Manually' option to paste the content instead.",
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  }

  // Submit manual document
  async function submitManual() {
    if (!manName || !manContent) { toast({ title: "Name and content are required", variant: "destructive" }); return; }
    createMutation.mutate({
      name: manName, description: manDesc, type: "MANUAL", content: manContent,
      tags: manTags ? manTags.split(",").map((t) => t.trim()) : [],
    });
  }

  const items = (data || []).filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} documents · used to train your chatbot</p>
        </div>
        <Button onClick={() => setMode("url")} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Add Document
        </Button>
      </div>

      {/* Quick add cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => { resetAll(); setMode("url"); }}
          className="flex items-center gap-3 p-4 bg-purple-50 border-2 border-purple-200 hover:border-purple-400 rounded-xl text-left transition-all group"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Add Website URL</p>
            <p className="text-xs text-gray-500 mt-0.5">Paste a URL — we fetch & index the content</p>
          </div>
        </button>

        <button
          onClick={() => { resetAll(); setMode("manual"); }}
          className="flex items-center gap-3 p-4 bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl text-left transition-all group"
        >
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Write Manually</p>
            <p className="text-xs text-gray-500 mt-0.5">Type FAQs, policies, or any text content</p>
          </div>
        </button>

        <button
          onClick={() => { resetAll(); setMode("file"); }}
          className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 hover:border-green-400 rounded-xl text-left transition-all group"
        >
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Upload File</p>
            <p className="text-xs text-gray-500 mt-0.5">PDF, DOCX, TXT, or CSV documents</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" />
      </div>

      {/* Document grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 bg-white rounded-xl animate-pulse border" />
        ))}

        {!isLoading && items.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm mt-1">Add a website URL, write content manually, or upload a file</p>
          </div>
        )}

        {items.map((item) => {
          const typeCfg  = typeConfig[item.type]   || typeConfig.MANUAL;
          const statusCfg = statusConfig[item.status] || statusConfig.PENDING;
          return (
            <Card key={item._id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${typeCfg.color}`}>
                    {typeCfg.icon} {item.type}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    <button
                      onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(item._id); }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-sm text-gray-900">{item.name}</h3>
                {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1 truncate"
                  >
                    <Link2 className="w-3 h-3 shrink-0" />{item.sourceUrl}
                  </a>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  {item.fileSize && <span>{formatBytes(item.fileSize)}</span>}
                  <span>{timeAgo(item.createdAt)}</span>
                  <span>{item.usageCount ?? 0} uses</span>
                </div>

                {item.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}

                {item.status === "PROCESSING" && (
                  <div className="mt-2 w-full bg-blue-100 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full animate-pulse w-2/3" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── URL Dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={mode === "url"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-500" />
              Add Website URL
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* URL input with Fetch button */}
            <div>
              <label className="text-sm font-medium text-gray-700">Website URL *</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.example.com/about"
                  type="url"
                  className="flex-1"
                  onBlur={fetchPageTitle}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchPageTitle}
                  disabled={fetchingTitle || !url}
                  className="shrink-0"
                >
                  {fetchingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">We will fetch and index the text content of this page for the chatbot</p>
            </div>

            {/* Name (auto-filled by Fetch) */}
            <div>
              <label className="text-sm font-medium text-gray-700">Document Name</label>
              <Input
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="Auto-filled from page title"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={urlDesc}
                onChange={(e) => setUrlDesc(e.target.value)}
                placeholder="What does this page contain?"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Tags (comma-separated)</label>
              <Input
                value={urlTags}
                onChange={(e) => setUrlTags(e.target.value)}
                placeholder="faq, pricing, about"
                className="mt-1"
              />
            </div>

            {/* Info box */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
              <p className="font-semibold mb-1">ℹ️ How it works</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>We fetch the page and strip HTML to plain text</li>
                <li>Content is split into searchable chunks</li>
                <li>Status changes to <strong>Ready</strong> when processing is complete</li>
                <li>The chatbot uses this content to answer visitor questions</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button
              onClick={submitUrl}
              disabled={createMutation.isPending || !url}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</> : "Add Website"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={mode === "manual"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Write Content Manually
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Document Name *</label>
              <Input value={manName} onChange={(e) => setManName(e.target.value)} placeholder="e.g. FAQ Document" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Content *</label>
              <p className="text-xs text-gray-400 mb-1">Paste or type FAQs, policies, product info, etc.</p>
              <textarea
                value={manContent}
                onChange={(e) => setManContent(e.target.value)}
                rows={8}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={"Q: What is your return policy?\nA: We accept returns within 30 days...\n\nQ: How do I book a test drive?\nA: ..."}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input value={manDesc} onChange={(e) => setManDesc(e.target.value)} placeholder="Brief description" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tags (comma-separated)</label>
              <Input value={manTags} onChange={(e) => setManTags(e.target.value)} placeholder="faq, returns, shipping" className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={submitManual} disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── File Upload Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={mode === "file"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-500" />
              Upload Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">File Type</label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {(["PDF", "DOCX", "TXT", "CSV"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFileType(t)}
                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      fileType === t ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {typeConfig[t].icon} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div>
              <label className="text-sm font-medium text-gray-700">File *</label>
              <div className="mt-1 border-2 border-dashed rounded-xl p-6 text-center transition-colors hover:border-green-300">
                {file ? (
                  <div className="text-sm">
                    <Check className="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-gray-400 text-xs">{formatBytes(file.size)}</p>
                    <button onClick={() => setFile(null)} className="text-xs text-red-400 hover:text-red-600 mt-1">Remove</button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, TXT, CSV supported</p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt,.csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setFile(f); if (!fileName2) setFileName2(f.name.replace(/\.[^/.]+$/, "")); }
                      }}
                    />
                  </label>
                )}
                {uploading && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Uploading {uploadProgress}%…</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Document Name</label>
              <Input value={fileName2} onChange={(e) => setFileName2(e.target.value)} placeholder="Auto-filled from file name" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} placeholder="Brief description" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tags (comma-separated)</label>
              <Input value={fileTags} onChange={(e) => setFileTags(e.target.value)} placeholder="brochure, pricing" className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={submitFile} disabled={createMutation.isPending || uploading || !file} className="bg-green-600 hover:bg-green-700">
              {(createMutation.isPending || uploading)
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                : "Upload Document"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
