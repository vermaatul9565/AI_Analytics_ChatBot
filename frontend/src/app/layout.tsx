import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAGE — Smart Analytics & Generative Engine",
  description: "Enterprise-grade AI Workspace for analytics, knowledge, reasoning, and intelligent assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('theme') || 'system';
            var root = document.documentElement;
            if (theme === 'system') {
              var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
              theme = darkQuery.matches ? 'dark' : 'light';
            }
            if (theme === 'light') {
              root.setAttribute('data-theme', 'light');
            } else {
              root.removeAttribute('data-theme');
            }
          })();
        ` }} />
      </head>
      <body>
        <div className="glow-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
