"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { Button } from "@/components/ui/Button";
import { LogOut, Flame, Coins } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const { character } = useGame();

  return (
    <header className="bg-[#0e0c10] border-b border-[#262328] px-5 py-3 flex items-center justify-between shrink-0 sticky top-0 z-50">
      <Link href="/character" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 bg-[#c04e20] flex items-center justify-center rounded-sm">
          <Flame size={17} className="text-[#f5f0ea]" />
        </div>
        <span className="text-base font-bold text-[#e6ddd2] tracking-wide uppercase" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Tribal<span className="text-[#c04e20]">MMO</span>
        </span>
      </Link>
      <nav className="flex items-center gap-4">
        {user && character && (
          <div className="flex items-center gap-1.5 text-[#b39b7c]">
            <Coins size={14} className="text-[#c04e20]" />
            <span className="text-sm font-bold tabular-nums">{character.coins}</span>
          </div>
        )}
        {user && (
          <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={signOut}>
            Logout
          </Button>
        )}
      </nav>
    </header>
  );
}
