"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { UploadCloud, Download, Loader2, CheckCircle2, XCircle, Users, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";

interface ImportStats {
  total: number;
  validCount: number;
  invalidCount: number;
  createdCount: number;
  updatedCount: number;
  rows: { row: number; name?: string; phone: string; city?: string; tags: string[]; status: "VALID" | "INVALID"; reason?: string }[];
}

interface Contact {
  _id: string;
  name?: string;
  phone: string;
  city?: string;
  tags: string[];
  optIn: boolean;
}

export function Step2Recipients({ campaignId }: { campaignId: string | null }) {
  const qc = useQueryClient();
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (campaignId) fd.append("campaignId", campaignId);
      return axios.post("/api/whatsapp/contacts/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (res) => {
      setStats(res.data.data);
      qc.invalidateQueries({ queryKey: ["whatsapp-campaign-contacts", campaignId] });
      toast({ title: `Imported ${res.data.data.validCount} contacts` });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Import failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) importMutation.mutate(accepted[0]);
  }, [importMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const { data } = useQuery({
    queryKey: ["whatsapp-campaign-contacts", campaignId, search, page],
    queryFn: () =>
      axios
        .get("/api/whatsapp/contacts", { params: { campaignId, search: search || undefined, page, limit: 10 } })
        .then((r) => r.data as { data: Contact[]; pagination: { page: number; pages: number; total: number } }),
    enabled: !!campaignId,
  });

  if (!campaignId) {
    return <p className="text-sm text-muted-foreground">Save the campaign details first to add recipients.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div
            {...getRootProps()}
            className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <input {...getInputProps()} />
            {importMutation.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-sm text-muted-foreground">Importing…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-8 h-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">Drag & drop your Excel/CSV file here</p>
                <p className="text-xs text-muted-foreground">or click to browse — .csv, .xlsx, .xls</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => document.querySelector<HTMLInputElement>("input[type=file]")?.click()}>
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" />Upload Excel
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/api/whatsapp/contacts/sample" download>
                <Download className="w-3.5 h-3.5 mr-1.5" />Download Sample
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-[11px] text-muted-foreground">Total Contacts</p><p className="text-lg font-bold">{stats.total}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
            <div><p className="text-[11px] text-muted-foreground">Valid Numbers</p><p className="text-lg font-bold text-green-700">{stats.validCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-600" /></div>
            <div><p className="text-[11px] text-muted-foreground">Invalid Numbers</p><p className="text-lg font-bold text-red-700">{stats.invalidCount}</p></div>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search recipients" className="pl-8 h-8 text-sm" />
            </div>
          </div>
          {!data?.data.length ? (
            <EmptyState icon={Users} title="No recipients yet" description="Upload a CSV or Excel file above to add recipients to this campaign." />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Name</th>
                    <th className="text-left font-medium px-4 py-2">Phone Number</th>
                    <th className="text-left font-medium px-4 py-2">City</th>
                    <th className="text-left font-medium px-4 py-2">Tags</th>
                    <th className="text-left font-medium px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((c) => (
                    <tr key={c._id}>
                      <td className="px-4 py-2.5">{c.name || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-2.5">{c.city || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={c.optIn ? "active" : "inactive"} className="text-[10px]">{c.optIn ? "Opted In" : "Opted Out"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} total</span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
