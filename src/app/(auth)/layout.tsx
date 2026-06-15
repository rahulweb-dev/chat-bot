import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SupportFlow – Sign In",
  description: "Customer engagement platform",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SupportFlow</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enterprise Customer Engagement Platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
