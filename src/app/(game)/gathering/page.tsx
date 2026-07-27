"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import {
  TreePine,
  Mountain,
  Axe,
  Pickaxe,
  Zap,
  Package,
  AlertTriangle,
  CheckCircle,
  Lock,
} from "lucide-react";

interface GatherResult {
  skill: string;
  xp_gained: number;
  tier: number;
  item_name: string | null;
  item_qty: number;
  stamina_cost: number;
  success: boolean;
  message: string;
}

interface ResourceNode {
  name: string;
  minTier: number;
  desc: string;
}

const woodcuttingResources: ResourceNode[] = [
  { name: "Wood", minTier: 1, desc: "Basic lumber for crafting" },
  { name: "Oak Log", minTier: 1, desc: "Sturdy wood, good for tools" },
  { name: "Willow Log", minTier: 2, desc: "Flexible, used for bows" },
  { name: "Maple Log", minTier: 3, desc: "Dense hardwood, highly valued" },
  { name: "Yew Log", minTier: 4, desc: "Rare and incredibly strong" },
];

const miningResources: ResourceNode[] = [
  { name: "Stone", minTier: 1, desc: "Common building material" },
  { name: "Copper Ore", minTier: 1, desc: "Soft metal for basic tools" },
  { name: "Iron Ore", minTier: 2, desc: "Strong metal for weapons" },
  { name: "Coal", minTier: 2, desc: "Fuel for smelting ores" },
  { name: "Silver Ore", minTier: 3, desc: "Precious metal for jewelry" },
  { name: "Gemstone", minTier: 3, desc: "Sparkling treasure from deep" },
  { name: "Gold Ore", minTier: 4, desc: "The ultimate precious metal" },
  { name: "Emerald", minTier: 4, desc: "A green gem of great value" },
  { name: "Diamond", minTier: 5, desc: "The rarest stone in the world" },
];

