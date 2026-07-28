"use client";

import { useEffect, useState, useCallback } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { TreePine, Clock, AlertTriangle } from "lucide-react";

interface WoodcuttingNode {
  id: string;
  name: string;
  xp: number;
  gold: number;
  duration: number;
  staminaCost: number;
  requiredTier: number;
  description: string;
  drops: { name: string; min: number; max: number; chance: number }[];
}

const woodcuttingNodes: WoodcuttingNode[] = [
  { id: "normal_tree", name: "Normal Tree", xp: 5, gold: 1, duration: 10, staminaCost: 5, requiredTier: 1, description: "Common trees found throughout the forest", drops: [{ name: "Wood", min: 2, max: 5, chance: 1 }, { name: "Normal Log", min: 1, max: 2, chance: 0.7 }] },
  { id: "oak_tree", name: "Oak Tree", xp: 10, gold: 2, duration: 15, staminaCost: 8, requiredTier: 1, description: "Sturdy oak with dense wood", drops: [{ name: "Wood", min: 1, max: 3, chance: 0.8 }, { name: "Oak Log", min: 1, max: 3, chance: 1 }] },
  { id: "willow_tree", name: "Willow Tree", xp: 15, gold: 3, duration: 20, staminaCost: 10, requiredTier: 2, description: "Flexible willow near water sources", drops: [{ name: "Wood", min: 2, max: 4, chance: 0.9 }, { name: "Willow Log", min: 1, max: 3, chance: 1 }] },
  { id: "maple_tree", name: "Maple Tree", xp: 25, gold: 5, duration: 30, staminaCost: 12, requiredTier: 3, description: "Valued for syrup and hard timber", drops: [{ name: "Wood", min: 3, max: 5, chance: 1 }, { name: "Maple Log", min: 1, max: 3, chance: 1 }] },
  { id: "yew_tree", name: "Yew Tree", xp: 40, gold: 8, duration: 45, staminaCost: 15, requiredTier: 4, description: "Ancient yew with magical properties", drops: [{ name: "Wood", min: 4, max: 6, chance: 1 }, { name: "Yew Log", min: 1, max: 2, chance: 1 }] },
];

