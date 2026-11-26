import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { JudgeModeFromUrl } from "@/components/site/judge-from-url";
import { TooltipProvider } from "@/components/ui/tooltip";

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-poppins", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Needs Finder · Could your family carry on without you?", template: "%s · Needs Finder" },
  description: "Know your family's life-cover gap before you see a price. Educational calculator with sample data.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e1530" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${poppins.variable} ${inter.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <TooltipProvider>
          <JudgeModeFromUrl />
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
