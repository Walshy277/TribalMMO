import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Users, Shield, ShoppingCart, Package, Swords } from "lucide-react";

interface StatCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatCard[]>([
    { label: "Players", value: 0, icon: Users, color: "text-blue-400" },
    { label: "Characters", value: 0, icon: Users, color: "text-[#4a9e6a]" },
    { label: "Clans", value: 0, icon: Shield, color: "text-tribal-300" },
    { label: "Marketplace", value: 0, icon: ShoppingCart, color: "text-[#8a6aaa]" },
    { label: "Items", value: 0, icon: Package, color: "text-[#6a90a8]" },
    { label: "Active Actions", value: 0, icon: Swords, color: "text-[#b83a3a]" },
  ]);
  const [recentCharacters, setRecentCharacters] = useState<{ name: string; background: string; created_at: string }[]>([]);

  useEffect(() => {
    document.title = "Admin Dashboard — TribalMMO";
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [profiles, characters, clans, listings, items, actions] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("characters").select("id", { count: "exact", head: true }),
      supabase.from("clans").select("id", { count: "exact", head: true }),
      supabase.from("marketplace_listings").select("id", { count: "exact", head: true }),
      supabase.from("items").select("id", { count: "exact", head: true }),
      supabase.from("actions").select("id", { count: "exact", head: true }),
    ]);

    setStats([
      { label: "Players", value: profiles.count ?? 0, icon: Users, color: "text-blue-400" },
      { label: "Characters", value: characters.count ?? 0, icon: Users, color: "text-[#4a9e6a]" },
      { label: "Clans", value: clans.count ?? 0, icon: Shield, color: "text-tribal-300" },
      { label: "Marketplace", value: listings.count ?? 0, icon: ShoppingCart, color: "text-[#8a6aaa]" },
      { label: "Items", value: items.count ?? 0, icon: Package, color: "text-[#6a90a8]" },
      { label: "Active Actions", value: actions.count ?? 0, icon: Swords, color: "text-[#b83a3a]" },
    ]);

    const { data: recent } = await supabase
      .from("characters")
      .select("name, background, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentCharacters(recent ?? []);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Admin Dashboard</h1>
        <p className="text-tribal-400 text-sm mt-0.5">TribalMMO server overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-[#1a181e] border border-[#262328] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Icon size={18} className={stat.color} />
                <span className="text-tribal-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#1a181e] border border-[#262328] rounded-xl p-5">
        <h2 className="text-xs font-bold text-tribal-300 uppercase tracking-widest mb-4">Recent Characters</h2>
        {recentCharacters.length === 0 ? (
          <p className="text-tribal-500 text-sm">No characters yet.</p>
        ) : (
          <div className="space-y-2">
            {recentCharacters.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1e1c22]">
                <div>
                  <span className="text-tribal-200 font-medium text-sm">{c.name}</span>
                  <span className="text-tribal-500 text-sm ml-2">{c.background}</span>
                </div>
                <span className="text-tribal-500 text-xs tabular-nums">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
