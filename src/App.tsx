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
import Dashboard from "@/app/(game)/play/page";
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

function GameLayout({ children }: { children: React.ReactNode }) {
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
          <Link to="/" className="flex items-center gap-2 group mb-3">
            <div className="w-7 h-7 bg-[#8c2e2e] flex items-center justify-center rounded-sm">
              <Flame size={14} className="text-[#f5e8e8]" />
            </div>
            <span className="text-sm font-bold text-[#e6ddd2] uppercase tracking-wide" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Admin</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-[#6e656c] hover:text-[#b39b7c] text-xs transition-colors">
            <ArrowLeft size={11} />
            Back to game
          </Link>
        </div>

        <nav className="flex-1 p-2.5 space-y-px overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors duration-100 ${
                  pathname === item.href
                    ? "text-[#e88] bg-[#8c2e2e]/[0.08]"
                    : "text-[#6e656c] hover:text-[#b39b7c] hover:bg-[#1a181e]"
                }`}
              >
                <Icon size={16} className={pathname === item.href ? "text-[#b83a3a]" : "text-[#4d3a27]"} />
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

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0e0c10" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#c04e20]/[0.02] blur-[100px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {children}
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

        <Route path="/play" element={<ProtectedRoute><GameLayout><Dashboard /></GameLayout></ProtectedRoute>} />
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
