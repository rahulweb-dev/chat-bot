"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Key, Copy, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => axios.get("/api/api-keys").then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: (body: { name: string }) => axios.post("/api/api-keys", body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(res.data.data.rawKey);
      setName("");
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to create API key";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleClose = () => {
    setOpen(false);
    setCreatedKey(null);
    setShowKey(false);
  };

  const apiKeys = data || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 ">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Manage API access for integrations and the widget</p>
        </div>
        <Dialog  open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button ><Plus className="h-4 w-4 mr-2 " />Create API Key</Button>
          </DialogTrigger>
          <DialogContent className=" bg-white">
            <DialogHeader>
              <DialogTitle >{createdKey ? "API Key Created" : "Create API Key"}</DialogTitle>
            </DialogHeader>

            {createdKey ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>Copy this key now. You won&apos;t be able to see it again.</p>
                </div>
                <div className="space-y-2">
                  <Label>Your API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      value={showKey ? createdKey : createdKey.replace(/./g, "•")}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdKey)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full " onClick={handleClose}>Done</Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate({ name });
                }}
                className="space-y-4 bg-white"
              >
                <div className="space-y-2 ">
                  <Label>Key Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Widget, Mobile App" required />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" className="bg-red-500 text-white" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={create.isPending} className="text-white bg-black hover:bg-gray-600">
                    {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Generate Key
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active API Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No API keys yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {apiKeys.map((key: {
                _id: string;
                name: string;
                keyPrefix: string;
                isActive: boolean;
                lastUsedAt?: string;
                createdAt: string;
                permissions: string[];
              }) => (
                <div key={key._id} className="flex items-center justify-between p-4 group">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      key.isActive ? "bg-green-100 dark:bg-green-900" : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      <Key className={cn("h-4 w-4", key.isActive ? "text-green-600" : "text-gray-500")} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{key.keyPrefix}••••••••</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={key.isActive ? "active" : "inactive"}>
                      {key.isActive ? "Active" : "Revoked"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {key.lastUsedAt
                        ? `Used ${formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}`
                        : `Created ${formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}`}
                    </span>
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                        onClick={() => revoke.mutate(key._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2">Widget Installation</h3>
          <p className="text-xs text-muted-foreground mb-3">Add this snippet to your website to embed the chat widget:</p>
          <div className="bg-background rounded border p-3 font-mono text-xs overflow-x-auto">
            <span className="text-blue-500">&lt;script</span>
            <span className="text-orange-500"> src</span>
            <span>=</span>
            <span className="text-green-500">&quot;{process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/widget.js&quot;</span>
            <span className="text-blue-500">&gt;&lt;/script&gt;</span>
            <br />
            <span className="text-blue-500">&lt;script&gt;</span>
            <br />
            <span className="pl-4">SupportFlow.init(&#123; apiKey: </span>
            <span className="text-green-500">&apos;YOUR_API_KEY&apos;</span>
            <span> &#125;);</span>
            <br />
            <span className="text-blue-500">&lt;/script&gt;</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
