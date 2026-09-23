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
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { MessageCircle, FileText, X, Plus, Loader2, ImageIcon, Trash2, AlertTriangle, CheckCheck, ArrowRight } from "lucide-react";
import { uploadToImageKit } from "@/lib/imagekitUpload";
import { CampaignDraft, WATemplate } from "./types";
import { cn } from "@/lib/utils";

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

// WhatsApp-native template picker: every template previews as an actual chat
// bubble on the WhatsApp wallpaper, so the admin sees exactly what the
// customer will receive rather than reading a plain list. Selecting a bubble
// only highlights it — the pick isn't committed until "Use this template" is
// pressed, so a stray tap while scrolling can't silently swap the template.
function TemplatePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (template: WATemplate) => void;
}) {
  const { data: templates, isLoading, isError, error, refetch } = useQuery<WATemplate[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => axios.get("/api/whatsapp/templates").then((r) => r.data.data),
    enabled: open,
  });
  const [selected, setSelected] = useState<WATemplate | null>(null);
  // Reset the highlighted-but-not-yet-confirmed selection each time the
  // dialog opens — adjusted during render (React's documented pattern for
  // resetting state on a prop change) rather than in an effect, which this
  // project's lint config flags as a cascading-render risk.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(null);
  }

  const errorMessage = axios.isAxiosError(error) ? error.response?.data?.error : undefined;

  const confirm = () => {
    if (!selected) return;
    onSelect(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[85vh] sm:max-w-[560px] [&>button]:hidden">
        {/* Header */}
        <div className="bg-[#075E54] px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[17px] font-semibold leading-tight">Choose a WhatsApp template</p>
              <p className="text-white/70 text-xs mt-0.5">Approved by Meta · previewed as real messages</p>
            </div>
          </div>
          <DialogClose asChild>
            <button type="button" aria-label="Close" className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </DialogClose>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto min-h-[220px] px-6 py-5"
          style={{ background: "#ECE5DD" }}
        >
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="flex flex-col items-center text-center py-8 px-4 gap-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <p className="text-sm font-medium text-gray-700">Couldn&apos;t load templates</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {errorMessage || "Something went wrong talking to WhatsApp. Check your integration in Settings and try again."}
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-2 bg-white" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : !templates?.length ? (
            <p className="text-sm text-gray-600 py-4 text-center">
              No approved templates found. Create and get a template approved in your Meta Business account first.
            </p>
          ) : (
            <div className="space-y-4">
              {templates.map((t) => {
                const isSelected = selected?.name === t.name;
                return (
                  <div key={t.name} className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1.5 self-start">
                      <span className="text-[11px] font-bold text-[#075E54] bg-white rounded px-1.5 py-0.5 font-mono">{t.name}</span>
                      <span className="text-[10px] text-gray-500 font-medium uppercase">{t.category}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(t)}
                      className={cn(
                        "max-w-[78%] text-left bg-white rounded-tl-[10px] rounded-tr-[10px] rounded-bl-[10px] rounded-br-[2px] px-3.5 py-2.5 border-2 transition-shadow",
                        isSelected ? "border-[#25D366] shadow-[0_2px_10px_rgba(37,211,102,0.25)]" : "border-transparent shadow-sm hover:shadow-md"
                      )}
                    >
                      <p className="text-[13.5px] text-[#111b21] leading-relaxed">{t.bodyText || "(no preview text)"}</p>
                      <div className="flex items-center justify-end gap-1 mt-1.5">
                        <span className="text-[10.5px] text-[#8696a0]">10:24 AM</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 flex items-center justify-between shrink-0 border-t">
          <span className="text-xs text-muted-foreground">{selected ? `Selected: ${selected.name}` : "Tap a message to select it"}</span>
          <Button
            type="button"
            disabled={!selected}
            onClick={confirm}
            className="rounded-full bg-[#25D366] hover:bg-[#20BD5C] text-white gap-1.5 disabled:opacity-40"
          >
            Use this template
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
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
