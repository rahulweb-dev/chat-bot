"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plug, Unplug, CheckCircle2, XCircle, Copy, Check, HelpCircle, ExternalLink, AlertTriangle, Send } from "lucide-react";

interface IntegrationStatus {
  _id: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: "SUCCESS" | "FAILURE";
  lastTestError?: string;
  maskedAccessToken: string;
  webhookCallbackUrl: string;
}

export function SettingsTab() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const isAdmin = ["COMPANY_ADMIN", "MANAGER"].includes(session?.user?.role || "");

  const [businessAccountId, setBusinessAccountId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [loadedIntegrationId, setLoadedIntegrationId] = useState<string | null>(null);

  const { data: integration, isLoading } = useQuery<IntegrationStatus | null>({
    queryKey: ["whatsapp-integration"],
    queryFn: () => axios.get("/api/whatsapp/integration").then((r) => r.data.data),
  });

  // Adjust form state when newly-loaded integration data arrives (React-recommended
  // pattern: compare during render rather than syncing via a useEffect).
  if (integration && integration._id !== loadedIntegrationId) {
    setLoadedIntegrationId(integration._id);
    setBusinessAccountId(integration.businessAccountId);
    setPhoneNumberId(integration.phoneNumberId);
  }

  const connect = useMutation({
    mutationFn: () =>
      axios.post("/api/whatsapp/integration", { businessAccountId, phoneNumberId, accessToken, webhookVerifyToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      toast({ title: "WhatsApp connected" });
      setAccessToken("");
      setWebhookVerifyToken("");
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to connect";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => axios.delete("/api/whatsapp/integration"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      toast({ title: "WhatsApp disconnected" });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => axios.post("/api/whatsapp/integration/test"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      toast({ title: `Connected to ${res.data.data.displayPhoneNumber || "WhatsApp"}` });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Test failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 1500);
  };

  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("");
  const [testLang, setTestLang] = useState("en");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: approvedTemplates } = useQuery<{ name: string; language: string }[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => axios.get("/api/whatsapp/templates").then((r) => r.data.data),
    enabled: !!integration,
  });

  const sendTest = useMutation({
    mutationFn: () => axios.post("/api/whatsapp/send-test", { to: testPhone, templateName: testTemplate, templateLanguage: testLang }),
    onSuccess: () => setTestResult({ ok: true, message: "Message sent! Check your WhatsApp." }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Send failed";
      setTestResult({ ok: false, message: msg });
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-muted-foreground">Only Company Admins and Managers can manage the WhatsApp connection.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Business Settings</h1>
        <p className="text-muted-foreground">Connect your WhatsApp Business Cloud API account</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {integration && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant={integration.enabled ? "active" : "inactive"}>
                    {integration.enabled ? "Connected" : "Disabled"}
                  </Badge>
                  {integration.displayPhoneNumber && <span className="text-sm text-muted-foreground">{integration.displayPhoneNumber}</span>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
                    {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Test Connection
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    <Unplug className="h-4 w-4 mr-2" />Disconnect
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {integration.lastTestedAt && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {integration.lastTestStatus === "SUCCESS" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>
                        Last test: {integration.lastTestStatus === "SUCCESS" ? "Success" : `Failed — ${integration.lastTestError}`}
                        {" "}({new Date(integration.lastTestedAt).toLocaleString()})
                      </span>
                    </div>
                    {integration.lastTestStatus === "FAILURE" && integration.lastTestError?.toLowerCase().includes("token") && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800 space-y-1">
                          <p className="font-medium">Access token expired</p>
                          <p>The temporary token from Meta&apos;s API Setup page expires every 24 hours. Generate a permanent token via <strong>Meta Business Manager → System Users</strong> and update the credentials below.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Webhook Callback URL (paste into Meta App webhook config)</Label>
                  <div className="flex gap-2">
                    <Input value={integration.webhookCallbackUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copy(integration.webhookCallbackUrl)}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!integration && (
            <Card className="bg-indigo-50/50 border-indigo-100">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-sm">
                    <p className="font-medium text-indigo-900">Before you connect</p>
                    <ol className="list-decimal list-inside text-indigo-800/80 space-y-1 text-xs">
                      <li>Create a Meta App with the WhatsApp product added</li>
                      <li>Copy your Business Account ID and Phone Number ID from API Setup</li>
                      <li>Generate a permanent access token via a System User</li>
                      <li>Connect below, then paste the generated webhook URL into your Meta App&apos;s webhook config</li>
                    </ol>
                    <a
                      href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline pt-1"
                    >
                      Meta&apos;s Cloud API setup guide <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {integration && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Send Test Message</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Recipient Phone (with country code)</Label>
                    <Input
                      value={testPhone}
                      onChange={(e) => { setTestPhone(e.target.value); setTestResult(null); }}
                      placeholder="919876543210"
                    />
                    <p className="text-xs text-muted-foreground">In test mode, this number must be whitelisted in Meta Developer Console → WhatsApp → API Setup.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Template</Label>
                    {approvedTemplates?.length ? (
                      <Select value={testTemplate} onValueChange={(v) => { setTestTemplate(v); setTestResult(null); const t = approvedTemplates.find((x) => x.name === v); if (t) setTestLang(t.language); }}>
                        <SelectTrigger><SelectValue placeholder="Select an approved template" /></SelectTrigger>
                        <SelectContent>
                          {approvedTemplates.map((t) => (
                            <SelectItem key={t.name} value={t.name}>{t.name} <span className="text-muted-foreground ml-1 text-xs">({t.language})</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">No approved templates yet — create one in the Templates tab and wait for Meta approval.</p>
                    )}
                  </div>
                  {testResult && (
                    <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                  <Button
                    onClick={() => { setTestResult(null); sendTest.mutate(); }}
                    disabled={!testPhone || !testTemplate || sendTest.isPending}
                    className="w-full"
                  >
                    {sendTest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Test Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{integration ? "Update Credentials" : "Connect WhatsApp"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  connect.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Business Account ID</Label>
                  <Input value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Found in Meta Business Settings → Accounts → WhatsApp Accounts.</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Found in your Meta App → WhatsApp → API Setup, under &quot;From&quot;.</p>
                </div>
                <div className="space-y-2">
                  <Label>Permanent Access Token</Label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={integration ? `Currently ${integration.maskedAccessToken} — leave blank to keep` : ""}
                    required={!integration}
                  />
                  <p className="text-xs text-muted-foreground">Generate a permanent token via System Users in Business Settings (temporary tokens expire in 24h).</p>
                </div>
                <div className="space-y-2">
                  <Label>Webhook Verify Token</Label>
                  <Input
                    value={webhookVerifyToken}
                    onChange={(e) => setWebhookVerifyToken(e.target.value)}
                    placeholder="A secret string you also enter in the Meta App webhook config"
                    required={!integration}
                  />
                  <p className="text-xs text-muted-foreground">Any string you choose — re-enter the same value in the Meta App webhook setup screen.</p>
                </div>
                <Button type="submit" disabled={connect.isPending} className="w-full">
                  {connect.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                  {integration ? "Update Connection" : "Connect"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
