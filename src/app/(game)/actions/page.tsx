import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { Alert } from "@/components/ui/Alert";
import { Zap, Axe, Hammer, Check, Clock, Coins, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const actionTypes = [
  { type: "gathering", label: "Gather Resources", description: "Collect wood, stone, and herbs", duration: 300, skill: "Gathering", icon: Axe, staminaCost: 10 },
  { type: "crafting", label: "Craft Item", description: "Create tools and equipment", duration: 600, skill: "Crafting", icon: Hammer, staminaCost: 15 },
];

const gatheringResources = [
  { name: "Wood", min: 2, max: 5, weight: 30 },
  { name: "Stone", min: 1, max: 4, weight: 25 },
  { name: "Herbs", min: 1, max: 3, weight: 20 },
  { name: "Hides", min: 1, max: 2, weight: 15 },
  { name: "Bone", min: 1, max: 2, weight: 10 },
];

interface ActionRow {
  id: string;
  character_id: string;
  type: string;
  duration: number;
  started_at: string;
  completes_at: string;
  result: unknown;
}

interface Reward {
  itemName: string;
  quantity: number;
}

export default function ActionsPage() {
  const { character, refreshCharacter, logTransaction } = useGame();
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [maxSlots, setMaxSlots] = useState(1);
  const [, setTick] = useState(0);
  const [lastRewards, setLastRewards] = useState<Reward[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Actions — TribalMMO";
  }, []);

  useEffect(() => {
    if (character) {
      fetchActions();
      const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
      setMaxSlots(craftingSkill && craftingSkill.level >= 2 ? 2 : 1);
    }
  }, [character]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchActions = useCallback(async () => {
    if (!character) return;
    const { data } = await supabase
      .from("actions")
      .select("*")
      .eq("character_id", character.id)
      .order("completes_at", { ascending: true });
    setActions((data as ActionRow[]) || []);
  }, [character]);

  const startAction = async (type: string, duration: number, skillName: string, staminaCost: number) => {
    if (!character || actions.length >= maxSlots) return;
    setError("");

    const currentStamina = character.computed_stamina;
    if (currentStamina < staminaCost) {
      setError(`Not enough stamina. Need ${staminaCost}, have ${currentStamina}.`);
      return;
    }

    const resultPayload: Record<string, unknown> = {};
    if (type === "gathering") {
      const totalWeight = gatheringResources.reduce((sum, r) => sum + r.weight, 0);
      let roll = Math.random() * totalWeight;
      const selected: { name: string; quantity: number }[] = [];
      for (const resource of gatheringResources) {
        if (roll < resource.weight) {
          selected.push({
            name: resource.name,
            quantity: Math.floor(Math.random() * (resource.max - resource.min + 1)) + resource.min,
          });
          break;
        }
        roll -= resource.weight;
      }
      if (selected.length === 0) {
        selected.push({ name: "Wood", quantity: 2 });
      }
      resultPayload.resources = selected;
    } else if (type === "crafting") {
      const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
      const level = craftingSkill?.level || 1;
      const craftingResults = [
        { name: "Stone Axe", type: "weapon", level: 1, stats: { attack: 3 } },
        { name: "Wooden Spear", type: "weapon", level: 1, stats: { attack: 4 } },
        { name: "Hide Armor", type: "armor", level: 1, stats: { defense: 3 } },
        { name: "Bone Knife", type: "weapon", level: 1, stats: { attack: 2 } },
        { name: "Stone Hammer", type: "materials", level: 2, stats: { crafting_speed: 2 } },
        { name: "Reinforced Armor", type: "armor", level: 2, stats: { defense: 7 } },
        { name: "Bow", type: "weapon", level: 2, stats: { attack: 6 } },
      ].filter((r) => r.level <= level);
      const result = craftingResults[Math.floor(Math.random() * craftingResults.length)];
      resultPayload.item_name = result.name;
      resultPayload.item_type = result.type;
      resultPayload.item_level = result.level;
      resultPayload.item_stats = result.stats;
    }

    const { error: rpcError } = await supabase.rpc("start_action", {
      p_character_id: character.id,
      p_type: type,
      p_duration: duration,
      p_skill_name: skillName,
      p_stamina_cost: staminaCost,
      p_result: Object.keys(resultPayload).length > 0 ? resultPayload as import("@/types/database").Json : undefined,
    });
    if (rpcError) { setError(rpcError.message || "Failed to start action."); return; }

    await fetchActions();
    await refreshCharacter();
  };

  const completeAction = async (actionId: string, _action: ActionRow) => {
    if (!character) return;

    const { data, error: rpcError } = await supabase.rpc("complete_action", {
      p_character_id: character.id,
      p_action_id: actionId,
    });
    if (rpcError) return;

    const rewards = (data as { rewards?: { item_name: string; quantity: number }[] })?.rewards || [];
    setLastRewards(rewards.map((r) => ({ itemName: r.item_name, quantity: r.quantity })));
    await fetchActions();
    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const now = Date.now();

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Actions</h1>
        <p className="text-slate-500 text-sm mt-0.5">Craft, train, and hone your skills</p>
      </div>

      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
        {character.next_stamina_at && (
          <p className="text-slate-600 text-xs mt-2">
            Next +1 stamina at {new Date(character.next_stamina_at).toLocaleTimeString()}
          </p>
        )}
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
      )}

      {lastRewards && (
        <div className="card border-[#2d6e44]/30 bg-[#122a1b]/20 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-[#4a9e6a] uppercase tracking-widest">Rewards Collected</h2>
            <button onClick={() => setLastRewards(null)} className="text-[#3d8b5c] hover:text-[#4a9e6a] text-xs">dismiss</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {lastRewards.map((reward, i) => (
              <div key={i} className="flex items-center gap-2 bg-[#1a3a26]/30 px-3 py-2 rounded-lg border border-[#2d6e44]/30">
                {reward.itemName === "Coins" ? <Coins size={14} className="text-slate-300" /> : <Package size={14} className="text-[#4a9e6a]" />}
                <span className="text-[#6bc98a] text-sm font-semibold">{reward.itemName}</span>
                <span className="text-[#4a9e6a] text-sm tabular-nums">+{reward.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Actions</h2>
          <span className="text-slate-500 text-xs font-bold bg-slate-900/60 px-2.5 py-1 rounded-full flex items-center gap-1 border border-slate-800/30">
            <Zap size={12} /> {actions.length} / {maxSlots}
          </span>
        </div>
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="text-slate-800 mx-auto mb-2" />
            <p className="text-slate-600">No active actions. Start one below.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => {
              const completesAt = new Date(action.completes_at).getTime();
              const startedAt = new Date(action.started_at).getTime();
              const progress = Math.min(100, ((now - startedAt) / (completesAt - startedAt)) * 100);
              const isComplete = now >= completesAt;
              const remaining = Math.max(0, Math.ceil((completesAt - now) / 1000));
              const actionInfo = actionTypes.find((a) => a.type === action.type);
              const Icon = actionInfo?.icon || Zap;
              const minutes = Math.floor(remaining / 60);
              const seconds = remaining % 60;

              let resultPreview = "";
              if (action.type === "gathering" && action.result) {
                const res = action.result as { resources?: { name: string; quantity: number }[] };
                if (res.resources) {
                  resultPreview = res.resources.map((r) => `${r.name} x${r.quantity}`).join(", ");
                }
              } else if (action.type === "crafting" && action.result) {
                const res = action.result as { item_name?: string };
                if (res.item_name) resultPreview = res.item_name;
              }

              return (
                <div key={action.id} className={`bg-slate-900/40 p-4 rounded-lg border ${isComplete ? "border-[#2d6e44]/30" : "border-slate-800/20"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-slate-500" />
                      <span className="text-slate-200 font-semibold capitalize text-sm">{action.type}</span>
                      {resultPreview && (
                        <span className="text-slate-600 text-xs">— {resultPreview}</span>
                      )}
                    </div>
                    {isComplete ? (
                      <Button variant="success" size="sm" icon={<Check size={14} />} onClick={() => completeAction(action.id, action)}>
                        Collect
                      </Button>
                    ) : (
                      <span className="text-slate-500 text-sm font-mono tabular-nums">{minutes}:{seconds.toString().padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="w-full bg-slate-900/80 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        isComplete ? "bg-[#3d8b5c]" : "bg-slate-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Start New Action</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actionTypes.map((action) => {
            const Icon = action.icon;
            const canAfford = character.computed_stamina >= action.staminaCost;
            return (
              <div key={action.type} className={`bg-slate-900/40 p-4 rounded-lg border ${canAfford ? "border-slate-800/20" : "border-slate-700/20 opacity-75"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800/30 flex items-center justify-center shrink-0">
                    <Icon size={20} className={canAfford ? "text-slate-500" : "text-slate-400/70"} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{action.label}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{action.description}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-700 flex items-center gap-1">
                        <Clock size={12} />
                        {action.duration >= 3600 ? `${Math.floor(action.duration / 3600)}h` : `${Math.floor(action.duration / 60)}m`}
                      </span>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${canAfford ? "text-slate-400" : "text-slate-300"}`}>
                        <Zap size={12} /> {action.staminaCost} stamina
                      </span>
                    </div>
                    <Button
                      variant={canAfford ? "primary" : "secondary"}
                      size="sm"
                      className="mt-3"
                      onClick={() => startAction(action.type, action.duration, action.skill, action.staminaCost)}
                      disabled={actions.length >= maxSlots || !canAfford}
                    >
                      {actions.length >= maxSlots ? "Slots Full" : !canAfford ? "No Stamina" : "Start"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
