"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Plus, Search, Trash2, Loader2, Users, Upload, CheckCircle, XCircle, Download, Sparkles } from "lucide-react";
import { EmptyState, PageLoading } from "@/components/whatsapp/empty-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface Contact {
  _id: string;
  name?: string;
  email: string;
  tags: string[];
  optIn: boolean;
  bounced: boolean;
  assignedTo?: { _id: string; name: string };
  engaged?: boolean;
}

interface ImportResult {
  total: number;
  createdCount: number;
  updatedCount: number;
  invalidCount: number;
  rows: { row: number; email: string; name?: string; status: string; reason?: string }[];
}

export function EmailContactsTab() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canAssign = role && !["AGENT", "VIEWER"].includes(role);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", email: "", tags: "", optIn: true });

  const debouncedSearch = useDebouncedValue(search);

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["email-contacts", debouncedSearch],
    queryFn: () => axios.get("/api/email-contacts", { params: { search: debouncedSearch || undefined, limit: 100 } }).then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: () =>
      axios.post("/api/email-contacts", {
        name: form.name,
        email: form.email,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        optIn: form.optIn,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      toast({ title: "Contact created" });
      setOpen(false);
      setForm({ name: "", email: "", tags: "", optIn: true });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to create contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const toggleOptIn = useMutation({
    mutationFn: ({ id, optIn }: { id: string; optIn: boolean }) => axios.patch(`/api/email-contacts/${id}`, { optIn }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-contacts"] }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/email-contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to delete contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", "all"],
    queryFn: () => axios.get("/api/agents?limit=50").then((r) => r.data.data as { _id: string; name: string }[]),
    enabled: !!canAssign,
  });

  const assign = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) => axios.patch(`/api/email-contacts/${id}`, { assignedTo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-contacts"] }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to assign contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post("/api/email-contacts/import", fd);
      setImportResult(res.data.data);
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Upload failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Contacts</h1>
          <p className="text-muted-foreground">Manage opted-in contacts for email campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setImportResult(null); setImportOpen(true); }}>
            <Upload className="h-4 w-4 mr-2" />Upload Excel
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, mumbai" /></div>
                <div className="flex items-center justify-between">
                  <Label>Opted-in for marketing emails</Label>
                  <Switch checked={form.optIn} onCheckedChange={(v) => setForm({ ...form, optIn: v })} />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader><DialogTitle>Import Contacts from Excel / CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Columns: <span className="font-mono text-xs">Name, Email, Tags</span> (Email required)</p>
              <p className="text-xs text-muted-foreground">Supports .xlsx, .xls, .csv · Max 5000 rows · All imports set as opted-in</p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {importing ? "Uploading…" : "Choose File"}
                </Button>
                <Button variant="outline" asChild>
                  <a href="/api/email-contacts/sample" download><Download className="h-4 w-4 mr-2" />Sample CSV</a>
                </Button>
              </div>
            </div>

            {importResult && (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" />{importResult.createdCount} created</span>
                  {importResult.updatedCount > 0 && <span className="text-blue-600">{importResult.updatedCount} updated</span>}
                  {importResult.invalidCount > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="h-4 w-4" />{importResult.invalidCount} skipped</span>}
                </div>
                {importResult.invalidCount > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded border text-xs divide-y">
                    {importResult.rows.filter((r) => r.status === "INVALID").map((r) => (
                      <div key={r.row} className="px-3 py-1.5 flex justify-between text-red-600">
                        <span>Row {r.row}: {r.email || "—"}</span>
                        <span>{r.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full" onClick={() => setImportOpen(false)}>Done</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts" className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoading />
          ) : contacts?.length === 0 ? (
            <EmptyState icon={Users} title="No contacts yet" description="Add a contact manually, or import a list from CSV/Excel." />
          ) : (
            <div className="divide-y">
              {contacts?.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-4 group">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {c.name || "Unnamed"}
                      {c.engaged && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                          <Sparkles className="h-2.5 w-2.5" />Engaged
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.email}
                      {c.bounced && <span className="text-red-500 ml-1.5">· bounced</span>}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
                      {canAssign ? (
                        <Select
                          value={c.assignedTo?._id || "unassigned"}
                          onValueChange={(v) => assign.mutate({ id: c._id, assignedTo: v === "unassigned" ? null : v })}
                        >
                          <SelectTrigger className="h-6 text-[11px] w-auto gap-1 border-dashed px-2 py-0">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {agents?.map((a) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : c.assignedTo ? (
                        <span className="text-[10px] text-muted-foreground">Assigned to {c.assignedTo.name}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.optIn}
                      aria-label={c.optIn ? "Opt out contact" : "Opt in contact"}
                      disabled={toggleOptIn.isPending && toggleOptIn.variables?.id === c._id}
                      onClick={() => toggleOptIn.mutate({ id: c._id, optIn: !c.optIn })}
                      className={`
                        inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border
                        transition-colors duration-200 shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400
                        disabled:cursor-not-allowed disabled:opacity-60
                        ${c.optIn
                          ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
                          : "bg-rose-50/70 border-rose-200/80 hover:border-rose-300"
                        }
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${c.optIn ? "bg-emerald-500" : "bg-rose-400"}`} />
                      <span className={`text-[11px] font-medium tracking-wide transition-colors duration-200 whitespace-nowrap ${c.optIn ? "text-emerald-700" : "text-rose-500"}`}>
                        {c.optIn ? "Opted in" : "Opted out"}
                      </span>
                      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ml-0.5 transition-colors duration-200 ${c.optIn ? "bg-emerald-500" : "bg-gray-300"}`}>
                        <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-out ${c.optIn ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </span>
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${c.name || c.email}`}
                          className="h-8 w-8 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {c.name || c.email}?</AlertDialogTitle>
                          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(c._id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
