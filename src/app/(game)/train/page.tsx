import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import {
  Swords,
  Dumbbell,
  Shield,
  Heart,
  Zap,
  Package,
  AlertTriangle,
  Coins,
  TreePine,
  Hammer,
  Mountain,
} from "lucide-react";

interface TrainResult {
  skill: string;
  skill_name: string;
  xp_gained: number;
  level: number;
  item_name: string | null;
  item_qty: number;
  coin_reward: number;
  stamina_cost: number;
  message: string;
}

interface Activity {
  id: string;
  name: string;
  desc: string;
  skill: string;
  stat: string;
  icon: typeof Swords;
  color: string;
}

const activities: Activity[] = [
  { id: "sparring", name: "Sparring", desc: "Fight training dummies to hone combat skills", skill: "Combat", stat: "strength", icon: Swords, color: "#b83a3a" },
  { id: "conditioning", name: "Conditioning", desc: "Physical training to build resilience", skill: "Combat", stat: "defence", icon: Shield, color: "#6a90a8" },
  { id: "sprinting", name: "Sprinting", desc: "Run laps around the village for speed", skill: "Combat", stat: "speed", icon: Zap, color: "#4a9e6a" },
  { id: "vitality", name: "Vitality Training", desc: "Push your body to increase vitality", skill: "Combat", stat: "vitality", icon: Heart, color: "#c9a84c" },
  { id: "foraging", name: "Foraging", desc: "Search the wilds for useful plants and herbs", skill: "Gathering", stat: "strength", icon: Package, color: "#4a9e6a" },
  { id: "study", name: "Study", desc: "Read ancient texts to improve your craft", skill: "Crafting", stat: "strength", icon: Hammer, color: "#c9a84c" },
  { id: "chopping_drill", name: "Chopping Drill", desc: "Practice axe techniques for woodcutting efficiency", skill: "Woodcutting", stat: "strength", icon: TreePine, color: "#4a9e6a" },
  { id: "mining_practice", name: "Mining Practice", desc: "Study ore veins and practice mining techniques", skill: "Mining", stat: "strength", icon: Mountain, color: "#8a7a6a" },
];

