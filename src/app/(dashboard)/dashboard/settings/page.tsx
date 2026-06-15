"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Save, Bell, Shield, MessageSquare, Globe, Palette } from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => axios.get("/api/settings").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => axios.patch("/api/settings", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const handleSubmit = (section: string) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      body[`${section}.${key}`] = value;
    });
    setSaving(true);
    await mutation.mutateAsync(body);
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = data || {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your platform configuration</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="general"><Globe className="h-4 w-4 mr-1" />General</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-1" />Chat</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" />Alerts</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1" />Security</TabsTrigger>
          <TabsTrigger value="widget"><Palette className="h-4 w-4 mr-1" />Widget</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Company name, timezone, and language</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit("general")} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" name="companyName" defaultValue={s.general?.companyName || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input id="supportEmail" name="supportEmail" type="email" defaultValue={s.general?.supportEmail || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select name="timezone" defaultValue={s.general?.timezone || "UTC"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select name="language" defaultValue={s.general?.language || "en"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save General Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Chat Settings</CardTitle>
              <CardDescription>Configure chat behavior and assignment</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit("chat")} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Input id="welcomeMessage" name="welcomeMessage" defaultValue={s.chat?.welcomeMessage || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offlineMessage">Offline Message</Label>
                  <Input id="offlineMessage" name="offlineMessage" defaultValue={s.chat?.offlineMessage || ""} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrentChats">Max Concurrent Chats per Agent</Label>
                    <Input id="maxConcurrentChats" name="maxConcurrentChats" type="number" min="1" max="20" defaultValue={s.chat?.maxConcurrentChats || 5} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autoCloseTimeout">Auto-close Inactive (minutes)</Label>
                    <Input id="autoCloseTimeout" name="autoCloseTimeout" type="number" min="0" defaultValue={s.chat?.autoCloseTimeout || 30} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignmentStrategy">Assignment Strategy</Label>
                  <Select name="assignmentStrategy" defaultValue={s.chat?.assignmentStrategy || "ROUND_ROBIN"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="LEAST_BUSY">Least Busy</SelectItem>
                      <SelectItem value="MANUAL">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="autoAssign" name="autoAssign" defaultChecked={s.chat?.autoAssign !== false} />
                  <Label htmlFor="autoAssign">Auto-assign conversations to available agents</Label>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Chat Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Email and in-app notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit("notifications")} className="space-y-4">
                {[
                  { key: "newConversation", label: "New conversation started" },
                  { key: "agentAssigned", label: "Agent assigned to conversation" },
                  { key: "ticketCreated", label: "Ticket created" },
                  { key: "ticketResolved", label: "Ticket resolved" },
                  { key: "leadCreated", label: "Lead created" },
                  { key: "usageAlert", label: "Usage limit alerts" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch id={`${key}_email`} name={`${key}_email`} defaultChecked={s.notifications?.[key]?.email !== false} />
                        <Label htmlFor={`${key}_email`} className="text-sm text-muted-foreground">Email</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id={`${key}_inApp`} name={`${key}_inApp`} defaultChecked={s.notifications?.[key]?.inApp !== false} />
                        <Label htmlFor={`${key}_inApp`} className="text-sm text-muted-foreground">In-app</Label>
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Notification Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Password policies, 2FA, and session management</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit("security")} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
                  <Input id="sessionTimeout" name="sessionTimeout" type="number" min="1" max="168" defaultValue={s.security?.sessionTimeout || 24} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                  <Input id="maxLoginAttempts" name="maxLoginAttempts" type="number" min="3" max="20" defaultValue={s.security?.maxLoginAttempts || 5} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="requireTwoFactor" name="requireTwoFactor" defaultChecked={s.security?.requireTwoFactor === true} />
                  <Label htmlFor="requireTwoFactor">Require Two-Factor Authentication</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ipWhitelistEnabled" name="ipWhitelistEnabled" defaultChecked={s.security?.ipWhitelistEnabled === true} />
                  <Label htmlFor="ipWhitelistEnabled">Enable IP Whitelist</Label>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Security Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget">
          <Card>
            <CardHeader>
              <CardTitle>Widget Appearance</CardTitle>
              <CardDescription>Customize the embedded chat widget</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit("widget")} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandColor">Brand Color</Label>
                    <div className="flex gap-2">
                      <Input id="brandColor" name="brandColor" type="color" className="w-16 h-10 p-1" defaultValue={s.widget?.brandColor || "#6366f1"} />
                      <Input name="brandColorHex" defaultValue={s.widget?.brandColor || "#6366f1"} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Widget Position</Label>
                    <Select name="position" defaultValue={s.widget?.position || "bottom-right"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="launcherText">Launcher Button Text</Label>
                  <Input id="launcherText" name="launcherText" defaultValue={s.widget?.launcherText || "Chat with us"} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="showBranding" name="showBranding" defaultChecked={s.widget?.showBranding !== false} />
                  <Label htmlFor="showBranding">Show &quot;Powered by SupportFlow&quot;</Label>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Widget Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
