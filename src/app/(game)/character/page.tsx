import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useGame } from "@/lib/game";
import { useRequireAuth } from "@/components/ui/PageGuard";
import { supabase } from "@/lib/supabase/client";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { computeEffectiveStats } from "@/lib/stats";
import { skillIcons, petIcons, xpForLevel, MAX_SKILL_LEVEL, rarityColors } from "@/lib/constants";
import { formatTimeAgo, formatTimeUntil } from "@/lib/utils";
import {
  User, Dumbbell, Swords, Shield, Heart, Zap, Hammer, Cat, Star, Trophy, Map,
  Clock, TrendingUp, Scroll, Footprints, Coins, Gem, Award,
} from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

function getLevelProgress(level: number, skills: { level: number }[]): { current: number; next: number; pct: number } {
  const totalLevel = skills.reduce((sum, s) => sum + s.level, 0);
  const maxLevel = MAX_SKILL_LEVEL * 5;
  const current = Math.min(totalLevel, maxLevel);
  const pct = maxLevel > 0 ? Math.round((current / maxLevel) * 100) : 0;
  return { current, next: maxLevel, pct };
}

function calcMastery(level: number): { title: string; color: string } {
  if (level >= 99) return { title: "Grandmaster", color: "#e85050" };
  if (level >= 75) return { title: "Master", color: "#c9a84c" };
  if (level >= 50) return { title: "Expert", color: "#8a6aaa" };
  if (level >= 25) return { title: "Adept", color: "#6a90a8" };
  if (level >= 10) return { title: "Journeyman", color: "#4a9e6a" };
  return { title: "Novice", color: "#6e656c" };
}

