import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AniJUN",
  description: "Твой аниме-дневник",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col custom-scrollbar">
        <Header />
        <main className="flex-1 max-w-[1600px] w-full mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
