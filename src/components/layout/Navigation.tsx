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
  Gift,
  Menu,
  X,
  TreePine,
  Mountain,
  Sparkles,
  Store,
  Home,
  Scroll,
  Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Clan",
    icon: Flag,
    items: [
      { href: "/clans", label: "Settlement", icon: Shield, color: "#60a5fa" },
    ],
  },
  {
    label: "You",
    icon: User,
    items: [
      { href: "/profile", label: "Profile", icon: User, color: "#94a3b8" },
      { href: "/inventory", label: "Inventory", icon: Backpack, color: "#c9a84c" },
      { href: "/rewards", label: "Rewards", icon: Gift, color: "#818cf8" },
    ],
  },
  {
    label: "World",
    icon: Map,
    items: [
      { href: "/town-centre", label: "Town Centre", icon: Home, color: "#f59e0b" },
      { href: "/exploration", label: "Explore", icon: Map, color: "#8a6aaa" },
      { href: "/gathering", label: "Gather", icon: TreePine, color: "#4a9e6a" },
      { href: "/woodcutting", label: "Woodcut", icon: TreePine, color: "#6a9a5a" },
      { href: "/mining", label: "Mine", icon: Mountain, color: "#8a7a6a" },
      { href: "/train", label: "Train", icon: Zap, color: "#c9a84c" },
      { href: "/combat", label: "Combat", icon: Sword, color: "#b83a3a" },
      { href: "/crafting", label: "Craft", icon: Hammer, color: "#60a5fa" },
      { href: "/shrine", label: "Shrine", icon: Sparkles, color: "#a855f7" },
    ],
  },
  {
    label: "Trade",
    icon: Scroll,
    items: [
      { href: "/shops", label: "Shops", icon: Store, color: "#3b82f6" },
      { href: "/marketplace", label: "Market", icon: Coins, color: "#fbbf24" },
      { href: "/auction", label: "Auctions", icon: Gavel, color: "#f97316" },
    ],
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { character } = useGame();
  const { pathname } = useLocation();

  if (!user) return null;

  const playerLevel = character?.level || 1;

  return (
    <>
      <button
        className="md:hidden fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-[#0c1222] shadow-lg shadow-[rgba(59,130,246,0.2)] active:scale-95 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-52 bg-[rgba(12,18,34,0.96)] border-r border-[rgba(59,130,246,0.06)] flex flex-col transition-transform duration-200 ease-in-out backdrop-blur-sm ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex-1 px-2 pt-5 pb-2 space-y-5 overflow-y-auto scrollbar-none">
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.label}>
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <GroupIcon size={10} className="text-slate-700" />
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-[rgba(100,116,139,0.1)] to-transparent" />
                </div>
                <div className="space-y-px">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`nav-link ${active ? "nav-link-active" : ""}`}
                        onClick={() => setIsOpen(false)}
                      >
                        <Icon
                          size={14}
                          style={{ color: active ? item.color : undefined }}
                          className={active ? "" : "text-slate-600"}
                        />
                        <span>{item.label}</span>
                        {active && (
                          <div className="ml-auto w-1 h-1 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.4)]" style={{ background: item.color }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {character && (
          <div className="p-2.5 border-t border-[rgba(59,130,246,0.06)]">
            <Link
              to="/profile"
              className="flex items-center gap-2.5 p-2 rounded-lg transition-colors hover:bg-[rgba(59,130,246,0.03)]"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 rounded-[6px] border border-[rgba(100,116,139,0.15)] shadow-inner">
                {character.name?.[0] || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-slate-200 text-sm font-semibold truncate leading-tight">{character.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 bg-[rgba(100,116,139,0.1)] px-1.5 py-[1px] rounded uppercase tracking-wider">
                    Lv.{playerLevel}
                  </span>
                </div>
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
