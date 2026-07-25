"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useCallback } from "react";

const zones = [
  { name: "Forest", icon: "🌲", color: "text-green-400", bg: "from-green-900/20" },
  { name: "Plains", icon: "🌾", color: "text-yellow-400", bg: "from-yellow-900/20" },
  { name: "Riverbank", icon: "🌊", color: "text-blue-400", bg: "from-blue-900/20" },
];

const events = [
  { type: "resource", icon: "🪵", text: "You found some wood!", color: "text-amber-400" },
  { type: "resource", icon: "🌿", text: "You gathered a handful of herbs.", color: "text-green-400" },
  { type: "resource", icon: "🪨", text: "You discovered a stone deposit.", color: "text-gray-400" },
  { type: "encounter", icon: "🐗", text: "A wild boar charges at you!", color: "text-red-400" },
  { type: "encounter", icon: "🗡️", text: "A rival scout appears from the bushes!", color: "text-red-400" },
  { type: "flavor", icon: "🍃", text: "The wind rustles through the ancient trees.", color: "text-tribal-400" },
  { type: "flavor", icon: "🥁", text: "You hear distant drums echoing across the plains.", color: "text-tribal-300" },
  { type: "weather", icon: "🌧️", text: "Dark clouds gather overhead. Rain begins to fall.", color: "text-blue-400" },
  { type: "resource", icon: "🌸", text: "You find a patch of medicinal herbs.", color: "text-pink-400" },
  { type: "flavor", icon: "🦅", text: "An eagle soars above you, circling lazily.", color: "text-tribal-300" },
  { type: "resource", icon: "🦴", text: "You uncover old bones half-buried in the dirt.", color: "text-gray-300" },
  { type: "flavor", icon: "🌙", text: "The moon peeks through the clouds above.", color: "text-indigo-300" },
];

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState(0);
  const [log, setLog] = useState<{ text: string; icon: string; color: string }[]>([]);
  const [exploring, setExploring] = useState(false);
  const [showCombat, setShowCombat] = useState(false);
  const [encounter, setEncounter] = useState<string>("");
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
    setLog((prev) => [{ text: "You rest by a tree and recover stamina.", icon: "😴", color: "text-green-400" }, ...prev].slice(0, 30));
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

      setLog((prev) => [{ text: `Victory! You defeated the enemy. +${xpGain} Combat XP`, icon: "🏆", color: "text-yellow-400" }, ...prev].slice(0, 30));
    } else {
      const dmg = Math.max(1, 10 - character.endurance);
      const newStamina = Math.max(0, character.stamina - dmg);
      await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
      setLog((prev) => [{ text: `Defeat! You were driven back. -${dmg} Stamina`, icon: "💀", color: "text-red-400" }, ...prev].slice(0, 30));
    }

    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const staminaPercent = (character.stamina / character.max_stamina) * 100;
  const zone = zones[currentZone];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🗺️</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>
          <p className="text-tribal-500 text-sm">Venture into the wilds of Nervella</p>
        </div>
      </div>

      {/* Combat Modal */}
      {showCombat && (
        <div className="card border-red-700/50 bg-gradient-to-br from-red-950/50 to-tribal-900 animate-fade-in animate-pulse-glow">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⚔️</span>
            <h2 className="text-lg font-bold text-red-300">Combat Encounter!</h2>
          </div>
          <p className="text-tribal-200 mb-2">{encounter}</p>
          <p className="text-tribal-400 text-sm mb-4">
            Your combat stats: STR {character.strength} • AGI {character.agility} • END {character.endurance}
          </p>
          <div className="flex gap-3">
            <button onClick={() => resolveCombat(true)} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors">
              ⚔️ Fight
            </button>
            <button onClick={() => resolveCombat(false)} className="flex-1 btn-secondary py-2.5">
              🏃 Flee
            </button>
          </div>
        </div>
      )}

      {/* Zone & Stamina */}
      <div className={`card border-tribal-600/30 bg-gradient-to-r ${zone.bg} to-transparent`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{zone.icon}</span>
            <div>
              <h2 className="font-semibold text-tribal-200">Current Zone</h2>
              <p className={`text-lg font-bold ${zone.color}`}>{zone.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-tribal-400 text-sm">Steps taken</div>
            <div className="text-tribal-100 text-xl font-bold">{log.length}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-tribal-400 text-xs">Stamina</span>
            <span className="text-tribal-300 text-xs font-medium">{character.stamina} / {character.max_stamina}</span>
          </div>
          <div className="w-full bg-tribal-800/80 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                staminaPercent > 50 ? "bg-gradient-to-r from-green-600 to-green-400" :
                staminaPercent > 25 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" :
                "bg-gradient-to-r from-red-600 to-red-400"
              }`}
              style={{ width: `${staminaPercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={explore}
            className="flex-1 btn-primary py-3 text-lg"
            disabled={exploring || character.stamina <= 0 || showCombat}
          >
            {exploring ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Exploring...
              </span>
            ) : character.stamina <= 0 ? (
              "No Stamina"
            ) : (
              "🗺️ Explore Forward"
            )}
          </button>
          <button
            onClick={rest}
            className="btn-secondary py-3 px-6"
            disabled={showCombat || character.stamina >= character.max_stamina}
          >
            😴 Rest
          </button>
        </div>
      </div>

      {/* Last Event Highlight */}
      {lastEvent && (
        <div className={`card border-tribal-600/20 bg-gradient-to-r from-tribal-800/50 to-transparent animate-fade-in`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lastEvent.icon}</span>
            <p className={`font-medium ${lastEvent.color}`}>{lastEvent.text}</p>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="card border-tribal-600/20">
        <h2 className="text-lg font-semibold text-tribal-200 mb-3 flex items-center gap-2">
          <span>📜</span> Event Log
        </h2>
        {log.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🏕️</div>
            <p className="text-tribal-500">No events yet. Start exploring!</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 py-1.5 px-2 rounded ${i === 0 ? "bg-tribal-800/40" : ""}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-sm mt-0.5">{entry.icon}</span>
                <p className={`text-sm ${i === 0 ? entry.color + " font-medium" : "text-tribal-400"}`}>
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
