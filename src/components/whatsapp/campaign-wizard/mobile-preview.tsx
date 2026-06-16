"use client";

import { MessageCircle, ImageIcon } from "lucide-react";
import { CampaignDraft } from "./types";

export function MobilePreview({ draft, businessName }: { draft: CampaignDraft; businessName?: string }) {
  const hasContent = draft.offerTitle || draft.offerDescription || draft.offerImageUrl || draft.bannerImageUrl;

  return (
    <div className="sticky top-0">
      <p className="text-sm font-semibold text-gray-700 mb-3">Live Preview</p>
      <div className="mx-auto w-[260px] rounded-[28px] border-[6px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
        <div className="bg-white rounded-[22px] overflow-hidden">
          {/* Status bar */}
          <div className="h-6 bg-[#075E54]" />
          {/* Chat header */}
          <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{businessName || "Your Business"}</p>
              <p className="text-[10px] text-white/70">online</p>
            </div>
          </div>

          {/* Chat body */}
          <div className="bg-[#E5DDD5] min-h-[360px] p-2.5">
            {!hasContent ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-2 text-gray-400">
                <ImageIcon className="w-8 h-8" />
                <p className="text-[11px] text-center px-6">Fill in offer details to see a live preview here</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[210px]">
                {draft.bannerImageUrl ? (
                  <img src={draft.bannerImageUrl} alt="banner" className="w-full h-28 object-cover" />
                ) : draft.offerImageUrl ? (
                  <img src={draft.offerImageUrl} alt="offer" className="w-full h-28 object-cover" />
                ) : null}
                <div className="p-2.5 space-y-1">
                  {draft.offerTitle && <p className="text-[12px] font-semibold text-gray-900">{draft.offerTitle}</p>}
                  {draft.offerDescription && <p className="text-[11px] text-gray-600 leading-snug">{draft.offerDescription}</p>}
                  {draft.variables.length > 0 && (
                    <p className="text-[10px] text-gray-400 italic">
                      Vars: {draft.variables.filter(Boolean).join(", ") || "—"}
                    </p>
                  )}
                  {draft.ctaType !== "NONE" && (
                    <button className="w-full mt-1.5 text-[11px] font-medium text-blue-600 border border-blue-200 rounded-md py-1.5 bg-blue-50">
                      {draft.ctaType === "VISIT_WEBSITE" ? "Visit Website" : "Call Now"}
                    </button>
                  )}
                  <p className="text-[9px] text-gray-400 text-right pt-1">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer message bar */}
          <div className="bg-[#F0F0F0] px-2.5 py-2 flex items-center gap-2 border-t">
            <div className="flex-1 h-7 rounded-full bg-white border text-[10px] text-gray-400 flex items-center px-3">
              Message
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
