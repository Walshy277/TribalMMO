import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { xpForLevel, MAX_SKILL_LEVEL, SKILL_NAMES, skillIcons } from "@/lib/constants";
import {
  Swords,
  Dumbbell,
  Shield,
  Heart,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface TrainResult {
  skill: string;
  skill_name: string;
  xp_gained: number;
  level: number;
  coin_reward: number;
  stamina_cost: number;
}

interface Activity {
  id: string;
  name: string;
  desc: string;
  stat: string;
  icon: typeof Swords;
  color: string;
}

const activities: Activity[] = [
  { id: "sparring", name: "Sparring", desc: "Fight training dummies to hone combat skills", stat: "strength", icon: Swords, color: "#b83a3a" },
  { id: "conditioning", name: "Conditioning", desc: "Physical training to build resilience", stat: "defence", icon: Shield, color: "#6a90a8" },
  { id: "sprinting", name: "Sprinting", desc: "Run laps around the village for speed", stat: "speed", icon: Zap, color: "#4a9e6a" },
  { id: "vitality", name: "Vitality Training", desc: "Push your body to increase vitality", stat: "vitality", icon: Heart, color: "#3b82f6" },
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
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const combatSkill = character.skills?.find((s) => s.name === "Combat");
  const combatLevel = combatSkill?.level || 1;
  const combatXp = combatSkill?.experience || 0;
  const xpForNext = xpForLevel(Math.min(combatLevel + 1, MAX_SKILL_LEVEL)) - xpForLevel(combatLevel);
  const xpIntoLevel = combatXp - xpForLevel(combatLevel);
  const xpPct = xpForNext > 0 ? Math.min((xpIntoLevel / xpForNext) * 100, 100) : 100;
  const xpNeeded = Math.max(0, xpForNext - xpIntoLevel);
  const estActions = xpNeeded > 0 ? Math.max(1, Math.ceil(xpNeeded / 5)) : 0;

  const getStaminaCost = (activity: Activity) => {
    return 8 + Math.max(0, (combatLevel - 1) * 2) + (["sparring", "sprinting"].includes(activity.id) ? 2 : 0);
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
      case "vitality": return "text-[#3b82f6]";
      default: return "text-slate-300";
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
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Train"
        subtitle="Hone your skills and strengthen your core stats"
        right={sessionCount > 0 ? (
          <div className="text-slate-500 text-xs bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/30">
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
            <button onClick={() => setLastResult(null)} className="text-slate-600 hover:text-slate-400 text-xs">
              dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <Zap size={14} className="text-blue-500" />
              <span className="text-blue-500 text-sm font-semibold">+{lastResult.xp_gained} Combat XP</span>
            </div>

          </div>
        </div>
      )}

      {/* Core Stats Display */}
      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Core Stats</h2>
        <p className="text-slate-600 text-xs mb-3">Infinitely scaling — train to grow stronger</p>
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
              <div key={stat.key} className="text-center bg-slate-900/40 py-2 rounded-lg border border-slate-800/20">
                <Icon size={14} className={`mx-auto mb-0.5 ${color}`} />
                <div className="text-slate-600 text-[9px] font-bold uppercase">{stat.label}</div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Combat Skill</h2>
            <span className="text-slate-200 text-sm font-bold">Level {combatLevel}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{
              background: combatLevel >= 75 ? "#c9a84c20" : combatLevel >= 50 ? "#8a6aaa20" : combatLevel >= 25 ? "#6a90a820" : combatLevel >= 10 ? "#4a9e6a20" : "#6e656c20",
              color: combatLevel >= 75 ? "#c9a84c" : combatLevel >= 50 ? "#8a6aaa" : combatLevel >= 25 ? "#6a90a8" : combatLevel >= 10 ? "#4a9e6a" : "#6e656c",
            }}>
              {combatLevel >= 99 ? "Grandmaster" : combatLevel >= 75 ? "Master" : combatLevel >= 50 ? "Expert" : combatLevel >= 25 ? "Adept" : combatLevel >= 10 ? "Journeyman" : "Novice"}
            </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500 bg-blue-500" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-slate-600 text-[10px] tabular-nums">{combatXp.toLocaleString()} XP</span>
        </div>
        <div className="text-slate-700 text-[10px] mt-1 flex justify-between">
          <span>{xpForNext > 0 ? `${xpIntoLevel.toLocaleString()} / ${xpForNext.toLocaleString()} XP` : "Max level!"}</span>
          {xpForNext > 0 && <span className="text-slate-600">~{estActions} actions</span>}
        </div>
      </div>

      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = activity.icon;
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
                  <span className="text-slate-200 font-semibold text-sm">{activity.name}</span>
                  <span className={`text-[10px] font-bold ${statColor(activity.stat)}`}>
                    {activity.stat.toUpperCase()} {statValue}
                  </span>
                </div>
                <p className="text-slate-500 text-xs">{activity.desc}</p>
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
    </div>
  );
}
