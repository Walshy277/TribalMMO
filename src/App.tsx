import { Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import { useAdmin } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Link } from "react-router-dom";
import { ProtectedRoute } from "@/components/ui/PageGuard";
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
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import LandingPage from "@/app/page";
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";
import CharacterPage from "@/app/(game)/character/page";
import TrainPage from "@/app/(game)/train/page";
import WoodcuttingPage from "@/app/(game)/woodcutting/page";
import MiningPage from "@/app/(game)/mining/page";
import CraftingPage from "@/app/(game)/crafting/page";
import CombatPage from "@/app/(game)/combat/page";
import ExplorationPage from "@/app/(game)/exploration/page";
import InventoryPage from "@/app/(game)/inventory/page";
import MarketplacePage from "@/app/(game)/marketplace/page";
import AuctionHousePage from "@/app/(game)/auction/page";
import ShopsPage from "@/app/(game)/shops/page";
import RewardsPage from "@/app/(game)/rewards/page";
import ActionsPage from "@/app/(game)/actions/page";
import ClansPage from "@/app/(game)/clans/page";
import AdminDashboard from "@/app/admin/page";
import AdminPlayersPage from "@/app/admin/players/page";
import AdminItemsPage from "@/app/admin/items/page";
import AdminClansPage from "@/app/admin/clans/page";
import AdminMarketplacePage from "@/app/admin/marketplace/page";
import AdminToolsPage from "@/app/admin/tools/page";
import GatheringPage from "@/app/(game)/gathering/page";
import ShrinePage from "@/app/(game)/shrine/page";
import TownCentrePage from "@/app/(game)/town-centre/page";
import HuntingPage from "@/app/(game)/hunting/page";
import BeggingPage from "@/app/(game)/begging/page";
import TamingPage from "@/app/(game)/taming/page";

function GameLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[rgba(59,130,246,0.015)] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-[rgba(59,130,246,0.01)] blur-[100px]" />
      </div>
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Navigation />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div key={pathname} className="animate-slide-up max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

const adminNavItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/items", label: "Items", icon: Package },
  { href: "/admin/clans", label: "Clans", icon: Shield },
  { href: "/admin/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
];

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdmin();
  const { signOut } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1222]">
        <div className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#0c1222" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-[rgba(59,130,246,0.015)] blur-[120px]" />
      </div>
      <aside className="w-52 bg-[#162032] border-r border-[rgba(59,130,246,0.06)] flex flex-col shrink-0 relative">
        <div className="p-4 border-b border-[rgba(59,130,246,0.06)]">
          <Link to="/" className="flex items-center gap-2 group mb-3">
            <div className="w-7 h-7 bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center rounded-[5px]">
              <Flame size={14} className="text-[#0c1222]" />
            </div>
            <span className="text-sm font-bold text-slate-300 uppercase tracking-wide font-heading">Admin</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-slate-600 hover:text-slate-400 text-xs transition-colors">
            <ArrowLeft size={11} />
            Back to game
          </Link>
        </div>

        <nav className="flex-1 p-2.5 space-y-px overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-100 rounded-md ${
                  active
                    ? "text-slate-200 bg-[rgba(59,130,246,0.07)] shadow-[inset_2px_0_0_#3b82f6]"
                    : "text-slate-500 hover:text-slate-300 hover:bg-[rgba(59,130,246,0.03)]"
                }`}
              >
                <Icon size={16} className={active ? "text-blue-400" : "text-slate-600"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-[rgba(59,130,246,0.06)]">
          <Button variant="ghost" size="sm" className="w-full text-slate-500 hover:text-slate-300" icon={<LogOut size={14} />} onClick={signOut}>
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

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0c1222" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[rgba(59,130,246,0.02)] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-[rgba(59,130,246,0.012)] blur-[100px]" />
        <div className="absolute top-1/4 right-1/4 w-[200px] h-[200px] rounded-full bg-[rgba(59,130,246,0.008)] blur-[80px]" />
      </div>
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="relative">
          <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-b from-[rgba(59,130,246,0.08)] to-[rgba(59,130,246,0.02)] pointer-events-none" />
          <div className="relative forge-card bg-gradient-to-b from-[#1a2235] to-[#162032] rounded-xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function PageTitle({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><SignupPage /></AuthLayout>} />

        <Route path="/profile" element={<ProtectedRoute><GameLayout><CharacterPage /></GameLayout></ProtectedRoute>} />
        <Route path="/train" element={<ProtectedRoute><GameLayout><TrainPage /></GameLayout></ProtectedRoute>} />
        <Route path="/woodcutting" element={<ProtectedRoute><GameLayout><WoodcuttingPage /></GameLayout></ProtectedRoute>} />
        <Route path="/mining" element={<ProtectedRoute><GameLayout><MiningPage /></GameLayout></ProtectedRoute>} />
        <Route path="/crafting" element={<ProtectedRoute><GameLayout><CraftingPage /></GameLayout></ProtectedRoute>} />
        <Route path="/combat" element={<ProtectedRoute><GameLayout><CombatPage /></GameLayout></ProtectedRoute>} />
        <Route path="/exploration" element={<ProtectedRoute><GameLayout><ExplorationPage /></GameLayout></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><GameLayout><InventoryPage /></GameLayout></ProtectedRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute><GameLayout><MarketplacePage /></GameLayout></ProtectedRoute>} />
        <Route path="/auction" element={<ProtectedRoute><GameLayout><AuctionHousePage /></GameLayout></ProtectedRoute>} />
        <Route path="/shops" element={<ProtectedRoute><GameLayout><ShopsPage /></GameLayout></ProtectedRoute>} />
        <Route path="/gathering" element={<ProtectedRoute><GameLayout><GatheringPage /></GameLayout></ProtectedRoute>} />
        <Route path="/shrine" element={<ProtectedRoute><GameLayout><ShrinePage /></GameLayout></ProtectedRoute>} />
        <Route path="/town-centre" element={<ProtectedRoute><GameLayout><TownCentrePage /></GameLayout></ProtectedRoute>} />
        <Route path="/hunting" element={<ProtectedRoute><GameLayout><HuntingPage /></GameLayout></ProtectedRoute>} />
        <Route path="/begging" element={<ProtectedRoute><GameLayout><BeggingPage /></GameLayout></ProtectedRoute>} />
        <Route path="/taming" element={<ProtectedRoute><GameLayout><TamingPage /></GameLayout></ProtectedRoute>} />
        <Route path="/rewards" element={<ProtectedRoute><GameLayout><RewardsPage /></GameLayout></ProtectedRoute>} />
        <Route path="/actions" element={<ProtectedRoute><GameLayout><ActionsPage /></GameLayout></ProtectedRoute>} />
        <Route path="/clans" element={<ProtectedRoute><GameLayout><ClansPage /></GameLayout></ProtectedRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/players" element={<AdminRoute><AdminPlayersPage /></AdminRoute>} />
        <Route path="/admin/items" element={<AdminRoute><AdminItemsPage /></AdminRoute>} />
        <Route path="/admin/clans" element={<AdminRoute><AdminClansPage /></AdminRoute>} />
        <Route path="/admin/marketplace" element={<AdminRoute><AdminMarketplacePage /></AdminRoute>} />
        <Route path="/admin/tools" element={<AdminRoute><AdminToolsPage /></AdminRoute>} />
      </Routes>
    </div>
  );
}
