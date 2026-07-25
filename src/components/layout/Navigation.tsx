"use client";

import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/character", label: "Character", icon: "👤" },
  { href: "/exploration", label: "Explore", icon: "🗺️" },
  { href: "/actions", label: "Actions", icon: "⚡" },
  { href: "/combat", label: "Combat", icon: "⚔️" },
  { href: "/inventory", label: "Inventory", icon: "🎒" },
  { href: "/crafting", label: "Crafting", icon: "🔨" },
  { href: "/factions", label: "Factions", icon: "🛡️" },
  { href: "/settlement", label: "Settlement", icon: "🏠" },
  { href: "/marketplace", label: "Market", icon: "💰" },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="md:hidden fixed bottom-4 left-4 z-50 bg-tribal-700 text-tribal-100 p-3 rounded-full shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-tribal-900 border-r border-tribal-700 transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded text-tribal-300 hover:bg-tribal-800 hover:text-tribal-100 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
