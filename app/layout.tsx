import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthButton from "@/app/components/AuthButton";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Game Boy Collection",
  description: "My Game Boy cartridge collection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <header className="mb-10 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 group">
              <span className="text-3xl">🎮</span>
              <div>
                <h1 className="text-xl font-semibold leading-tight text-zinc-100 group-hover:text-white transition-colors">
                  Game Boy Collection
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">Analog Pocket · GB · GBC · GBA</p>
              </div>
            </a>
            <div className="flex items-center gap-2">
              <AuthButton />
              <a
                href="/playtime"
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ⏱ Play Time
              </a>
              <a
                href="/games/new"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-200 transition-colors border border-zinc-700"
              >
                <span>+</span>
                <span>Add game</span>
              </a>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
