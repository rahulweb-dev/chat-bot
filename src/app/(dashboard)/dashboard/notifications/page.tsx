"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, CheckCheck, MessageSquare, Ticket, Users, AlertTriangle, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const typeIcon: Record<string, React.ReactNode> = {
  NEW_CONVERSATION: <MessageSquare className="h-4 w-4 text-blue-500" />,
  CONVERSATION_ASSIGNED: <Users className="h-4 w-4 text-green-500" />,
  TICKET_CREATED: <Ticket className="h-4 w-4 text-purple-500" />,
  TICKET_UPDATED: <Ticket className="h-4 w-4 text-orange-500" />,
  LEAD_ASSIGNED: <Star className="h-4 w-4 text-yellow-500" />,
  USAGE_ALERT: <AlertTriangle className="h-4 w-4 text-red-500" />,
  SYSTEM: <Bell className="h-4 w-4 text-gray-500" />,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-all"],
    queryFn: () => axios.get("/api/notifications?limit=50").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => axios.patch("/api/notifications", { markAllRead: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications-all"] }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => axios.patch("/api/notifications", { notificationId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications-all"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Your activity feed</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: {
                _id: string;
                type: string;
                title: string;
                message: string;
                isRead: boolean;
                createdAt: string;
              }) => (
                <div
                  key={n._id}
                  className={cn(
                    "flex items-start gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                    !n.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                  onClick={() => !n.isRead && markRead.mutate(n._id)}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {typeIcon[n.type] || <Bell className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-medium", !n.isRead && "text-foreground")}>{n.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
