"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { User, Mail, Lock, Shield, Building2, Clock, Loader2, Camera } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  timezone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Company Admin",
  MANAGER: "Manager",
  TEAM_LEADER: "Team Leader",
  AGENT: "Agent",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "destructive",
  COMPANY_ADMIN: "default",
  MANAGER: "info",
  TEAM_LEADER: "info",
  AGENT: "success",
  VIEWER: "warning",
};

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const qc = useQueryClient();
  const [avatarLoading, setAvatarLoading] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/agents/me");
      const d = await res.json();
      return d.data;
    },
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profileData?.name || session?.user?.name || "",
      timezone: profileData?.timezone || "Asia/Kolkata",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({ title: "Profile updated successfully" });
        await update({ name: data.data?.name });
        qc.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast({ title: data.error || "Update failed", variant: "destructive" });
      }
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      const res = await fetch("/api/agents/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Password changed successfully" });
        passwordForm.reset();
      } else {
        toast({ title: data.error || "Password change failed", variant: "destructive" });
      }
    },
  });

  const user = session?.user;
  const role = user?.role || "AGENT";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Avatar + basic info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback className="bg-indigo-600 text-white text-2xl">
                  {getInitials(user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-0 right-0 w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-700 transition-colors"
                onClick={() => toast({ title: "Avatar upload coming soon" })}
                disabled={avatarLoading}
              >
                {avatarLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{user?.name}</h2>
              <p className="text-gray-500 text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={(ROLE_COLORS[role] as "default") || "default"}>
                  <Shield className="w-3 h-3 mr-1" />
                  {ROLE_LABELS[role] || role}
                </Badge>
                {profileData?.isOnline && (
                  <Badge variant="success" className="text-[10px]">Online</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  {...profileForm.register("name")}
                  placeholder="Your full name"
                />
                {profileForm.formState.errors.name && (
                  <p className="text-xs text-red-500">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={user?.email || ""} className="pl-9 bg-gray-50" disabled />
                </div>
                <p className="text-xs text-gray-400">Email cannot be changed</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="timezone"
                    {...profileForm.register("timezone")}
                    placeholder="Asia/Kolkata"
                    className="pl-9"
                  />
                </div>
              </div>
              {user?.companyId && (
                <div className="space-y-1.5">
                  <Label>Company ID</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input value={user.companyId} className="pl-9 bg-gray-50 font-mono text-xs" disabled />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={profileMutation.isPending}
              >
                {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-500" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                {...passwordForm.register("currentPassword")}
                type="password"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-red-500">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  {...passwordForm.register("newPassword")}
                  type="password"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-red-500">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  {...passwordForm.register("confirmPassword")}
                  type="password"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