export default function TrainPage() {
  const { character, refreshCharacter } = useGame();
  const [training, setTraining] = useState(false);
  const [lastResult, setLastResult] = useState<TrainResult | null>(null);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    document.title = "Train — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const getSkillLevel = (name: string) => character.skills?.find((s) => s.name === name)?.level || 1;
  const getSkillXp = (name: string) => character.skills?.find((s) => s.name === name)?.experience || 0;

  const getStaminaCost = (activity: Activity) => {
    const level = getSkillLevel(activity.skill);
    return 8 + Math.max(0, (level - 1) * 2) + (["sparring", "sprinting"].includes(activity.id) ? 2 : 0);
  };

  const train = async (activity: Activity) => {
    if (training) return;
    setTraining(true);
    setError("");
    setLastResult(null);

    const { data, error: rpcError } = await supabase.rpc("train", {
      p_character_id: character.id,
      p_activity: activity.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setTraining(false);
      return;
    }

    const result = data as unknown as TrainResult;
    setLastResult(result);
    setSessionCount((s) => s + 1);
    await refreshCharacter();
    setTraining(false);
  };

  const statColor = (stat: string) => {
    switch (stat) {
      case "strength": return "text-[#b83a3a]";
      case "defence": return "text-[#6a90a8]";
      case "speed": return "text-[#4a9e6a]";
      case "vitality": return "text-[#c9a84c]";
      default: return "text-tribal-300";
    }
  };

  const getStatValue = (stat: string) => {
    switch (stat) {
      case "strength": return character.strength;
      case "defence": return character.defence;
      case "speed": return character.speed;
      case "vitality": return character.vitality;
      default: return 0;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <SectionHeader
        title="Train"
        subtitle="Hone your skills and strengthen your core stats"
        right={sessionCount > 0 ? (
          <div className="text-tribal-500 text-xs bg-tribal-900/60 px-3 py-1.5 rounded-lg border border-tribal-800/30">
            {sessionCount} session{sessionCount !== 1 ? "s" : ""} today
          </div>
        ) : undefined}
      />

      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")} icon={<AlertTriangle size={14} />}>
          {error}
        </Alert>
      )}

      {lastResult && (
        <div className="card animate-fade-in" style={{ background: "rgba(18,42,27,0.3)", borderColor: "rgba(45,110,68,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#4a9e6a]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              Training Complete!
            </h2>
            <button onClick={() => setLastResult(null)} className="text-tribal-600 hover:text-tribal-400 text-xs">
              dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)" }}>
              <Zap size={14} className="text-[#c9a84c]" />
              <span className="text-[#c9a84c] text-sm font-semibold">+{lastResult.xp_gained} {(lastResult.skill || lastResult.skill_name)} XP</span>
            </div>
            {lastResult.coin_reward > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)" }}>
                <Coins size={14} className="text-[#c9a84c]" />
                <span className="text-[#c9a84c] text-sm font-semibold">+{lastResult.coin_reward} gold</span>
              </div>
            )}
            {lastResult.item_name && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(74,158,106,0.08)", border: "1px solid rgba(74,158,106,0.15)" }}>
                <Package size={14} className="text-[#4a9e6a]" />
                <span className="text-[#6bc98a] text-sm font-semibold">+{lastResult.item_qty}x {lastResult.item_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Core Stats Display */}
      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Core Stats</h2>
        <p className="text-tribal-600 text-xs mb-3">Infinitely scaling — train to grow stronger</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: "strength", label: "STR", icon: Dumbbell },
            { key: "defence", label: "DEF", icon: Shield },
            { key: "speed", label: "SPD", icon: Zap },
            { key: "vitality", label: "VIT", icon: Heart },
          ].map((stat) => {
            const Icon = stat.icon;
            const color = statColor(stat.key);
            const value = getStatValue(stat.key);
            return (
              <div key={stat.key} className="text-center bg-tribal-900/40 py-2 rounded-lg border border-tribal-800/20">
                <Icon size={14} className={`mx-auto mb-0.5 ${color}`} />
                <div className="text-tribal-600 text-[9px] font-bold uppercase">{stat.label}</div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const level = getSkillLevel(activity.skill);
          const xp = getSkillXp(activity.skill);
          const xpMax = level * 100;
          const xpPct = Math.min((xp / xpMax) * 100, 100);
          const cost = getStaminaCost(activity);
          const canTrain = character.computed_stamina >= cost && !training;
          const statValue = getStatValue(activity.stat);

          return (
            <div
              key={activity.id}
              className="card flex items-center gap-4"
              style={{ borderLeft: `3px solid ${activity.color}` }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: activity.color + "12" }}
              >
                <Icon size={20} style={{ color: activity.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-tribal-200 font-semibold text-sm">{activity.name}</span>
                  <span className="text-tribal-600 text-[10px] font-bold bg-tribal-900/60 px-1.5 py-0.5 rounded border border-tribal-800/20">
                    {activity.skill} Lv.{level}
                  </span>
                  <span className={`text-[10px] font-bold ${statColor(activity.stat)}`}>
                    {activity.stat.toUpperCase()} {statValue}
                  </span>
                </div>
                <p className="text-tribal-500 text-xs mb-1.5">{activity.desc}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-tribal-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${xpPct}%`, background: activity.color + "80" }} />
                  </div>
                  <span className="text-tribal-700 text-[10px]">{xp}/{xpMax}</span>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canTrain}
                  loading={training}
                  onClick={() => train(activity)}
                >
                  {character.computed_stamina < cost ? `${cost} stamina` : `Train (${cost})`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-tribal-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Skill Overview</h2>
        <div className="space-y-2">
          {character.skills?.map((skill) => {
            const max = skill.level * 100;
            const pct = Math.min((skill.experience / max) * 100, 100);
            const activity = activities.find((a) => a.skill === skill.name);
            const color = activity?.color || "#8a7a6a";
            return (
              <div key={skill.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-tribal-900/30 border border-tribal-800/20">
                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-tribal-200 text-sm font-medium">{skill.name}</span>
                    <span className="text-tribal-600 text-[10px] font-bold">Level {skill.level}</span>
                  </div>
                  <div className="w-full h-1.5 bg-tribal-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color + "80" }} />
                  </div>
                  <div className="text-tribal-700 text-[10px] mt-0.5">{skill.experience}/{max} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
