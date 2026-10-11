"use client";
import { useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { BellRing, Loader2, Smartphone } from "lucide-react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const noop = () => () => {};
const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

// "Get notifications on this device" for team members: new chats assigned to
// them, visitors asking for a person, leads, bookings and WhatsApp messages.
export function PushCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const canPush = useSyncExternalStore(noop, supported, () => false);
  const iosNeedsInstall = useSyncExternalStore(noop, () => isIos() && !isStandalone(), () => false);

  const { data } = useQuery({
    queryKey: ["push-status"],
    queryFn: async () => (await (await fetch("/api/push")).json()).data as { available: boolean; publicKey: string | null; devices: number },
  });

  async function enable() {
    if (!data?.publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ title: "Notifications are blocked", description: "Allow notifications for this site in your browser settings, then try again.", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) }));
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), test: true }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Notifications are on for this device", description: "We sent a test notification." });
      qc.invalidateQueries({ queryKey: ["push-status"] });
    } catch {
      toast({ title: "Couldn't turn on notifications", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><BellRing className="w-4 h-4 text-indigo-500" /> Notifications on your phone</CardTitle>
        <CardDescription>
          Get new chats, visitors asking for a person, leads, bookings and WhatsApp messages as phone notifications, even with the
          dashboard closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!data?.available ? (
          <p className="text-amber-700 bg-amber-50 rounded-md px-3 py-2 text-xs">Push notifications aren&apos;t set up on this server yet (VAPID keys).</p>
        ) : iosNeedsInstall ? (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2">
            <Smartphone className="w-3.5 h-3.5 inline mr-1" />
            On iPhone, first add this app to your Home Screen (Share → Add to Home Screen), open it from there, then tap the button here.
          </p>
        ) : !canPush ? (
          <p className="text-xs text-gray-500">This browser doesn&apos;t support push notifications. Try Chrome, Edge or Safari.</p>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={enable} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellRing className="w-4 h-4 mr-2" />}
              Turn on for this device
            </Button>
            {!!data.devices && <span className="text-xs text-gray-500">On for {data.devices} device{data.devices === 1 ? "" : "s"}</span>}
          </div>
        )}
        <p className="text-xs text-gray-400">
          Tip: install the dashboard as an app. On Android Chrome, open the menu → <b>Install app</b>. It opens straight into Live Chat.
        </p>
      </CardContent>
    </Card>
  );
}
