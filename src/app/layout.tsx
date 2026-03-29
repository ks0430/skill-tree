import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("skillforge-theme")||"dark";document.documentElement.classList.add(t);})()`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <ThemeToggle />
        <footer className="fixed bottom-0 left-0 p-1 text-[10px] opacity-30 pointer-events-none select-none" style={{ color: "var(--text-primary)" }}>
          build: {new Date().toISOString()}
        </footer>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: "var(--toast-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" },
          }}
        />
      </body>
    </html>
  );
}
