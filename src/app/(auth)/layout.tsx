import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SupportFlow – Sign In",
  description: "Customer engagement platform",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
