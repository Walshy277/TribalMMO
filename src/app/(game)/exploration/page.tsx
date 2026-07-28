"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import {
  Map,
  TreePine,
  Wheat,
  Waves,
  Swords,
  LogOut,
  TreeDeciduous,
  Mountain,
  Bug,
  Wind,
  Flower2,
  Bird,
  Flame,
  Leaf,
  Compass,
  Footprints,
  BedDouble,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const zones: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Forest", icon: TreePine, color: "text-[#4a9e6a]" },
  { name: "Plains", icon: Wheat, color: "text-tribal-300" },
  { name: "Riverbank", icon: Waves, color: "text-[#6a90a8]" },
];

const events = [
  { type: "resource", icon: TreeDeciduous, text: "You found some wood!", color: "text-tribal-300" },
  { type: "resource", icon: Leaf, text: "You gathered a handful of herbs.", color: "text-[#4a9e6a]" },
  { type: "resource", icon: Mountain, text: "You discovered a stone deposit.", color: "text-tribal-300" },
  { type: "encounter", icon: Bug, text: "A wild boar charges at you!", color: "text-[#b83a3a]" },
  { type: "encounter", icon: Swords, text: "A rival scout appears from the bushes!", color: "text-[#b83a3a]" },
  { type: "flavor", icon: Wind, text: "The wind rustles through the ancient trees.", color: "text-tribal-400" },
  { type: "flavor", icon: Flame, text: "You hear distant drums echoing across the plains.", color: "text-tribal-300" },
  { type: "resource", icon: Flower2, text: "You find a patch of medicinal herbs.", color: "text-[#aa5a7a]" },
  { type: "flavor", icon: Bird, text: "An eagle soars above you, circling lazily.", color: "text-tribal-300" },
];

