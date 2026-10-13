"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Browser-side counterpart of appUrl(): the configured public address, or the
// address the dashboard is open on. Install snippets built from this always
// point at a real server instead of a "your-domain.com" placeholder.
export function useAppUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return useSyncExternalStore(noop, () => configured || window.location.origin, () => configured);
}
