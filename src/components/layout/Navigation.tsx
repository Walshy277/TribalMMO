"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { usePathname } from "next/navigation";
import {
  User,
  Map,
  Zap,
  Sword,
  Backpack,
  Hammer,
  Shield,
  Coins,
  Gavel,
  Store,
  Gift,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/character", label: "Character", icon: User },
  { href: "/exploration", label: "Explore", icon: Map },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/combat", label: "Combat", icon: Sword },
  { href: "/inventory", label: "Inventory", icon: Backpack },
  { href: "/crafting", label: "Crafting", icon: Hammer },
  { href: "/clans", label: "Clans", icon: Shield },
  { href: "/shrine", label: "Shrine", icon: Sparkles },
  { href: "/shops", label: "Shops", icon: Store },
  { href: "/marketplace", label: "Market", icon: Coins },
  { href: "/auction", label: "Auctions", icon: Gavel },
  { href: "/rewards", label: "Rewards", icon: Gift },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { character } = useGame();
  const pathname = usePathname();

  if (!user) return null;

  const highestTier = character?.skills?.reduce((max, s) => Math.max(max, s.tier), 1) ?? 1;

  return (
    <>
      <button
        className="md:hidden fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-sm bg-[#c04e20] text-[#f5f0ea] shadow-md active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-52 bg-[#0e0c10] border-r border-[#262328] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex-1 p-2.5 space-y-px overflow-y-auto pt-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-[0.82rem] font-medium transition-colors duration-100 ${
                  active
                    ? "text-[#d45a28] bg-[#c04e20]/[0.07]"
                    : "text-[#6e656c] hover:text-[#b39b7c] hover:bg-[#1a181e]"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={16} className={active ? "text-[#c04e20]" : "text-[#4d3a27]"} />
                <span>{item.label}</span>
                {active && <div className="ml-auto w-1 h-1 rounded-full bg-[#c04e20]" />}
              </Link>
            );
          })}
        </nav>

        {character && (
          <div className="p-2.5 border-t border-[#262328]">
            <Link href="/character" className="flex items-center gap-2.5 p-2 hover:bg-[#1a181e] transition-colors rounded-sm">
              <div className="w-9 h-9 bg-[#36291c] flex items-center justify-center text-xs font-bold text-[#b39b7c] rounded-sm border border-[#4d3a27]/50">
                {character.name?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <div className="text-[#cfc1ae] text-sm font-semibold truncate">{character.name}</div>
                <div className="text-[#6e656c] text-xs">Tier {highestTier}</div>
              </div>
            </Link>
          </div>
        )}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
