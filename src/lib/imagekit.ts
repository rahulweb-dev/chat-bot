import ImageKit from "imagekit";

const globalForImageKit = globalThis as unknown as { __imagekit?: ImageKit };

export function getImageKit(): ImageKit {
  if (globalForImageKit.__imagekit) return globalForImageKit.__imagekit;

  const instance = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
  });

  globalForImageKit.__imagekit = instance;
  return instance;
}

export function getImageKitAuthParams() {
  return getImageKit().getAuthenticationParameters();
}