export default function GatheringPage() {
  const { character, refreshCharacter } = useGame();
  const [gathering, setGathering] = useState(false);
  const [lastResult, setLastResult] = useState<GatherResult | null>(null);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [actionType, setActionType] = useState<"woodcutting" | "mining">("woodcutting");

  useEffect(() => {
    document.title = "Gather — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const woodcuttingSkill = character.skills?.find((s) => s.name === "Woodcutting");
  const miningSkill = character.skills?.find((s) => s.name === "Mining");
  const wcTier = woodcuttingSkill?.tier || 1;
  const wcXp = woodcuttingSkill?.experience || 0;
  const minTier = miningSkill?.tier || 1;
  const minXp = miningSkill?.experience || 0;

  const currentSkill = actionType === "woodcutting" ? wcTier : minTier;
  const currentXp = actionType === "woodcutting" ? wcXp : minXp;
  const xpMax = currentSkill * 100;
  const xpPercent = Math.min((currentXp / xpMax) * 100, 100);
  const staminaCost = 8 + Math.max(0, (currentSkill - 1) * 2);

  const gather = async () => {
    if (gathering) return;
    setGathering(true);
    setError("");
    setLastResult(null);

    const { data, error: rpcError } = await supabase.rpc("gather_resource", {
      p_character_id: character.id,
      p_action: actionType,
    });

    if (rpcError) {
      setError(rpcError.message);
      setGathering(false);
      return;
    }

    const result = data as unknown as GatherResult;
    setLastResult(result);
    setSessionCount((s) => s + 1);
    await refreshCharacter();
    setGathering(false);
  };

  const resources = actionType === "woodcutting" ? woodcuttingResources : miningResources;
  const accent = actionType === "woodcutting" ? "#4a9e6a" : "#8a7a6a";

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <SectionHeader
        title="Gather"
        subtitle="Harvest resources from the wilds of Nervella"
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
        <div className="card animate-fade-in" style={{ background: lastResult.success ? "rgba(18,42,27,0.3)" : "rgba(42,18,18,0.3)", borderColor: lastResult.success ? "rgba(45,110,68,0.2)" : "rgba(110,36,36,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold" style={{ color: lastResult.success ? "#4a9e6a" : "#b83a3a", fontFamily: "Crimson Pro, Georgia, serif" }}>
              {lastResult.success ? "Gathered!" : "Failed!"}
            </h2>
            <button onClick={() => setLastResult(null)} className="text-tribal-600 hover:text-tribal-400 text-xs">
              dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)" }}>
              <Zap size={14} className="text-[#c9a84c]" />
              <span className="text-[#c9a84c] text-sm font-semibold">+{lastResult.xp_gained} {lastResult.skill} XP</span>
            </div>
            {lastResult.success && lastResult.item_name && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(74,158,106,0.08)", border: "1px solid rgba(74,158,106,0.15)" }}>
                <Package size={14} className="text-[#4a9e6a]" />
                <span className="text-[#6bc98a] text-sm font-semibold">+{lastResult.item_qty}x {lastResult.item_name}</span>
              </div>
            )}
          </div>
          {!lastResult.success && (
            <p className="text-tribal-500 text-xs mt-2">{lastResult.message}</p>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setActionType("woodcutting"); setLastResult(null); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all border ${
              actionType === "woodcutting"
                ? "bg-[rgba(74,158,106,0.08)] border-[rgba(74,158,106,0.2)] text-[#4a9e6a]"
                : "bg-transparent border-[rgba(38,35,40,0.3)] text-tribal-500 hover:text-tribal-300"
            }`}
          >
            <TreePine size={18} />
            Woodcutting
          </button>
          <button
            onClick={() => { setActionType("mining"); setLastResult(null); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all border ${
              actionType === "mining"
                ? "bg-[rgba(138,122,106,0.08)] border-[rgba(138,122,106,0.2)] text-[#b39b7c]"
                : "bg-transparent border-[rgba(38,35,40,0.3)] text-tribal-500 hover:text-tribal-300"
            }`}
          >
            <Mountain size={18} />
            Mining
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="flex items-center gap-2">
            {actionType === "woodcutting" ? <TreePine size={16} className="text-[#4a9e6a]" /> : <Mountain size={16} className="text-[#b39b7c]" />}
            <span className="text-tribal-200 font-bold text-lg">Level {currentSkill}</span>
          </div>
          <div className="flex-1">
            <div className="w-full h-2 bg-[rgba(26,24,30,0.8)] rounded-full overflow-hidden border border-[rgba(38,35,40,0.5)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${xpPercent}%`, background: accent + "80" }}
              />
            </div>
            <div className="text-tribal-600 text-[10px] mt-0.5">{currentXp}/{xpMax} XP</div>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          icon={actionType === "woodcutting" ? <Axe size={18} /> : <Pickaxe size={18} />}
          onClick={gather}
          disabled={gathering || character.computed_stamina < staminaCost}
          loading={gathering}
        >
          {character.computed_stamina < staminaCost
            ? `Not Enough Stamina (need ${staminaCost})`
            : actionType === "woodcutting"
            ? "Chop Tree"
            : "Mine Ore"}
        </Button>
        <p className="text-tribal-600 text-xs text-center mt-2">
          Costs {staminaCost} stamina per action
        </p>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-tribal-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          {actionType === "woodcutting" ? "Trees" : "Ore Deposits"}
        </h2>
        <div className="space-y-1.5">
          {resources.map((res) => {
            const unlocked = currentSkill >= res.minTier;
            return (
              <div
                key={res.name}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  unlocked
                    ? "bg-[rgba(26,24,30,0.4)] border border-[rgba(38,35,40,0.3)]"
                    : "bg-[rgba(26,24,30,0.2)] border border-[rgba(38,35,40,0.15)] opacity-40"
                }`}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                  style={{ background: unlocked ? accent + "12" : "rgba(255,255,255,0.02)" }}
                >
                  {unlocked ? (
                    actionType === "woodcutting" ? <TreePine size={16} style={{ color: accent }} /> : <Mountain size={16} style={{ color: accent }} />
                  ) : (
                    <Lock size={14} className="text-tribal-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${unlocked ? "text-tribal-200" : "text-tribal-500"}`}>{res.name}</span>
                    <span className="text-tribal-600 text-[10px] font-bold bg-tribal-900/60 px-1.5 py-0.5 rounded border border-tribal-800/20">
                      Lvl {res.minTier}
                    </span>
                  </div>
                  <p className="text-tribal-600 text-xs">{res.desc}</p>
                </div>
                {unlocked && (
                  <CheckCircle size={14} style={{ color: accent }} className="shrink-0 opacity-60" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-tribal-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Gathering Skills</h2>
        <div className="space-y-2">
          {[
            { name: "Woodcutting", tier: wcTier, xp: wcXp, icon: TreePine, color: "#4a9e6a" },
            { name: "Mining", tier: minTier, xp: minXp, icon: Mountain, color: "#8a7a6a" },
          ].map((skill) => {
            const Icon = skill.icon;
            const max = skill.tier * 100;
            const pct = Math.min((skill.xp / max) * 100, 100);
            return (
              <div key={skill.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-tribal-900/30 border border-tribal-800/20">
                <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: skill.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-tribal-200 text-sm font-medium">{skill.name}</span>
                    <span className="text-tribal-600 text-[10px] font-bold">Tier {skill.tier}</span>
                  </div>
                  <div className="w-full h-1.5 bg-tribal-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: skill.color + "80" }} />
                  </div>
                  <div className="text-tribal-700 text-[10px] mt-0.5">{skill.xp}/{max} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
