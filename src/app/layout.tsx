import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { GameProvider } from "@/lib/game";
import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";

export const metadata: Metadata = {
  title: "TribalMMO",
  description: "A persistent online tribal-era RPG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <GameProvider>
            <Header />
            <div className="flex flex-1">
              <Navigation />
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                {children}
              </main>
            </div>
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
