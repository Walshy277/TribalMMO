import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGame, type CharacterWithSkills } from "@/lib/game";
import { useRequireAuth } from "@/components/ui/PageGuard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { computeEffectiveStats } from "@/lib/stats";
import { skillIcons, petIcons } from "@/lib/constants";
import { formatTimeAgo, formatTimeUntil } from "@/lib/utils";
import {
  User,
  Dumbbell,
  Swords,
  Shield,
  Crosshair,
  Brain,
  Map,
  Zap,
  Store,
  Hammer,
  Cat,
} from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function CharacterPage() {
  const { user, authLoading } = useRequireAuth();
  const { character, loading: gameLoading } = useGame();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    document.title = "TribalMMO";
  }, []);

  useEffect(() => {
    if (character) fetchTransactions();
  }, [character]);

  if (authLoading || gameLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) return null;

  if (!character) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="text-tribal-700 mx-auto mb-3" />
          <p className="text-tribal-500 mb-4">No character found.</p>
          <button onClick={() => navigate("/")} className="btn-primary inline-block text-sm px-4 py-2">Create Character</button>
        </div>
      </div>
    );
  }

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, description, created_at")
      .eq("character_id", character.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setTransactions((data as Transaction[]) || []);
  };

  const skills = character.skills || [];
  const pets = character.pets || [];
  const clan = character.clan;
  const totalItems = character.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
  const equippedItems = character.inventory?.filter((inv) => inv.equipped) || [];
  const highestTier = skills.reduce((max, s) => Math.max(max, s.tier), 1);
  const effectiveStats = computeEffectiveStats(character, character.inventory, character.clan?.clan, pets);

  const statColor = (stat: string) => {
    switch (stat) {
      case "STR": return "text-[#b83a3a]";
      case "AGI": return "text-[#4a9e6a]";
      case "END": return "text-tribal-300";
      case "FOC": return "text-[#6a90a8]";
      case "CUN": return "text-[#8a6aaa]";
      default: return "text-tribal-300";
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      {/* Identity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#36291c] flex items-center justify-center text-lg font-bold text-[#b39b7c] rounded-sm border border-[#4d3a27]/50" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            {character.name?.[0] || "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-tribal-100" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{character.name}</h1>
            <p className="text-tribal-500 text-sm">{character.background}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-tribal-600 text-[10px] font-bold uppercase tracking-wider">Level</div>
          <div className="text-tribal-200 text-xl font-bold">{character.level || 1}</div>
          <div className="text-tribal-600 text-[10px]">Highest Tier: {highestTier}</div>
        </div>
      </div>

      {/* Stamina */}
      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
        {character.next_stamina_at && (
          <p className="text-tribal-600 text-xs mt-2">
            Next +1 in {formatTimeUntil(character.next_stamina_at)}
          </p>
        )}
      </div>

      {/* Core Stats */}
      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Stats</h2>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "STR", base: character.strength, value: effectiveStats.strength, icon: Dumbbell },
            { label: "AGI", base: character.agility, value: effectiveStats.agility, icon: Swords },
            { label: "END", base: character.endurance, value: effectiveStats.endurance, icon: Shield },
            { label: "FOC", base: character.focus, value: effectiveStats.focus, icon: Crosshair },
            { label: "CUN", base: character.cunning, value: effectiveStats.cunning, icon: Brain },
          ].map((stat) => {
            const Icon = stat.icon;
            const color = statColor(stat.label);
            return (
              <div key={stat.label} className="text-center bg-tribal-900/40 py-3 rounded-lg border border-tribal-800/20">
                <Icon size={16} className={`mx-auto mb-1 ${color}`} />
                <div className="text-tribal-600 text-[10px] font-bold uppercase">{stat.label}</div>
                <div className={`text-xl font-bold mt-0.5 ${color}`}>{stat.value}</div>
                {stat.base !== stat.value && (
                  <div className="text-tribal-700 text-[10px]">(base {stat.base})</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attack & Defense */}
      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Combat Power</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-tribal-900/40 py-3 rounded-lg border border-tribal-800/20">
            <Swords size={16} className="mx-auto mb-1 text-[#b83a3a]" />
            <div className="text-tribal-600 text-[10px] font-bold uppercase">ATK</div>
            <div className="text-xl font-bold mt-0.5 text-[#b83a3a]">{effectiveStats.attack}</div>
          </div>
          <div className="text-center bg-tribal-900/40 py-3 rounded-lg border border-tribal-800/20">
            <Shield size={16} className="mx-auto mb-1 text-tribal-300" />
            <div className="text-tribal-600 text-[10px] font-bold uppercase">DEF</div>
            <div className="text-xl font-bold mt-0.5 text-tribal-300">{effectiveStats.defense}</div>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Skills</h2>
        <div className="grid grid-cols-5 gap-2">
          {skills.map((skill) => {
            const Icon = skillIcons[skill.name] || Hammer;
            return (
              <div key={skill.id} className="text-center bg-tribal-900/40 py-3 rounded-lg border border-tribal-800/20">
                <Icon size={16} className="text-tribal-500 mx-auto mb-1" />
                <div className="text-tribal-300 text-xs font-medium">{skill.name}</div>
                <div className="text-tribal-600 text-[10px] font-bold uppercase mt-0.5">Tier {skill.tier}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clan + Pets */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Clan</h2>
          {clan ? (
            <div>
              <p className="text-tribal-100 font-semibold">{clan.clan.name}</p>
              <p className="text-tribal-500 text-sm capitalize">{clan.role}</p>
              <p className="text-tribal-600 text-xs mt-1">{clan.clan.clan_members?.length || 0} members</p>
            </div>
          ) : (
            <div>
              <p className="text-tribal-600 text-sm mb-2">No clan</p>
              <Link to="/clans" className="text-tribal-400 hover:text-tribal-300 text-xs transition-colors">Join a clan →</Link>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Pets</h2>
          {pets.length > 0 ? (
            <div className="space-y-2">
              {pets.slice(0, 3).map((pet) => {
                const Icon = petIcons[pet.type] || Cat;
                return (
                  <div key={pet.id} className="flex items-center gap-2">
                    <Icon size={14} className="text-tribal-500" />
                    <span className="text-tribal-200 text-sm">{pet.name}</span>
                    <span className="text-tribal-600 text-xs capitalize">{pet.type}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="text-tribal-600 text-sm">No pets yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/exploration", icon: Map, label: "Explore" },
            { href: "/combat", icon: Swords, label: "Combat" },
            { href: "/actions", icon: Zap, label: "Actions" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                to={action.href}
                className="flex items-center justify-center gap-2 bg-tribal-900/40 hover:bg-tribal-800/40 transition-colors py-3 rounded-lg border border-tribal-800/20 hover:border-tribal-700/30"
              >
                <Icon size={16} className="text-tribal-500" />
                <span className="text-tribal-200 text-sm font-medium">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {transactions.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-tribal-800/20 last:border-0">
                <div className="min-w-0">
                  <p className="text-tribal-300 text-sm truncate">{tx.description}</p>
                  <p className="text-tribal-600 text-xs">{formatTimeAgo(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-bold tabular-nums ml-3 ${tx.amount >= 0 ? "text-[#4a9e6a]" : "text-[#b83a3a]"}`}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment */}
      {equippedItems.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Equipped</h2>
          <div className="flex flex-wrap gap-2">
            {equippedItems.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 bg-tribal-900/40 px-3 py-1.5 rounded-lg border border-[#2d6e44]/30">
                <span className="text-tribal-200 text-sm">{inv.item?.name || "Unknown"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Count */}
      <div className="text-center py-2">
        <p className="text-tribal-600 text-xs">{totalItems} items in inventory · {equippedItems.length} equipped</p>
      </div>
    </div>
  );
}
