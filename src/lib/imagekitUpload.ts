import axios from "axios";

export interface ImageKitUploadResult {
  url: string;
  fileId: string;
  name: string;
}

// Browser-side upload: fetch a short-lived signature from our own backend,
// then upload directly to ImageKit (the file bytes never pass through our server).
export async function uploadToImageKit(
  file: File,
  folder = "whatsapp-campaigns",
  onProgress?: (percent: number) => void
): Promise<ImageKitUploadResult> {
  const { data: auth } = await axios.get("/api/imagekit/auth");
  const params = auth.data as { token: string; expire: number; signature: string; publicKey: string; urlEndpoint: string };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("folder", `/${folder}`);
  formData.append("publicKey", params.publicKey);
  formData.append("signature", params.signature);
  formData.append("expire", String(params.expire));
  formData.append("token", params.token);
  formData.append("useUniqueFileName", "true");

  const res = await axios.post("https://upload.imagekit.io/api/v1/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress((evt.loaded / evt.total) * 100);
    },
  });

  return { url: res.data.url, fileId: res.data.fileId, name: res.data.name };
}
