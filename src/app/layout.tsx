import type { Metadata } from "next";
import "./globals.css";
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
        <Header />
        <div className="flex flex-1">
          <Navigation />
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
