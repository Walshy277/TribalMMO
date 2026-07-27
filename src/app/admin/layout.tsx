"use client";

import Link from "next/link";
import { useAdmin } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Shield,
  ShoppingCart,
  Wrench,
  LogOut,
  Flame,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/items", label: "Items", icon: Package },
  { href: "/admin/clans", label: "Clans", icon: Shield },
  { href: "/admin/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdmin();
  const { signOut } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0e0c10" }}>
        <div className="text-[#6e656c] text-xs uppercase tracking-widest" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#0e0c10" }}>
      <aside className="w-52 bg-[#0e0c10] border-r border-[#262328] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#262328]">
          <Link href="/" className="flex items-center gap-2 group mb-3">
            <div className="w-7 h-7 bg-[#8c2e2e] flex items-center justify-center rounded-sm">
              <Flame size={14} className="text-[#f5e8e8]" />
            </div>
            <span className="text-sm font-bold text-[#e6ddd2] uppercase tracking-wide" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Admin</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[#6e656c] hover:text-[#b39b7c] text-xs transition-colors">
            <ArrowLeft size={11} />
            Back to game
          </Link>
        </div>

        <nav className="flex-1 p-2.5 space-y-px overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-100 ${
                  active
                    ? "text-[#e88] bg-[#8c2e2e]/[0.08]"
                    : "text-[#6e656c] hover:text-[#b39b7c] hover:bg-[#1a181e]"
                }`}
              >
                <Icon size={16} className={active ? "text-[#b83a3a]" : "text-[#4d3a27]"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-[#262328]">
          <Button variant="ghost" size="sm" className="w-full" icon={<LogOut size={14} />} onClick={signOut}>
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