export default function WoodcuttingPage() {
  const { character, refreshCharacter } = useGame();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [gathering, setGathering] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    document.title = "Woodcutting — TribalMMO";
  }, []);

  const buildInventoryMap = useCallback(() => {
    if (!character?.inventory) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const inv of character.inventory) {
      if (inv.item) {
        const current = map.get(inv.item.name) || 0;
        map.set(inv.item.name, current + inv.quantity);
      }
    }
    return map;
  }, [character?.inventory]);

  useEffect(() => {
    setInventoryItems(buildInventoryMap());
  }, [buildInventoryMap]);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const woodcuttingSkill = character.skills?.find((s) => s.name === "Woodcutting");
  const currentTier = woodcuttingSkill?.tier || 1;
  const xp = woodcuttingSkill?.experience || 0;

  const gatherWood = async (node: WoodcuttingNode) => {
    if (!woodcuttingSkill || gathering) return;
    if (character.computed_stamina < node.staminaCost) return;
    if (currentTier < node.requiredTier) return;

    setGathering(true);

    // Deduct stamina
    const { error: staminaError } = await supabase
      .from("characters")
      .update({ stamina: Math.max(0, character.computed_stamina - node.staminaCost), stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (staminaError) { setGathering(false); return; }

    // Add XP
    const newXp = xp + node.xp;
    const maxXP = currentTier * 100;
    const newTier = newXp >= maxXP && currentTier < 5 ? currentTier + 1 : currentTier;

    await supabase
      .from("skills")
      .update({ experience: newXp, tier: newTier })
      .eq("id", woodcuttingSkill.id);

    // Add gold
    await supabase
      .from("characters")
      .update({ gold: character.gold + node.gold })
      .eq("id", character.id);

    // Add dropped items to inventory
    const droppedItems: { name: string; quantity: number }[] = [];
    for (const drop of node.drops) {
      if (Math.random() <= drop.chance) {
        const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
        const existingItem = await supabase.from("items").select("id").eq("name", drop.name).single();
        let itemId = existingItem.data?.id;
        if (!itemId) {
          const { data: newItem } = await supabase.from("items").insert({ name: drop.name, type: "resource", tier: 1 }).select("id").single();
          itemId = newItem?.id;
        }
        if (!itemId) continue;
        const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", itemId).single();
        if (existingInv.data) {
          await supabase.from("inventory").update({ quantity: existingInv.data.quantity + qty }).eq("id", existingInv.data.id);
        } else {
          await supabase.from("inventory").insert({ character_id: character.id, item_id: itemId, quantity: qty });
        }
        droppedItems.push({ name: drop.name, quantity: qty });
      }
    }

    // Log transaction
    const itemText = droppedItems.map((d) => `${d.name} x${d.quantity}`).join(", ");
    await supabase.from("transactions").insert({
      character_id: character.id,
      type: "woodcutting",
      amount: node.gold,
      description: `Gathered ${node.name} (+${node.gold} gold, +${node.xp} XP, ${itemText})`,
      metadata: { node: node.id, xp: node.xp, items: droppedItems },
    });

    await refreshCharacter();
    setGathering(false);
    setSelectedNode(null);
  };

  const availableNodes = woodcuttingNodes.filter((n) => n.requiredTier <= currentTier);
  const lockedNodes = woodcuttingNodes.filter((n) => n.requiredTier > currentTier);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Woodcutting</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Chop trees for resources and gold</p>
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Woodcutting Skill</h2>
        <div className="flex items-center justify-between">
          <span className="text-tribal-100 font-bold text-xl">Tier {currentTier}</span>
          <span className="text-tribal-500 text-sm">XP: {xp} / {currentTier * 100}</span>
        </div>
        <p className="text-tribal-600 text-xs mt-2">
          {currentTier < 5 ? "Chop trees to improve your skill" : "Max tier reached"}
        </p>
      </div>

      <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Trees</h2>
        <div className="space-y-2">
          {availableNodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const canGather = character.computed_stamina >= node.staminaCost;

            return (
              <div
                key={node.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-tribal-800/40 border-tribal-600/30"
                    : "bg-tribal-900/30 border-tribal-800/20 hover:border-tribal-700/30"
                }`}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TreePine size={18} className={canGather ? "text-tribal-500" : "text-tribal-700"} />
                    <div>
                      <span className="text-tribal-200 font-semibold text-sm">{node.name}</span>
                      <p className="text-tribal-600 text-xs">{node.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#4a9e6a] text-xs font-semibold">+{node.gold}g</span>
                    <span className="text-tribal-500 text-xs">+{node.xp}xp</span>
                    <span className="text-tribal-700 text-xs flex items-center gap-1 tabular-nums">
                      <Clock size={10} /> {node.duration}s
                    </span>
                    {!canGather && (
                      <AlertTriangle size={14} className="text-tribal-400/70" />
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-tribal-800/20 animate-fade-in">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-tribal-400">Stamina Cost</span>
                      <span className="text-tribal-200 font-semibold">{node.staminaCost}</span>
                    </div>
                    <Button
                      variant={canGather ? "primary" : "secondary"}
                      size="sm"
                      icon={<TreePine size={14} />}
                      onClick={(e) => { e.stopPropagation(); gatherWood(node); }}
                      loading={gathering}
                      disabled={!canGather}
                    >
                      {canGather ? `Chop (-${node.staminaCost} stamina)` : "Not enough stamina"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {lockedNodes.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Locked Trees</h2>
          <div className="space-y-2">
            {lockedNodes.map((node) => (
              <div key={node.id} className="bg-tribal-900/20 p-4 rounded-lg border border-tribal-800/10 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TreePine size={18} className="text-tribal-700 shrink-0" />
                    <div>
                      <span className="text-tribal-400 font-semibold text-sm">{node.name}</span>
                      <p className="text-tribal-700 text-xs">{node.description}</p>
                    </div>
                  </div>
                  <span className="text-tribal-700 text-xs bg-tribal-900/40 px-2 py-1 rounded border border-tribal-800/10">
                    Tier {node.requiredTier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
