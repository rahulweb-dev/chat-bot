"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { MessageCircle, FileText, X, Plus, Loader2, ImageIcon, Trash2 } from "lucide-react";
import { uploadToImageKit } from "@/lib/imagekitUpload";
import { CampaignDraft, WATemplate } from "./types";

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setProgress(0);
    try {
      const result = await uploadToImageKit(file, "whatsapp-campaigns", setProgress);
      onChange(result.url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {value ? (
        <div className="relative w-full h-28 rounded-lg border overflow-hidden group">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={() => onChange("")}
            className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : progress !== null ? (
        <div className="w-full h-28 rounded-lg border flex flex-col items-center justify-center gap-2 px-6">
          <Progress value={progress} className="h-1.5 w-full" />
          <p className="text-xs text-muted-foreground">Uploading… {Math.round(progress)}%</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-xs">Click to upload</span>
        </button>
      )}
    </div>
  );
}

function TemplatePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (template: WATemplate) => void;
}) {
  const { data: templates, isLoading } = useQuery<WATemplate[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => axios.get("/api/whatsapp/templates").then((r) => r.data.data),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Select Approved Template</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : templates?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No approved templates found. Create and get a template approved in your Meta Business account first.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {templates?.map((t) => (
              <button
                key={t.name}
                onClick={() => { onSelect(t); onOpenChange(false); }}
                className="w-full text-left p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.name}</p>
                  <span className="text-[10px] text-muted-foreground uppercase">{t.language}</span>
                </div>
                {t.bodyText && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.bodyText}</p>}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Step1Details({ draft, onChange }: { draft: CampaignDraft; onChange: (d: CampaignDraft) => void }) {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const { data: integration } = useQuery<{ displayPhoneNumber?: string; phoneNumberId?: string } | null>({
    queryKey: ["whatsapp-integration"],
    queryFn: () => axios.get("/api/whatsapp/integration").then((r) => r.data.data),
  });

  const set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Diwali Sale Blast" />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border bg-gray-50 text-sm text-gray-700">
                <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Number</Label>
            <Select value={integration?.phoneNumberId || ""} disabled>
              <SelectTrigger>
                <SelectValue placeholder={integration ? integration.displayPhoneNumber : "No WhatsApp number connected"} />
              </SelectTrigger>
              <SelectContent>
                {integration?.phoneNumberId && (
                  <SelectItem value={integration.phoneNumberId}>{integration.displayPhoneNumber}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Approved Template</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="flex-1 justify-start" onClick={() => setTemplateDialogOpen(true)}>
                <FileText className="w-4 h-4 mr-2 text-gray-400" />
                {draft.templateName || "Add Template Message"}
              </Button>
              {draft.templateName && (
                <Button type="button" variant="ghost" size="icon" onClick={() => set("templateName", "")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Offer Title</Label>
            <Input value={draft.offerTitle} onChange={(e) => set("offerTitle", e.target.value)} placeholder="Flat 40% Off — Today Only" />
          </div>

          <div className="space-y-2">
            <Label>Offer Description</Label>
            <Textarea value={draft.offerDescription} onChange={(e) => set("offerDescription", e.target.value)} placeholder="Describe the offer in a line or two…" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ImageUploadField label="Offer Image" value={draft.offerImageUrl} onChange={(url) => set("offerImageUrl", url)} />
            <ImageUploadField label="Campaign Banner" value={draft.bannerImageUrl} onChange={(url) => set("bannerImageUrl", url)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CTA Button</Label>
              <Select value={draft.ctaType} onValueChange={(v) => set("ctaType", v as CampaignDraft["ctaType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No button</SelectItem>
                  <SelectItem value="VISIT_WEBSITE">Visit Website</SelectItem>
                  <SelectItem value="CALL_PHONE">Call Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.ctaType === "VISIT_WEBSITE" && (
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input value={draft.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="https://yourstore.com/sale" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message Variables</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("variables", [...draft.variables, ""])}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />Add Dynamic Variable
              </Button>
            </div>
            {draft.variables.length === 0 ? (
              <p className="text-xs text-muted-foreground">No variables added. These fill {"{{1}}, {{2}}…"} placeholders in your template body, in order.</p>
            ) : (
              <div className="space-y-2">
                {draft.variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">{`{{${i + 1}}}`}</span>
                    <Input
                      value={v}
                      onChange={(e) => set("variables", draft.variables.map((x, idx) => (idx === i ? e.target.value : x)))}
                      placeholder={`Variable ${i + 1} value`}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("variables", draft.variables.filter((_, idx) => idx !== i))}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TemplatePickerDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSelect={(t) => onChange({ ...draft, templateName: t.name, templateLanguage: t.language })}
      />
    </div>
  );
}
