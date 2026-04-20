import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/src/components/ui/sonner";
import { AuthSessionProvider } from "@/src/components/providers/AuthSessionProvider";

export const metadata: Metadata = {
  title: "UAE HRMS Demo",
  description: "UAE HRMS demo application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
