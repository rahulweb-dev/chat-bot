"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Send, Calendar, Rocket, Loader2 } from "lucide-react";
import { Stepper } from "./stepper";
import { MobilePreview } from "./mobile-preview";
import { Step1Details } from "./step1-details";
import { Step2Recipients } from "./step2-recipients";
import { Step3Test } from "./step3-test";
import { Step4Schedule } from "./step4-schedule";
import { CampaignDraft, emptyDraft } from "./types";

export function CampaignWizard({ onExit }: { onExit: () => void }) {
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [presetMode, setPresetMode] = useState<"now" | "later">("now");

  const furthestUnlocked = campaignId ? 4 : 1;

  const createDraft = useMutation({
    mutationFn: () => axios.post("/api/whatsapp/campaigns", { name: draft.name, templateName: draft.templateName, templateLanguage: draft.templateLanguage }),
    onSuccess: (res) => setCampaignId(res.data.data._id),
  });

  const saveDraft = useMutation({
    mutationFn: () =>
      axios.patch(`/api/whatsapp/campaigns/${campaignId}`, {
        name: draft.name,
        templateName: draft.templateName,
        templateLanguage: draft.templateLanguage,
        offerTitle: draft.offerTitle,
        offerDescription: draft.offerDescription,
        offerImageUrl: draft.offerImageUrl,
        bannerImageUrl: draft.bannerImageUrl,
        ctaType: draft.ctaType,
        ctaUrl: draft.ctaUrl,
        variables: draft.variables.filter(Boolean),
      }),
  });

  const handleSaveDraft = async (): Promise<boolean> => {
    if (!draft.name.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" });
      return false;
    }
    try {
      if (!campaignId) {
        await createDraft.mutateAsync();
      } else {
        await saveDraft.mutateAsync();
      }
      toast({ title: "Draft saved" });
      return true;
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to save draft";
      toast({ title: msg, variant: "destructive" });
      return false;
    }
  };

  const goToStep = async (step: number) => {
    if (step > 1 && !campaignId) {
      const ok = await handleSaveDraft();
      if (!ok) return;
    } else if (campaignId) {
      await handleSaveDraft();
    }
    setCurrentStep(step);
  };

  const saving = createDraft.isPending || saveDraft.isPending;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onExit}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-lg font-bold leading-tight">Campaigns</h1>
          <p className="text-xs text-muted-foreground leading-tight">Create New Campaign</p>
        </div>
      </div>

      <div className="px-6 py-4 border-b shrink-0">
        <Stepper current={currentStep} furthestUnlocked={furthestUnlocked} onStepClick={goToStep} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[1fr_360px] gap-6 max-w-6xl">
          <div className="space-y-4">
            {currentStep === 1 && <Step1Details draft={draft} onChange={setDraft} />}
            {currentStep === 2 && <Step2Recipients campaignId={campaignId} />}
            {currentStep === 3 && <Step3Test campaignId={campaignId} />}
            {currentStep === 4 && <Step4Schedule key={presetMode} campaignId={campaignId} onLaunched={onExit} initialMode={presetMode} />}

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={currentStep === 1} onClick={() => setCurrentStep((s) => s - 1)}>
                Back
              </Button>
              {currentStep < 4 && (
                <Button onClick={() => goToStep(currentStep + 1)} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Next
                </Button>
              )}
            </div>
          </div>

          <MobilePreview draft={draft} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-white shrink-0">
        <Button variant="outline" size="sm" disabled={saving} onClick={handleSaveDraft}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>
        <Button variant="outline" size="sm" onClick={() => goToStep(3)}>
          <Send className="h-4 w-4 mr-2" />Send Test Message
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setPresetMode("later"); goToStep(4); }}>
          <Calendar className="h-4 w-4 mr-2" />Schedule Campaign
        </Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setPresetMode("now"); goToStep(4); }}>
          <Rocket className="h-4 w-4 mr-2" />Launch Campaign
        </Button>
      </div>
    </div>
  );
}
