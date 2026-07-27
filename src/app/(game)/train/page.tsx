"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import {
  Swords,
  Brain,
  Dumbbell,
  Footprints,
  Leaf,
  BookOpen,
  Zap,
  Package,
  AlertTriangle,
  Coins,
} from "lucide-react";

interface TrainResult {
  skill: string;
  skill_name: string;
  xp_gained: number;
  tier: number;
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
  icon: typeof Swords;
  color: string;
}

const activities: Activity[] = [
  { id: "sparring", name: "Sparring", desc: "Fight training dummies to hone combat skills", skill: "Combat", icon: Swords, color: "#b83a3a" },
  { id: "meditation", name: "Meditation", desc: "Quiet reflection to sharpen your mind", skill: "Diplomacy", icon: Brain, color: "#8a6aaa" },
  { id: "conditioning", name: "Conditioning", desc: "Physical training to build endurance", skill: "Survival", icon: Dumbbell, color: "#6a90a8" },
  { id: "sprinting", name: "Sprinting", desc: "Run laps around the village for stamina", skill: "Survival", icon: Footprints, color: "#6a90a8" },
  { id: "foraging", name: "Foraging", desc: "Search the wilds for useful plants and herbs", skill: "Gathering", icon: Leaf, color: "#4a9e6a" },
  { id: "study", name: "Study", desc: "Read ancient texts to improve your craft", skill: "Crafting", icon: BookOpen, color: "#c9a84c" },
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

  const getSkillTier = (name: string) => character.skills?.find((s) => s.name === name)?.tier || 1;
  const getSkillXp = (name: string) => character.skills?.find((s) => s.name === name)?.experience || 0;

  const getStaminaCost = (activity: Activity) => {
    const tier = getSkillTier(activity.skill);
    return 8 + Math.max(0, (tier - 1) * 2) + (["sparring", "sprinting"].includes(activity.id) ? 2 : 0);
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

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <SectionHeader
        title="Train"
        subtitle="Hone your skills through dedicated practice"
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
                <span className="text-[#c9a84c] text-sm font-semibold">+{lastResult.coin_reward} coins</span>
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

      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const tier = getSkillTier(activity.skill);
          const xp = getSkillXp(activity.skill);
          const xpMax = tier * 100;
          const xpPct = Math.min((xp / xpMax) * 100, 100);
          const cost = getStaminaCost(activity);
          const canTrain = character.computed_stamina >= cost && !training;

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
                    {activity.skill} Tier {tier}
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
            const max = skill.tier * 100;
            const pct = Math.min((skill.experience / max) * 100, 100);
            const activity = activities.find((a) => a.skill === skill.name);
            const color = activity?.color || "#8a7a6a";
            return (
              <div key={skill.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-tribal-900/30 border border-tribal-800/20">
                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-tribal-200 text-sm font-medium">{skill.name}</span>
                    <span className="text-tribal-600 text-[10px] font-bold">Tier {skill.tier}</span>
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
