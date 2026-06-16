"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Plus, Search, Trash2, Loader2, Users } from "lucide-react";
import { EmptyState, PageLoading } from "@/components/whatsapp/empty-state";

interface Contact {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
  tags: string[];
  optIn: boolean;
}

export function ContactsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tags: "", optIn: false });

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["whatsapp-contacts", search],
    queryFn: () => axios.get("/api/whatsapp/contacts", { params: { search: search || undefined, limit: 100 } }).then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: () =>
      axios.post("/api/whatsapp/contacts", {
        name: form.name,
        phone: form.phone,
        email: form.email,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        optIn: form.optIn,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: "Contact created" });
      setOpen(false);
      setForm({ name: "", phone: "", email: "", tags: "", optIn: false });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to create contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const toggleOptIn = useMutation({
    mutationFn: ({ id, optIn }: { id: string; optIn: boolean }) => axios.patch(`/api/whatsapp/contacts/${id}`, { optIn }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-contacts"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/whatsapp/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: "Contact deleted" });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Contacts</h1>
          <p className="text-muted-foreground">Manage opted-in contacts for campaigns</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone (with country code)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="919876543210" required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, mumbai" /></div>
              <div className="flex items-center justify-between">
                <Label>Opted-in for marketing messages</Label>
                <Switch checked={form.optIn} onCheckedChange={(v) => setForm({ ...form, optIn: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Contact
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts" className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoading />
          ) : contacts?.length === 0 ? (
            <EmptyState icon={Users} title="No contacts yet" description="Add a contact manually, or they'll be created automatically when they message you on WhatsApp." />
          ) : (
            <div className="divide-y">
              {contacts?.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-4 group">
                  <div>
                    <p className="text-sm font-medium">{c.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                    {c.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={c.optIn} onCheckedChange={(v) => toggleOptIn.mutate({ id: c._id, optIn: v })} />
                      <span className="text-xs text-muted-foreground">{c.optIn ? "Opted in" : "Opted out"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => remove.mutate(c._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
