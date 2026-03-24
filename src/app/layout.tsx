import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SkillForge — AI Skill Tree Builder",
  description: "Build game-style skill trees with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" },
          }}
        />
      </body>
    </html>
  );
}