export default function CharacterPage() {
  const { user, authLoading } = useRequireAuth();
  const { character, loading: gameLoading } = useGame();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [showAllStats, setShowAllStats] = useState(false);

  useEffect(() => {
    document.title = "Profile — TribalMMO";
  }, []);

  useEffect(() => {
    if (character) {
      fetchTransactions();
      fetchAllTransactions();
    }
  }, [character]);

  if (authLoading || gameLoading) return <LoadingSkeleton />;
  if (!user) return null;

  if (!character) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">Setting up your profile...</p>
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

  const fetchAllTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, description, created_at")
      .eq("character_id", character.id)
      .order("created_at", { ascending: false });
    setAllTransactions((data as Transaction[]) || []);
  };

  const skills = character.skills || [];
  const pets = character.pets || [];
  const clan = character.clan;
  const totalItems = character.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
  const equippedItems = character.inventory?.filter((inv) => inv.equipped) || [];
  const effectiveStats = computeEffectiveStats(character, character.inventory, { philosophy: character.clan?.clan?.philosophy, buildings: character.clanBuildings }, pets);
  const levelProgress = getLevelProgress(character.level || 1, skills);
  const mastery = calcMastery(character.level || 1);

  const lifetimeStats = useMemo(() => {
    const totalXpGained = skills.reduce((sum, s) => sum + (s.experience || 0), 0);
    const totalGoldEarned = allTransactions
      .filter((t) => t.amount > 0 && t.type !== "shop_sell")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalGoldSpent = allTransactions
      .filter((t) => t.amount < 0 && t.type !== "shop_buy")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalActions = allTransactions.length;
    const avgXpPerAction = totalActions > 0 ? Math.round(totalXpGained / totalActions) : 0;
    return { totalXpGained, totalGoldEarned, totalGoldSpent, totalActions, avgXpPerAction };
  }, [skills, allTransactions]);

  const statColor = (stat: string) => {
    switch (stat) {
      case "STR": return "text-[#b83a3a]";
      case "DEF": return "text-[#6a90a8]";
      case "SPD": return "text-[#4a9e6a]";
      case "VIT": return "text-slate-400";
      default: return "text-slate-300";
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Identity + Level Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-400 rounded-sm border border-slate-700/50" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              {character.name?.[0] || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{character.name}</h1>
              <p className="text-slate-500 text-sm">{character.background}</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: mastery.color + "20", color: mastery.color }}>
                {mastery.title}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Star size={14} className="text-slate-400" />
              <span className="text-slate-200 text-2xl font-bold">{character.level || 1}</span>
            </div>
            <div className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Level</div>
          </div>
        </div>

        {/* Level Progress Bar */}
        <div className="bg-slate-900/40 rounded-lg border border-slate-800/20 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Trophy size={12} className="text-slate-400" />
              <span className="text-slate-300 text-xs font-medium">Total Progress — {mastery.title}</span>
            </div>
            <span className="text-slate-400 text-xs">{levelProgress.current} / {levelProgress.next} skill levels</span>
          </div>
          <div className="w-full bg-slate-800/40 rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${levelProgress.pct}%`,
              background: `linear-gradient(90deg, ${mastery.color}, ${mastery.color}aa)`,
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-600 text-[10px]">Lvl {character.level || 1}</span>
            <span className="text-slate-600 text-[10px]">Lvl {Math.min((character.level || 1) + 1, MAX_SKILL_LEVEL * 5)}</span>
          </div>
        </div>
      </div>

      {/* Stamina */}
      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
        {character.next_stamina_at && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-slate-600 text-xs flex items-center gap-1">
              <Clock size={10} /> Next +1 in {formatTimeUntil(character.next_stamina_at)}
            </p>
            <p className="text-slate-600 text-xs">
              {character.computed_stamina}/{character.max_stamina} ({Math.round((character.computed_stamina / character.max_stamina) * 100)}%)
            </p>
          </div>
        )}
      </div>

      {/* Lifetime Stats */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={12} /> Lifetime
          </h2>
          <button onClick={() => setShowAllStats(!showAllStats)} className="text-slate-600 hover:text-slate-400 text-[10px] uppercase tracking-wider">
            {showAllStats ? "Less" : "All Stats"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/20">
            <Star size={14} className="text-slate-400 mx-auto mb-1" />
            <div className="text-slate-600 text-[9px] uppercase font-bold">Total XP</div>
            <div className="text-slate-100 text-sm font-bold tabular-nums">{lifetimeStats.totalXpGained.toLocaleString()}</div>
          </div>
          <div className="text-center bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/20">
            <Coins size={14} className="text-[#c9a84c] mx-auto mb-1" />
            <div className="text-slate-600 text-[9px] uppercase font-bold">Gold Earned</div>
            <div className="text-slate-100 text-sm font-bold tabular-nums">{lifetimeStats.totalGoldEarned.toLocaleString()}</div>
          </div>
          <div className="text-center bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/20">
            <Footprints size={14} className="text-[#4a9e6a] mx-auto mb-1" />
            <div className="text-slate-600 text-[9px] uppercase font-bold">Actions</div>
            <div className="text-slate-100 text-sm font-bold tabular-nums">{lifetimeStats.totalActions.toLocaleString()}</div>
          </div>
          <div className="text-center bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/20">
            <Zap size={14} className="text-[#6a90a8] mx-auto mb-1" />
            <div className="text-slate-600 text-[9px] uppercase font-bold">Avg XP/Action</div>
            <div className="text-slate-100 text-sm font-bold tabular-nums">{lifetimeStats.avgXpPerAction}</div>
          </div>
        </div>
        {showAllStats && (
          <div className="mt-3 grid grid-cols-2 gap-2 animate-fade-in">
            <div className="bg-slate-900/30 rounded p-2 border border-slate-800/20">
              <span className="text-slate-600 text-[10px]">Gold Spent</span>
              <div className="text-slate-300 text-sm font-bold">{lifetimeStats.totalGoldSpent.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/30 rounded p-2 border border-slate-800/20">
              <span className="text-slate-600 text-[10px]">Skills at 99</span>
              <div className="text-slate-300 text-sm font-bold">{skills.filter((s) => s.level >= 99).length} / {skills.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Core Stats */}
      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Core Stats</h2>
        <p className="text-slate-600 text-xs mb-3">Infinitely scaling — every point earned through training</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "STR", sub: "Strength", base: character.strength, value: effectiveStats.strength, icon: Dumbbell },
            { label: "DEF", sub: "Defence", base: character.defence, value: effectiveStats.defence, icon: Shield },
            { label: "SPD", sub: "Speed", base: character.speed, value: effectiveStats.speed, icon: Zap },
            { label: "VIT", sub: "Vitality", base: character.vitality, value: effectiveStats.vitality, icon: Heart },
          ].map((stat) => {
            const Icon = stat.icon;
            const color = statColor(stat.label);
            return (
              <div key={stat.label} className="text-center bg-slate-900/40 py-3 rounded-lg border border-slate-800/20">
                <Icon size={16} className={`mx-auto mb-1 ${color}`} />
                <div className="text-slate-600 text-[10px] font-bold uppercase">{stat.label}</div>
                <div className={`text-xl font-bold mt-0.5 ${color}`}>{stat.value}</div>
                {stat.base !== stat.value && (
                  <div className="text-slate-700 text-[10px]">(base {stat.base})</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills with Grind Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Skills</h2>
          <span className="text-slate-600 text-[10px]">Combined: {levelProgress.current} / {MAX_SKILL_LEVEL * 5}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {skills.filter((s) => s.name !== "Combat").map((skill) => {
            const Icon = skillIcons[skill.name] || Hammer;
            const xpForCurrent = xpForLevel(skill.level);
            const xpForNext = xpForLevel(Math.min(skill.level + 1, MAX_SKILL_LEVEL));
            const xpIntoLevel = skill.experience - xpForCurrent;
            const xpGap = xpForNext - xpForCurrent;
            const skillPct = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
            const xpNeeded = Math.max(0, xpGap - xpIntoLevel);
            const estActions = xpNeeded > 0 ? Math.max(1, Math.ceil(xpNeeded / 5)) : 0;
            const skillMastery = calcMastery(skill.level);
            return (
              <div key={skill.id} className="text-center bg-slate-900/40 py-3 rounded-lg border border-slate-800/20 group">
                <Icon size={16} className="text-slate-500 mx-auto mb-1" />
                <div className="text-slate-300 text-xs font-medium">{skill.name}</div>
                <div className="text-slate-600 text-[10px] font-bold uppercase mt-0.5">
                  Lvl {skill.level}
                  {skill.level >= 99 && <span className="text-[#e85050] ml-0.5">*</span>}
                </div>
                <div className="w-full bg-slate-800/40 rounded-full h-1 mt-1.5 mx-auto max-w-[80%]">
                  <div className="h-full rounded-full" style={{ width: `${skillPct}%`, background: skillMastery.color }} />
                </div>
                <div className="text-slate-700 text-[8px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  ~{estActions} actions to next
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Combat Power */}
      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Combat Power</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-slate-900/40 py-3 rounded-lg border border-slate-800/20">
            <Swords size={16} className="mx-auto mb-1 text-[#b83a3a]" />
            <div className="text-slate-600 text-[10px] font-bold uppercase">ATK</div>
            <div className="text-xl font-bold mt-0.5 text-[#b83a3a]">{effectiveStats.attack}</div>
          </div>
          <div className="text-center bg-slate-900/40 py-3 rounded-lg border border-slate-800/20">
            <Shield size={16} className="mx-auto mb-1 text-[#6a90a8]" />
            <div className="text-slate-600 text-[10px] font-bold uppercase">DEF</div>
            <div className="text-xl font-bold mt-0.5 text-[#6a90a8]">{effectiveStats.defense}</div>
          </div>
        </div>
      </div>

      {/* Clan + Pets */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Settlement</h2>
          {clan ? (
            <div>
              <p className="text-slate-100 font-semibold">{clan.clan.name}</p>
              <p className="text-slate-500 text-sm capitalize">{clan.role} &middot; {clan.clan.population} residents</p>
              <div className="grid grid-cols-3 gap-1 mt-2">
                <span className="text-slate-600 text-[10px]">Food {clan.clan.food.toLocaleString()}</span>
                <span className="text-slate-600 text-[10px]">Wood {clan.clan.wood.toLocaleString()}</span>
                <span className="text-slate-600 text-[10px]">Stone {clan.clan.stone.toLocaleString()}</span>
              </div>
              <Link to="/clans" className="text-slate-400 hover:text-slate-300 text-xs mt-2 inline-block transition-colors">View settlement →</Link>
            </div>
          ) : (
            <div>
              <p className="text-slate-600 text-sm mb-2">No clan</p>
              <Link to="/clans" className="text-slate-400 hover:text-slate-300 text-xs transition-colors">Join a clan →</Link>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Pets</h2>
          {pets.length > 0 ? (
            <div className="space-y-2">
              {pets.slice(0, 3).map((pet) => {
                const Icon = petIcons[pet.type] || Cat;
                return (
                  <div key={pet.id} className="flex items-center gap-2">
                    <Icon size={14} className="text-slate-500" />
                    <span className="text-slate-200 text-sm">{pet.name}</span>
                    <span className="text-slate-600 text-xs capitalize">{pet.type}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="text-slate-600 text-sm">No pets yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Achievements */}
      {(character.achievements || []).length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            <Trophy size={12} className="inline mr-1 text-[#c4a86a]" /> Reputation
          </h2>
          <div className="flex flex-wrap gap-2">
            {(character.achievements || []).map((ach) => (
              <div key={ach.id} className="bg-slate-900/30 px-3 py-1.5 rounded-lg border border-slate-800/20 flex items-center gap-1.5">
                <Trophy size={12} className="text-[#c4a86a]" />
                <span className="text-slate-200 text-xs font-semibold">{ach.title}</span>
                {ach.description && <span className="text-slate-600 text-[10px]">— {ach.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/exploration", icon: Map, label: "Explore", desc: "Discover the world" },
            { href: "/combat", icon: Swords, label: "Combat", desc: "Test your strength" },
            { href: "/train", icon: Zap, label: "Train", desc: "Improve your stats" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} to={action.href}
                className="flex flex-col items-center gap-1 bg-slate-900/40 hover:bg-slate-800/40 transition-colors py-3 rounded-lg border border-slate-800/20 hover:border-slate-700/30 group">
                <Icon size={16} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                <span className="text-slate-200 text-sm font-medium">{action.label}</span>
                <span className="text-slate-700 text-[8px]">{action.desc}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {transactions.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-800/20 last:border-0">
                <div className="min-w-0">
                  <p className="text-slate-300 text-sm truncate">{tx.description}</p>
                  <p className="text-slate-600 text-xs">{formatTimeAgo(tx.created_at)}</p>
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Equipped</h2>
          <div className="flex flex-wrap gap-2">
            {equippedItems.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-[#2d6e44]/30">
                <span className="text-slate-200 text-sm">{inv.item?.name || "Unknown"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="text-center py-2 space-y-0.5">
        <p className="text-slate-600 text-xs">{totalItems} items in inventory · {equippedItems.length} equipped</p>
        <p className="text-slate-700 text-[10px]">Created {formatTimeAgo(character.created_at)}</p>
      </div>
    </div>
  );
}
