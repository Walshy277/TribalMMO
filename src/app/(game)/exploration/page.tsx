"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
  Map,
  TreePine,
  Wheat,
  Waves,
  Swords,
  LogOut,
  TreeDeciduous,
  Mountain,
  Droplets,
  Bug,
  Wind,
  CloudRain,
  Flower2,
  Bird,
  Moon,
  Footprints,
  BedDouble,
  Flame,
  Leaf,
  Compass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const zones: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Forest", icon: TreePine, color: "text-green-400" },
  { name: "Plains", icon: Wheat, color: "text-yellow-400" },
  { name: "Riverbank", icon: Waves, color: "text-blue-400" },
];

const events = [
  { type: "resource", icon: TreeDeciduous, text: "You found some wood!", color: "text-amber-400" },
  { type: "resource", icon: Leaf, text: "You gathered a handful of herbs.", color: "text-green-400" },
  { type: "resource", icon: Mountain, text: "You discovered a stone deposit.", color: "text-gray-400" },
  { type: "encounter", icon: Bug, text: "A wild boar charges at you!", color: "text-red-400" },
  { type: "encounter", icon: Swords, text: "A rival scout appears from the bushes!", color: "text-red-400" },
  { type: "flavor", icon: Wind, text: "The wind rustles through the ancient trees.", color: "text-tribal-400" },
  { type: "flavor", icon: Flame, text: "You hear distant drums echoing across the plains.", color: "text-tribal-300" },
  { type: "weather", icon: CloudRain, text: "Dark clouds gather overhead. Rain begins to fall.", color: "text-blue-400" },
  { type: "resource", icon: Flower2, text: "You find a patch of medicinal herbs.", color: "text-pink-400" },
  { type: "flavor", icon: Bird, text: "An eagle soars above you, circling lazily.", color: "text-tribal-300" },
];

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState(0);
  const [log, setLog] = useState<{ text: string; icon: LucideIcon; color: string }[]>([]);
  const [exploring, setExploring] = useState(false);
  const [showCombat, setShowCombat] = useState(false);
  const [encounter, setEncounter] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<typeof events[0] | null>(null);

  const explore = useCallback(async () => {
    if (!character || exploring || character.stamina <= 0) return;

    setExploring(true);

    const zone = Math.floor(Math.random() * zones.length);
    setCurrentZone(zone);
    const event = events[Math.floor(Math.random() * events.length)];
    setLastEvent(event);

    const newStamina = Math.max(0, character.stamina - 5);
    await supabase
      .from("characters")
      .update({ stamina: newStamina })
      .eq("id", character.id);

    setLog((prev) => [{ text: `[${zones[zone].name}] ${event.text}`, icon: event.icon, color: event.color }, ...prev].slice(0, 30));

    if (event.type === "encounter") {
      setEncounter(event.text);
      setShowCombat(true);
    }

    await refreshCharacter();
    setExploring(false);
  }, [character, exploring, refreshCharacter]);

  const rest = async () => {
    if (!character) return;
    const newStamina = Math.min(character.max_stamina, character.stamina + 20);
    await supabase
      .from("characters")
      .update({ stamina: newStamina })
      .eq("id", character.id);
    setLog((prev) => [{ text: "You rest by a tree and recover stamina.", icon: BedDouble, color: "text-green-400" }, ...prev].slice(0, 30));
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

      setLog((prev) => [{ text: `Victory! You defeated the enemy. +${xpGain} Combat XP`, icon: Flame, color: "text-yellow-400" }, ...prev].slice(0, 30));
    } else {
      const dmg = Math.max(1, 10 - character.endurance);
      const newStamina = Math.max(0, character.stamina - dmg);
      await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
      setLog((prev) => [{ text: `Defeat! You were driven back. -${dmg} Stamina`, icon: LogOut, color: "text-red-400" }, ...prev].slice(0, 30));
    }

    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const staminaPercent = (character.stamina / character.max_stamina) * 100;
  const zone = zones[currentZone];
  const ZoneIcon = zone.icon;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Venture into the wilds of Nervella</p>
      </div>

      {/* Combat Modal */}
      {showCombat && (
        <div className="card border-red-700/40 animate-fade-in animate-pulse-glow">
          <div className="flex items-center gap-2 mb-3">
            <Swords size={22} className="text-red-400" />
            <h2 className="text-lg font-bold text-red-300">Combat Encounter!</h2>
          </div>
          <p className="text-tribal-200 mb-2">{encounter}</p>
          <p className="text-tribal-400 text-sm mb-4">
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

      {/* Zone & Stamina */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ZoneIcon size={24} className={zone.color} />
            <div>
              <div className="text-tribal-500 text-xs uppercase font-medium">Current Zone</div>
              <div className={`text-lg font-bold ${zone.color}`}>{zone.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-tribal-500 text-xs uppercase font-medium">Steps</div>
            <div className="text-tribal-100 text-lg font-bold flex items-center gap-1 justify-end">
              <Footprints size={16} className="text-tribal-500" />
              {log.length}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-tribal-500 text-xs">Stamina</span>
            <span className="text-tribal-300 text-xs font-medium">{character.stamina} / {character.max_stamina}</span>
          </div>
          <div className="w-full bg-tribal-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                staminaPercent > 50 ? "bg-green-500" :
                staminaPercent > 25 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
              style={{ width: `${staminaPercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            size="lg"
            icon={<Map size={18} />}
            onClick={explore}
            disabled={exploring || character.stamina <= 0 || showCombat}
            loading={exploring}
          >
            {character.stamina <= 0 ? "No Stamina" : "Explore Forward"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<BedDouble size={18} />}
            onClick={rest}
            disabled={showCombat || character.stamina >= character.max_stamina}
          >
            Rest
          </Button>
        </div>
      </div>

      {/* Last Event */}
      {lastEvent && (
        <div className="card animate-fade-in">
          <div className="flex items-center gap-3">
            <lastEvent.icon size={20} className={lastEvent.color} />
            <p className={`font-medium ${lastEvent.color}`}>{lastEvent.text}</p>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-3">Event Log</h2>
        {log.length === 0 ? (
          <div className="text-center py-8">
            <Compass size={32} className="text-tribal-700 mx-auto mb-2" />
            <p className="text-tribal-500">No events yet. Start exploring!</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {log.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg ${i === 0 ? "bg-tribal-800/50" : ""}`}
                >
                  <Icon size={14} className={`mt-0.5 shrink-0 ${entry.color}`} />
                  <p className={`text-sm ${i === 0 ? entry.color + " font-medium" : "text-tribal-400"}`}>
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
