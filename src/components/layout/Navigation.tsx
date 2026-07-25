"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";

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

  if (!user) return null;

  return (
    <>
      <button
        className="md:hidden fixed bottom-4 left-4 z-50 bg-tribal-700 text-tribal-100 p-3 rounded-full shadow-lg shadow-tribal-950/50 border border-tribal-600/30 active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "✕" : "☰"}
      </button>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-56 bg-tribal-900/95 backdrop-blur-sm border-r border-tribal-700/50 transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-tribal-400 hover:bg-tribal-800/60 hover:text-tribal-100 transition-all text-sm"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {character && (
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-tribal-700/50 bg-tribal-900/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-tribal-700 rounded-full flex items-center justify-center text-sm">
                {character.name?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <div className="text-tribal-200 text-sm font-semibold truncate">{character.name}</div>
                <div className="text-tribal-500 text-xs">Tier {character.skills?.[0]?.tier || 1}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
