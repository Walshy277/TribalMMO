"use client";

import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Navigation />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