type LogEntry = { text: string; icon: LucideIcon; color: string };

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [exploring, setExploring] = useState(false);
  const [showCombat, setShowCombat] = useState(false);
  const [encounter, setEncounter] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<typeof events[number] | null>(null);

  useEffect(() => {
    document.title = "Exploration — TribalMMO";
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const explore = useCallback(async () => {
    if (!character || exploring || character.computed_stamina <= 0) return;

    setExploring(true);

    const zone = Math.floor(Math.random() * zones.length);
    setCurrentZone(zone);
    const event = events[Math.floor(Math.random() * events.length)];
    setLastEvent(event);

    const newStamina = Math.max(0, character.computed_stamina - 5);
    const { error } = await supabase
      .from("characters")
      .update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (error) console.error("Failed to update stamina:", error);

    // Grant Survival XP for exploration
    const survivalSkill = character.skills?.find((s) => s.name === "Survival");
    if (survivalSkill) {
      const xpGain = 3;
      const newXp = survivalSkill.experience + xpGain;
      const maxXP = survivalSkill.tier * 100;
      const newTier = newXp >= maxXP && survivalSkill.tier < 5 ? survivalSkill.tier + 1 : survivalSkill.tier;
      await supabase.from("skills").update({ experience: newXp, tier: newTier }).eq("id", survivalSkill.id);
    }

    // Add items from resource events
    if (event.type === "resource") {
      const resourceMap: Record<string, { name: string; qty: number }> = {
        "You found some wood!": { name: "Wood", qty: 2 },
        "You gathered a handful of herbs.": { name: "Herbs", qty: 1 },
        "You discovered a stone deposit.": { name: "Stone", qty: 2 },
        "You find a patch of medicinal herbs.": { name: "Herbs", qty: 2 },
      };
      const resource = resourceMap[event.text];
      if (resource) {
        const existingItem = await supabase.from("items").select("id").eq("name", resource.name).single();
        let itemId = existingItem.data?.id;
        if (!itemId) {
          const { data: newItem } = await supabase.from("items").insert({ name: resource.name, type: "resource", tier: 1 }).select("id").single();
          itemId = newItem?.id;
        }
        if (itemId) {
          const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", itemId).single();
          if (existingInv.data) {
            await supabase.from("inventory").update({ quantity: existingInv.data.quantity + resource.qty }).eq("id", existingInv.data.id);
          } else {
            await supabase.from("inventory").insert({ character_id: character.id, item_id: itemId, quantity: resource.qty });
          }
        }
      }
    }

    // Small gold reward for exploration
    const goldReward = Math.floor(Math.random() * 3) + 1;
    await supabase.from("characters").update({ gold: character.gold + goldReward }).eq("id", character.id);

    addLog({ text: `[${zones[zone].name}] ${event.text}`, icon: event.icon, color: event.color });

    if (event.type === "encounter") {
      setEncounter(event.text);
      setShowCombat(true);
    }

    await refreshCharacter();
    setExploring(false);
  }, [character, exploring, refreshCharacter, addLog]);

  const rest = async () => {
    if (!character) return;
    const cost = 10;
    if (character.computed_stamina < cost) return;
    const newStamina = Math.min(character.max_stamina, character.computed_stamina - cost + 20);
    const { error } = await supabase
      .from("characters")
      .update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (error) console.error("Failed to update stamina:", error);
    addLog({ text: "You rest by a tree and recover stamina. (-10, +20)", icon: BedDouble, color: "text-[#4a9e6a]" });
    await refreshCharacter();
  };

  const resolveCombat = async (won: boolean) => {
    if (!character) return;
    setShowCombat(false);
    setEncounter(null);

    if (won) {
      const xpGain = 10 + Math.floor(Math.random() * 10);
      const { data: combatSkill } = await supabase
        .from("skills")
        .select("*")
        .eq("character_id", character.id)
        .eq("name", "Combat")
        .single();

      if (combatSkill) {
        await supabase
          .from("skills")
          .update({ experience: combatSkill.experience + xpGain })
          .eq("id", combatSkill.id);
      }

      addLog({ text: "Victory! You defeated the enemy. Combat experience gained.", icon: Flame, color: "text-tribal-300" });
    } else {
      const dmg = Math.max(1, 10 - character.endurance);
      const newStamina = Math.max(0, character.computed_stamina - dmg);
      const { error } = await supabase
        .from("characters")
        .update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() })
        .eq("id", character.id);
      if (error) console.error("Failed to update stamina:", error);
      addLog({ text: `Defeat! You were driven back. -${dmg} Stamina`, icon: LogOut, color: "text-[#b83a3a]" });
    }

    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const zone = zones[currentZone];
  const ZoneIcon = zone.icon;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Venture into the wilds of Nervella</p>
      </div>

      {showCombat && (
        <div className="card border-[#6e2424] animate-fade-in animate-pulse-glow">
          <div className="flex items-center gap-2 mb-3">
            <Swords size={22} className="text-[#b83a3a]" />
            <h2 className="text-lg font-bold text-[#d05050]">Combat Encounter!</h2>
          </div>
          <p className="text-tribal-200 mb-2">{encounter}</p>
          <p className="text-tribal-500 text-sm mb-4">
            Your combat stats: STR {character.strength} · AGI {character.agility} · END {character.endurance}
          </p>
          <div className="flex gap-3">
            <Button variant="danger" className="flex-1" size="lg" icon={<Swords size={18} />} onClick={() => resolveCombat(true)}>
              Fight
            </Button>
            <Button variant="secondary" className="flex-1" size="lg" icon={<LogOut size={18} />} onClick={() => resolveCombat(false)}>
              Flee
            </Button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ZoneIcon size={24} className={zone.color} />
            <div>
              <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Current Zone</div>
              <div className={`text-lg font-bold ${zone.color}`}>{zone.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Steps</div>
            <div className="text-tribal-100 text-lg font-bold flex items-center gap-1 justify-end tabular-nums">
              <Footprints size={16} className="text-tribal-600" />
              {log.length}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="sm" />
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            size="lg"
            icon={<Map size={18} />}
            onClick={explore}
            disabled={exploring || character.computed_stamina <= 0 || showCombat}
            loading={exploring}
          >
            {character.computed_stamina <= 0 ? "No Stamina" : "Explore Forward"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<BedDouble size={18} />}
            onClick={rest}
            disabled={showCombat || character.computed_stamina >= character.max_stamina}
          >
            Rest
          </Button>
        </div>
      </div>

      {lastEvent && (
        <div className="card animate-fade-in">
          <div className="flex items-center gap-3">
            <lastEvent.icon size={20} className={lastEvent.color} />
            <p className={`font-medium ${lastEvent.color}`}>{lastEvent.text}</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Event Log</h2>
        {log.length === 0 ? (
          <div className="text-center py-8">
            <Compass size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">No events yet. Start exploring!</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {log.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg ${i === 0 ? "bg-tribal-800/30" : ""}`}
                >
                  <Icon size={14} className={`mt-0.5 shrink-0 ${entry.color}`} />
                  <p className={`text-sm ${i === 0 ? entry.color + " font-medium" : "text-tribal-500"}`}>
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
