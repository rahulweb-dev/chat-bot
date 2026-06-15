"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Globe, Mail, Shield, Bell } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">Global configuration for the SupportFlow platform</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">General</CardTitle>
          </div>
          <CardDescription>Platform name and domain settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform Name</Label>
              <Input defaultValue="SupportFlow" />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input defaultValue="support@supportflow.app" type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Platform URL</Label>
            <Input defaultValue={process.env.NEXT_PUBLIC_APP_URL || "https://app.supportflow.io"} />
          </div>
          <Button size="sm"><Save className="h-4 w-4 mr-2" />Save General</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Email</CardTitle>
          </div>
          <CardDescription>SMTP configuration for outbound email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input defaultValue="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input type="number" defaultValue={587} />
            </div>
            <div className="space-y-2">
              <Label>SMTP User</Label>
              <Input type="email" placeholder="your@gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
          </div>
          <Button size="sm"><Save className="h-4 w-4 mr-2" />Save Email Config</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Security</CardTitle>
          </div>
          <CardDescription>Platform-wide security policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enforce 2FA for all admins</p>
              <p className="text-xs text-muted-foreground">Require two-factor auth for COMPANY_ADMIN and above</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Allow self-registration</p>
              <p className="text-xs text-muted-foreground">Let companies sign up without admin invitation</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable audit logging</p>
              <p className="text-xs text-muted-foreground">Track all actions across all companies</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
          <CardDescription>Platform alert thresholds and admin notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Usage Alert Threshold 1 (%)</Label>
              <Input type="number" defaultValue={75} min={50} max={99} />
            </div>
            <div className="space-y-2">
              <Label>Usage Alert Threshold 2 (%)</Label>
              <Input type="number" defaultValue={90} min={50} max={99} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Send usage alerts via email</p>
              <p className="text-xs text-muted-foreground">Notify company admins at thresholds</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Button size="sm"><Save className="h-4 w-4 mr-2" />Save Notifications</Button>
        </CardContent>
      </Card>
    </div>
  );
}
