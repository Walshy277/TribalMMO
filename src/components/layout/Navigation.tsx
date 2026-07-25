"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/character", label: "Character", icon: "👤" },
  { href: "/exploration", label: "Explore", icon: "🗺️" },
  { href: "/actions", label: "Actions", icon: "⚡" },
  { href: "/combat", label: "Combat", icon: "⚔️" },
  { href: "/inventory", label: "Inventory", icon: "🎒" },
  { href: "/crafting", label: "Crafting", icon: "🔨" },
  { href: "/factions", label: "Factions", icon: "🛡️" },
  { href: "/settlement", label: "Settlement", icon: "🏘️" },
  { href: "/marketplace", label: "Market", icon: "💰" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { character } = useGame();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <>
      <button
        className="md:hidden fixed bottom-5 left-5 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-tribal-700 text-tribal-100 shadow-lg shadow-black/30 border border-tribal-600/50 active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "✕" : "☰"}
      </button>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-56 bg-tribal-950 border-r border-tribal-800/60 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-tribal-800 text-tribal-100 border border-tribal-700/50"
                    : "text-tribal-400 hover:bg-tribal-900 hover:text-tribal-200 border border-transparent"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {character && (
          <div className="p-3 border-t border-tribal-800/60">
            <a href="/character" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-tribal-900 transition-colors">
              <div className="w-9 h-9 rounded-full bg-tribal-800 border border-tribal-700/50 flex items-center justify-center text-sm font-bold text-tribal-300">
                {character.name?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <div className="text-tribal-200 text-sm font-semibold truncate">{character.name}</div>
                <div className="text-tribal-500 text-xs">Tier {character.skills?.[0]?.tier || 1}</div>
              </div>
            </a>
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
