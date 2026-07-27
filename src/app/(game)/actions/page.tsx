"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { Alert } from "@/components/ui/Alert";
import { Zap, Swords, Axe, Hammer, Check, Clock, Coins, Package, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const actionTypes = [
  { type: "training", label: "Train", description: "Hone your combat skills", duration: 300, skill: "Combat", icon: Swords, staminaCost: 5 },
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
      setMaxSlots(craftingSkill && craftingSkill.tier >= 2 ? 2 : 1);
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

    const completesAt = new Date(Date.now() + duration * 1000).toISOString();

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
    }

    // Deduct stamina
    const newStamina = Math.max(0, currentStamina - staminaCost);
    const { error: staminaError } = await supabase.from("characters").update({
      stamina: newStamina,
      stamina_updated_at: new Date().toISOString(),
    }).eq("id", character.id);
    if (staminaError) { setError("Failed to deduct stamina. Please try again."); return; }

    await logTransaction(character.id, "stamina_cost", -staminaCost, `Started ${type} (-${staminaCost} stamina)`);

    await supabase.from("actions").insert({
      character_id: character.id,
      type,
      duration,
      completes_at: completesAt,
      result: Object.keys(resultPayload).length > 0 ? resultPayload as unknown as import("@/types/database").Json : undefined,
    });

    const skill = character.skills?.find((s) => s.name === skillName);
    if (skill) {
      const xp = Math.floor(duration / 30);
      const newXp = skill.experience + xp;
      const maxXP = skill.tier * 100;
      const newTier = newXp >= maxXP && skill.tier < 5 ? skill.tier + 1 : skill.tier;
      await supabase
        .from("skills")
        .update({ experience: newXp, tier: newTier })
        .eq("id", skill.id);
    }

    await fetchActions();
    await refreshCharacter();
  };

  const completeAction = async (actionId: string, action: ActionRow) => {
    if (!character) return;
    const rewards: Reward[] = [];

    if (action.type === "gathering") {
      const result = action.result as { resources?: { name: string; quantity: number }[] } | null;
      const resources = result?.resources || [];

      for (const resource of resources) {
        const existingItem = await supabase.from("items").select("id").eq("name", resource.name).single();
        let itemId = existingItem.data?.id;
        if (!itemId) {
          const { data: newItem } = await supabase.from("items").insert({ name: resource.name, type: "resource", tier: 1 }).select("id").single();
          itemId = newItem?.id;
        }
        if (!itemId) continue;

        const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", itemId).single();
        if (existingInv.data) {
          await supabase.from("inventory").update({ quantity: existingInv.data.quantity + resource.quantity }).eq("id", existingInv.data.id);
        } else {
          await supabase.from("inventory").insert({ character_id: character.id, item_id: itemId, quantity: resource.quantity });
        }
        rewards.push({ itemName: resource.name, quantity: resource.quantity });
      }

      const coinReward = Math.floor(Math.random() * 5) + 1;
      const { error: coinError } = await supabase.from("characters").update({ coins: character.coins + coinReward }).eq("id", character.id);
      if (coinError) console.error("Failed to award coins:", coinError);
      await logTransaction(character.id, "action_reward", coinReward, `Gathering completion reward`);
      rewards.push({ itemName: "Coins", quantity: coinReward });
    } else if (action.type === "crafting") {
      const result = action.result as { item_name?: string; item_type?: string; stats?: Record<string, number>; tier?: number } | null;
      if (result?.item_name) {
        const existingItem = await supabase.from("items").select("id").eq("name", result.item_name).single();
        let itemId = existingItem.data?.id;
        if (!itemId) {
          const { data: newItem } = await supabase.from("items").insert({
            name: result.item_name,
            type: result.item_type || "weapon",
            tier: result.tier || 1,
            stats: result.stats || {},
          }).select("id").single();
          itemId = newItem?.id;
        }
        if (itemId) {
          const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", itemId).single();
          if (existingInv.data) {
            await supabase.from("inventory").update({ quantity: existingInv.data.quantity + 1 }).eq("id", existingInv.data.id);
          } else {
            await supabase.from("inventory").insert({ character_id: character.id, item_id: itemId, quantity: 1 });
          }
          rewards.push({ itemName: result.item_name, quantity: 1 });
        }
      }
    } else if (action.type === "training") {
      const coinReward = Math.floor(Math.random() * 8) + 2;
      const { error: coinError } = await supabase.from("characters").update({ coins: character.coins + coinReward }).eq("id", character.id);
      if (coinError) console.error("Failed to award coins:", coinError);
      await logTransaction(character.id, "action_reward", coinReward, `Training completion reward`);
      rewards.push({ itemName: "Coins", quantity: coinReward });
    }

    await supabase.from("actions").delete().eq("id", actionId);
    setLastRewards(rewards);
    await fetchActions();
    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const now = Date.now();

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Actions</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Craft, train, and hone your skills</p>
      </div>

      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
        {character.next_stamina_at && (
          <p className="text-tribal-600 text-xs mt-2">
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
                {reward.itemName === "Coins" ? <Coins size={14} className="text-tribal-300" /> : <Package size={14} className="text-[#4a9e6a]" />}
                <span className="text-[#6bc98a] text-sm font-semibold">{reward.itemName}</span>
                <span className="text-[#4a9e6a] text-sm tabular-nums">+{reward.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest">Active Actions</h2>
          <span className="text-tribal-500 text-xs font-bold bg-tribal-900/60 px-2.5 py-1 rounded-full flex items-center gap-1 border border-tribal-800/30">
            <Zap size={12} /> {actions.length} / {maxSlots}
          </span>
        </div>
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">No active actions. Start one below.</p>
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
                <div key={action.id} className={`bg-tribal-900/40 p-4 rounded-lg border ${isComplete ? "border-[#2d6e44]/30" : "border-tribal-800/20"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-tribal-500" />
                      <span className="text-tribal-200 font-semibold capitalize text-sm">{action.type}</span>
                      {resultPreview && (
                        <span className="text-tribal-600 text-xs">— {resultPreview}</span>
                      )}
                    </div>
                    {isComplete ? (
                      <Button variant="success" size="sm" icon={<Check size={14} />} onClick={() => completeAction(action.id, action)}>
                        Collect
                      </Button>
                    ) : (
                      <span className="text-tribal-500 text-sm font-mono tabular-nums">{minutes}:{seconds.toString().padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="w-full bg-tribal-900/80 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        isComplete ? "bg-[#3d8b5c]" : "bg-tribal-500"
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
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Start New Action</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actionTypes.map((action) => {
            const Icon = action.icon;
            const canAfford = character.computed_stamina >= action.staminaCost;
            return (
              <div key={action.type} className={`bg-tribal-900/40 p-4 rounded-lg border ${canAfford ? "border-tribal-800/20" : "border-tribal-700/20 opacity-75"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-tribal-800/30 flex items-center justify-center shrink-0">
                    <Icon size={20} className={canAfford ? "text-tribal-500" : "text-tribal-400/70"} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-tribal-200">{action.label}</div>
                    <div className="text-sm text-tribal-600 mt-0.5">{action.description}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-tribal-700 flex items-center gap-1">
                        <Clock size={12} />
                        {action.duration >= 3600 ? `${action.duration / 3600}h` : `${action.duration / 60}m`}
                      </span>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${canAfford ? "text-tribal-400" : "text-tribal-300"}`}>
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
