"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Save, Send, Calendar, Rocket, Loader2, Upload, Download,
  CheckCircle2, XCircle, AlertCircle, Users, Eye,
} from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";

interface Draft {
  name: string;
  subject: string;
  fromName: string;
  html: string;
}
const emptyDraft: Draft = { name: "", subject: "", fromName: "", html: "" };

interface ImportStats { total: number; validCount: number; invalidCount: number; createdCount: number; updatedCount: number }
interface CampaignSummary {
  campaign: { name: string; subject?: string; html?: string; audienceContactIds: string[]; status: string };
  recipients: { _id: string }[];
}

const STEPS = ["Details", "Recipients", "Schedule"] as const;

export function EmailCampaignWizard({ onExit }: { onExit: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importing, setImporting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [launchError, setLaunchError] = useState<string | null>(null);

  const createDraft = useMutation({
    mutationFn: () => axios.post("/api/email-campaigns", draft),
    onSuccess: (res) => setCampaignId(res.data.data._id),
  });
  const saveDraft = useMutation({
    mutationFn: () => axios.patch(`/api/email-campaigns/${campaignId}`, draft),
  });

  const handleSaveDraft = async (): Promise<boolean> => {
    if (!draft.name.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" });
      return false;
    }
    try {
      if (!campaignId) await createDraft.mutateAsync();
      else await saveDraft.mutateAsync();
      return true;
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to save draft";
      toast({ title: msg, variant: "destructive" });
      return false;
    }
  };

  const goToStep = async (next: number) => {
    const ok = await handleSaveDraft();
    if (!ok) return;
    setStep(next);
  };

  const { data: summary } = useQuery<CampaignSummary>({
    queryKey: ["email-campaign-summary", campaignId],
    queryFn: () => axios.get(`/api/email-campaigns/${campaignId}`).then((r) => r.data.data),
    enabled: !!campaignId && step >= 1,
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;
    setImporting(true);
    setImportStats(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("campaignId", campaignId);
      const res = await axios.post("/api/email-contacts/import", fd);
      setImportStats(res.data.data);
      qc.invalidateQueries({ queryKey: ["email-campaign-summary", campaignId] });
      toast({ title: `Imported ${res.data.data.validCount} contacts` });
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Import failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const sendTest = useMutation({
    mutationFn: () => axios.post(`/api/email-campaigns/${campaignId}/test`, { email: testEmail }),
    onSuccess: () => toast({ title: "Test email sent" }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Test send failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const schedule = useMutation({
    mutationFn: () => axios.patch(`/api/email-campaigns/${campaignId}`, { action: "schedule", scheduledAt }),
    onSuccess: () => { toast({ title: "Campaign scheduled" }); onExit(); },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to schedule";
      toast({ title: msg, variant: "destructive" });
    },
  });
  const launch = useMutation({
    mutationFn: () => axios.patch(`/api/email-campaigns/${campaignId}`, { action: "launch" }),
    onSuccess: () => { toast({ title: "Campaign launched" }); onExit(); },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to launch";
      setLaunchError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  const hasContent = !!draft.subject && !!draft.html;
  const hasAudience = (summary?.campaign.audienceContactIds?.length ?? 0) > 0 || (summary?.recipients?.length ?? 0) > 0;
  const canLaunch = hasContent && hasAudience;
  const saving = createDraft.isPending || saveDraft.isPending;

  return (
    <div className="h-full flex flex-col">
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />

      <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onExit}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-lg font-bold leading-tight">Email Campaigns</h1>
          <p className="text-xs text-muted-foreground leading-tight">Create New Campaign</p>
        </div>
      </div>

      <div className="flex items-center gap-1 px-6 py-3 border-b shrink-0">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => (i === 0 || campaignId) && goToStep(i)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              step === i ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[1fr_360px] gap-6 max-w-6xl">
          <div className="space-y-4">
            {step === 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name (internal)</Label>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="March newsletter" />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Your March updates are here" />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input value={draft.fromName} onChange={(e) => setDraft({ ...draft, fromName: e.target.value })} placeholder="Your Company" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Content (HTML)</Label>
                    <textarea
                      value={draft.html}
                      onChange={(e) => setDraft({ ...draft, html: e.target.value })}
                      rows={12}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder={`<h1>Hi {{name}}</h1>\n<p>Your content here…</p>`}
                    />
                    <p className="text-xs text-muted-foreground">Use <code className="font-mono">{"{{name}}"}</code> and <code className="font-mono">{"{{email}}"}</code> — an unsubscribe link is added automatically.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              !campaignId ? (
                <p className="text-sm text-muted-foreground">Save the campaign details first to add recipients.</p>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div className="rounded-xl border-2 border-dashed p-8 text-center">
                        {importing ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            <p className="text-sm text-muted-foreground">Importing…</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-8 h-8 text-gray-400" />
                            <p className="text-sm font-medium text-gray-700">Upload a CSV or Excel file of recipients</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                                <Upload className="w-3.5 h-3.5 mr-1.5" />Choose File
                              </Button>
                              <Button type="button" variant="outline" size="sm" asChild>
                                <a href="/api/email-contacts/sample" download><Download className="w-3.5 h-3.5 mr-1.5" />Sample CSV</a>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {importStats && (
                    <div className="grid grid-cols-3 gap-3">
                      <Card><CardContent className="p-3">
                        <p className="text-[11px] text-muted-foreground">Total Rows</p><p className="text-lg font-bold">{importStats.total}</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3">
                        <p className="text-[11px] text-muted-foreground">Valid Emails</p><p className="text-lg font-bold text-green-700">{importStats.validCount}</p>
                      </CardContent></Card>
                      <Card><CardContent className="p-3">
                        <p className="text-[11px] text-muted-foreground">Invalid</p><p className="text-lg font-bold text-red-700">{importStats.invalidCount}</p>
                      </CardContent></Card>
                    </div>
                  )}

                  <Card>
                    <CardContent className="p-0">
                      {!summary?.recipients?.length ? (
                        <EmptyState icon={Users} title="No recipients yet" description="Upload a CSV or Excel file above to add recipients to this campaign." />
                      ) : (
                        <div className="p-4 text-sm text-gray-700">
                          {summary.recipients.length} recipient(s) added to this campaign.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            {step === 2 && (
              !campaignId ? (
                <p className="text-sm text-muted-foreground">Save the campaign details first to schedule or launch.</p>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Pre-launch Checklist</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        {hasContent ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className={hasContent ? "text-gray-700" : "text-red-600 font-medium"}>
                          {hasContent ? "Subject and content are set" : "Add a subject and content in Step 1"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {hasAudience ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className={hasAudience ? "text-gray-700" : "text-red-600 font-medium"}>
                          {hasAudience ? `Audience ready: ${summary?.recipients?.length ?? 0} recipient(s)` : "No recipients added — go back to Step 2"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Send a Test Email</CardTitle></CardHeader>
                    <CardContent className="flex gap-2">
                      <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" type="email" />
                      <Button variant="outline" disabled={!testEmail || !hasContent || sendTest.isPending} onClick={() => sendTest.mutate()}>
                        {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Test"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Schedule or Launch</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Button type="button" variant={mode === "now" ? "default" : "outline"} size="sm" onClick={() => setMode("now")}>
                          <Rocket className="h-3.5 w-3.5 mr-1.5" />Send Now
                        </Button>
                        <Button type="button" variant={mode === "later" ? "default" : "outline"} size="sm" onClick={() => setMode("later")}>
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />Schedule for Later
                        </Button>
                      </div>

                      {mode === "later" && (
                        <div className="space-y-2 max-w-sm">
                          <Label>Scheduled Date & Time</Label>
                          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                        </div>
                      )}

                      {launchError && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700">{launchError}</p>
                        </div>
                      )}

                      {!canLaunch && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-700">Fix the checklist issues above before launching.</p>
                        </div>
                      )}

                      {mode === "now" ? (
                        <Button disabled={!canLaunch || launch.isPending} onClick={() => { setLaunchError(null); launch.mutate(); }}>
                          {launch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                          Launch Campaign
                        </Button>
                      ) : (
                        <Button disabled={!scheduledAt || !canLaunch || schedule.isPending} onClick={() => schedule.mutate()}>
                          {schedule.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                          Schedule Campaign
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
              {step < 2 && (
                <Button onClick={() => goToStep(step + 1)} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Next
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-3.5 w-3.5" />Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div className="border-b bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <p className="font-medium truncate">{draft.subject || "(no subject)"}</p>
                    <p className="truncate">{draft.fromName || "Your Company"}</p>
                  </div>
                  <div className="p-3 text-xs max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{ __html: draft.html || "<p style='color:#9ca3af'>Content preview appears here…</p>" }} />
                </div>
              </CardContent>
            </Card>
            {summary?.recipients && (
              <Badge variant="outline" className="w-full justify-center py-1.5">
                <Users className="h-3 w-3 mr-1.5" />{summary.recipients.length} recipient(s)
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-white shrink-0">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSaveDraft}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>
      </div>
    </div>
  );
}
