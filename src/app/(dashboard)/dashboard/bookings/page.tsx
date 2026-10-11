"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck, Phone, Check, X, UserX, TrendingUp, Settings2 } from "lucide-react";

interface Booking {
  _id: string;
  label: string;
  name: string;
  phone?: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  conversationId?: string;
  attribution?: { channel?: string };
}

const STATUS: Record<Booking["status"], { label: string; cls: string }> = {
  BOOKED:    { label: "Booked",    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  COMPLETED: { label: "Done",      cls: "bg-green-50 text-green-700 border-green-200" },
  NO_SHOW:   { label: "No-show",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export default function BookingsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", view],
    queryFn: async () => {
      const r = await fetch(`/api/bookings?view=${view}`);
      const d = await r.json();
      return (d.data || []) as Booking[];
    },
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Booking["status"] }) => {
      const r = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || "Couldn't update the booking");
    },
    onSuccess: (_, v) => {
      toast({ title: v.status === "CANCELLED" ? "Booking cancelled. The slot is free again." : "Booking updated" });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: unknown) => toast({ title: e instanceof Error ? e.message : "Couldn't update", variant: "destructive" }),
  });

  const groups = new Map<string, Booking[]>();
  for (const b of data ?? []) {
    const k = dayKey(b.startAt);
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const upcomingCount = (data ?? []).filter((b) => b.status === "BOOKED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck className="w-6 h-6 text-indigo-600" /> Bookings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Appointments and site visits booked by visitors in the chat.
            {view === "upcoming" && !isLoading && ` ${upcomingCount} coming up.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {(["upcoming", "past"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${view === v ? "bg-white shadow font-medium" : "text-gray-500"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/chatbot?tab=bookings"><Settings2 className="w-4 h-4 mr-1.5" /> Booking settings</Link>
          </Button>
        </div>
      </div>

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}

      {!isLoading && !data?.length && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <CalendarCheck className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="font-medium text-gray-700">{view === "upcoming" ? "No upcoming bookings" : "No past bookings"}</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Turn on booking in your chatbot and visitors can pick a free slot right in the chat. Each booking also becomes a lead
              and pings you on WhatsApp.
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700"><Link href="/dashboard/chatbot?tab=bookings">Set up booking</Link></Button>
          </CardContent>
        </Card>
      )}

      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{day}</h2>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0 divide-y">
              {items.map((b) => {
                const st = STATUS[b.status];
                const time = new Date(b.startAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={b._id} className="flex items-center gap-4 p-4 flex-wrap">
                    <div className="w-20 shrink-0">
                      <p className="text-base font-semibold tabular-nums text-gray-900">{time}</p>
                      <p className="text-xs text-gray-400 capitalize">{b.label}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${b.status === "CANCELLED" ? "line-through text-gray-400" : "text-gray-900"}`}>{b.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                        {b.phone && <a href={`tel:${b.phone}`} className="flex items-center gap-1 hover:text-indigo-600"><Phone className="w-3 h-3" />{b.phone}</a>}
                        {b.attribution?.channel && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{b.attribution.channel}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                    {b.status === "BOOKED" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: b._id, status: "COMPLETED" })}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Done
                        </Button>
                        <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: b._id, status: "NO_SHOW" })} title="Visitor didn't come">
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: b._id, status: "CANCELLED" })} title="Cancel and free the slot">
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
