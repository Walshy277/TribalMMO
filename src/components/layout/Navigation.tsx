import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
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
  TreePine,
  Mountain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navGroups = [
  {
    label: "You",
    items: [
      { href: "/character", label: "Character", icon: User },
      { href: "/inventory", label: "Inventory", icon: Backpack },
      { href: "/clans", label: "Clans", icon: Shield },
    ],
  },
  {
    label: "World",
    items: [
      { href: "/exploration", label: "Explore", icon: Map },
      { href: "/woodcutting", label: "Woodcutting", icon: TreePine },
      { href: "/mining", label: "Mining", icon: Mountain },
      { href: "/train", label: "Train", icon: Zap },
      { href: "/combat", label: "Combat", icon: Sword },
      { href: "/crafting", label: "Crafting", icon: Hammer },
      { href: "/shrine", label: "Shrine", icon: Sparkles },
    ],
  },
  {
    label: "Trade",
    items: [
      { href: "/town-centre", label: "Town Centre", icon: Store },
      { href: "/marketplace", label: "Market", icon: Coins },
      { href: "/auction", label: "Auctions", icon: Gavel },
      { href: "/rewards", label: "Rewards", icon: Gift },
    ],
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { character } = useGame();
  const { pathname } = useLocation();

  if (!user) return null;

  const highestTier = character?.skills?.reduce((max, s) => Math.max(max, s.tier), 1) ?? 1;

  return (
    <>
      <button
        className="md:hidden fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-[#c04e20] text-[#f5f0ea] shadow-lg shadow-[rgba(192,78,32,0.3)] active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-52 bg-[rgba(14,12,16,0.95)] border-r border-[rgba(38,35,40,0.4)] flex flex-col transition-transform duration-200 ease-in-out backdrop-blur-sm ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex-1 px-2.5 pt-4 pb-2 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5">
                <span className="text-[10px] font-bold text-[#4d3a27] uppercase tracking-[0.15em]">
                  {group.label}
                </span>
              </div>
              <div className="space-y-px">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-2.5 px-3 py-[0.4rem] text-[0.82rem] font-medium rounded-md transition-all duration-150 ${
                        active
                          ? "text-[#e6ddd2] bg-[rgba(192,78,32,0.1)]"
                          : "text-[#6e656c] hover:text-[#b39b7c] hover:bg-[rgba(26,24,30,0.5)]"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon
                        size={15}
                        className={active ? "text-[#c04e20]" : "text-[#3d2e1f]"}
                      />
                      <span>{item.label}</span>
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#c04e20] shadow-[0_0_6px_rgba(192,78,32,0.4)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {character && (
          <div className="p-2.5 border-t border-[rgba(38,35,40,0.4)]">
            <Link
              to="/character"
              className="flex items-center gap-2.5 p-2 hover:bg-[rgba(26,24,30,0.5)] transition-colors rounded-md"
            >
              <div className="w-9 h-9 bg-[#36291c] flex items-center justify-center text-xs font-bold text-[#b39b7c] rounded-md border border-[rgba(77,58,39,0.3)]">
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
