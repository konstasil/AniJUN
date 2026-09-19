import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import Header from "@/components/Header";
import ErudaConsole from "@/components/ErudaConsole";
import { SimulationProvider } from "@/lib/simulation-context";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import IpTracker from "@/components/IpTracker";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AniJUN",
  description: "Твой аниме-дневник",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col custom-scrollbar overflow-x-hidden">
        <ErudaConsole />
        <SimulationProvider>
          <Header />
          <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
        </SimulationProvider>
        <Analytics />
        <SpeedInsights />
        <IpTracker />
      </body>
    </html>
  );
}
