import { NextRequest } from "next/server";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { getImageKitAuthParams } from "@/lib/imagekit";

// Any authenticated dashboard user can request short-lived upload auth params —
// ImageKit verifies the signature server-side per upload, so this can't be abused
// to upload on someone else's behalf.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { token, expire, signature } = getImageKitAuthParams();
  return apiSuccess({
    token,
    expire,
    signature,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}
