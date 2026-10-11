"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { INDUSTRY_TEMPLATES, type IndustryTemplate } from "@/lib/industry-templates";
import { Check, LayoutTemplate } from "lucide-react";

export function TemplatesTab({ onApplied }: { onApplied: () => void }) {
  const [confirm, setConfirm] = useState<IndustryTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  async function apply(t: IndustryTemplate) {
    setApplying(true);
    try {
      const r = await fetch("/api/chatbot-config/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: t.key }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't apply the template");
      toast({ title: `${t.name} setup applied`, description: "Now replace the [bracketed] placeholders with your own details." });
      onApplied();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Couldn't apply the template", variant: "destructive" });
    } finally {
      setApplying(false);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
        Start from a ready-made setup for your industry: greeting, menu, booking, proactive messages and starter FAQs. Everything stays
        editable. Replace anything in [square brackets] with your own details.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INDUSTRY_TEMPLATES.map((t) => (
          <Card key={t.key} className="flex flex-col">
            <CardContent className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" aria-hidden>{t.emoji}</span>
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
              </div>
              <p className="text-sm text-gray-500">{t.description}</p>
              <ul className="text-xs text-gray-600 space-y-1 flex-1">
                {t.customFlow.flows.map((f) => (
                  <li key={f.key} className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500 shrink-0" />{f.label}</li>
                ))}
                {t.booking.enabled && (
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500 shrink-0" />Booking: {t.booking.label}, {t.booking.slotMinutes} min</li>
                )}
              </ul>
              <Button variant="outline" size="sm" onClick={() => setConfirm(t)} disabled={applying}>
                <LayoutTemplate className="w-4 h-4 mr-1.5" /> Use this setup
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use the {confirm?.name} setup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current menu flow, booking settings, proactive messages and welcome message. Your FAQs, training,
              knowledge base and business hours are kept; the template&apos;s FAQs are added to them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={applying} onClick={(e) => { e.preventDefault(); if (confirm) apply(confirm); }}>
              {applying ? "Applying…" : "Replace and apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
