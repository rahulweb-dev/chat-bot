export interface CampaignDraft {
  _id?: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  offerTitle: string;
  offerDescription: string;
  offerImageUrl: string;
  bannerImageUrl: string;
  ctaType: "VISIT_WEBSITE" | "CALL_PHONE" | "NONE";
  ctaUrl: string;
  variables: string[];
  audienceTags: string[];
}

export const emptyDraft: CampaignDraft = {
  name: "",
  templateName: "",
  templateLanguage: "en_US",
  offerTitle: "",
  offerDescription: "",
  offerImageUrl: "",
  bannerImageUrl: "",
  ctaType: "NONE",
  ctaUrl: "",
  variables: [],
  audienceTags: [],
};

export interface WATemplate {
  name: string;
  language: string;
  category: string;
  bodyText?: string;
  bodyParamCount: number;
}
