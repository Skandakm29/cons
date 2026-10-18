import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Post your home construction project, get a fair price benchmark, and compare quotes from verified builders in Bengaluru.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#b8410c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t bg-card py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. A construction tender marketplace — we run the tender, verified builders build.
        </footer>
      </body>
    </html>
  );
}
