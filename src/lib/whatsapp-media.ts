// What WhatsApp Cloud API accepts for each attachment kind (shared by the
// dashboard composer and the send route, so both reject the same files).
// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#supported-media-types

export type WhatsAppMediaKind = "image" | "video" | "audio" | "document";

const MB = 1024 * 1024;

export const WHATSAPP_MEDIA: Record<WhatsAppMediaKind, { types: string[]; maxBytes: number; label: string }> = {
  image: { types: ["image/jpeg", "image/png"], maxBytes: 5 * MB, label: "Photo" },
  video: { types: ["video/mp4", "video/3gpp"], maxBytes: 16 * MB, label: "Video" },
  audio: { types: ["audio/aac", "audio/amr", "audio/mpeg", "audio/mp4", "audio/ogg"], maxBytes: 16 * MB, label: "Audio" },
  document: {
    types: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxBytes: 100 * MB,
    label: "Document",
  },
};

// Browsers report some types inconsistently (".mp3" as audio/mp3, ".m4a" as
// audio/x-m4a); map them onto the names Meta expects.
const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/opus": "audio/ogg",
};

export function normalizeMime(type: string): string {
  const base = type.split(";")[0].trim().toLowerCase();
  return ALIASES[base] || base;
}

export function mediaKindFor(type: string): WhatsAppMediaKind | null {
  const mime = normalizeMime(type);
  for (const kind of Object.keys(WHATSAPP_MEDIA) as WhatsAppMediaKind[]) {
    if (WHATSAPP_MEDIA[kind].types.includes(mime)) return kind;
  }
  return null;
}

// Returns an error message, or null if WhatsApp will accept the file.
export function checkMediaFile(file: { type: string; size: number }): string | null {
  const kind = mediaKindFor(file.type);
  if (!kind) return "WhatsApp doesn't support this file type. Send JPG/PNG photos, MP4 videos, MP3/OGG/AAC audio, or PDF, Word, Excel, PowerPoint and text documents.";
  const { maxBytes, label } = WHATSAPP_MEDIA[kind];
  if (file.size > maxBytes) return `${label}s can be up to ${maxBytes / MB} MB on WhatsApp.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

export const ACCEPT_PHOTO_VIDEO = [...WHATSAPP_MEDIA.image.types, ...WHATSAPP_MEDIA.video.types].join(",");
export const ACCEPT_AUDIO = [...WHATSAPP_MEDIA.audio.types, ".mp3", ".m4a", ".aac", ".ogg", ".amr"].join(",");
export const ACCEPT_DOCUMENT = [...WHATSAPP_MEDIA.document.types, ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"].join(",");
