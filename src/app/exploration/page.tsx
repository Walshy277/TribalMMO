"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useCallback } from "react";

const zones = [
  { name: "Forest", color: "text-green-400" },
  { name: "Plains", color: "text-yellow-400" },
  { name: "Riverbank", color: "text-blue-400" },
];

const events = [
  { type: "resource", text: "You found some wood!" },
  { type: "resource", text: "You gathered a handful of herbs." },
  { type: "resource", text: "You discovered a stone deposit." },
  { type: "encounter", text: "A wild boar charges at you!" },
  { type: "encounter", text: "A rival scout appears from the bushes." },
  { type: "flavor", text: "The wind rustles through the trees." },
  { type: "flavor", text: "You hear distant drums echoing across the plains." },
  { type: "weather", text: "Dark clouds gather overhead. Rain begins to fall." },
  { type: "resource", text: "You find a patch of medicinal herbs." },
  { type: "flavor", text: "An eagle soars above you, circling lazily." },
];

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [exploring, setExploring] = useState(false);
  const [encounter, setEncounter] = useState<string | null>(null);
  const [showCombat, setShowCombat] = useState(false);

  const explore = useCallback(async () => {
    if (!character || exploring || character.stamina <= 0) return;

    setExploring(true);

    // Random zone
    const zone = Math.floor(Math.random() * zones.length);
    setCurrentZone(zone);

    // Random event
    const event = events[Math.floor(Math.random() * events.length)];

    // Deduct stamina
    const newStamina = Math.max(0, character.stamina - 5);
    await supabase
      .from("characters")
      .update({ stamina: newStamina })
      .eq("id", character.id);

    setLog((prev) => [`[${zones[zone].name}] ${event.text}`, ...prev].slice(0, 20));

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
    setLog((prev) => ["You rest and recover stamina.", ...prev].slice(0, 20));
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

      setLog((prev) => [`You won the battle! +${xpGain} combat XP`, ...prev].slice(0, 20));
    } else {
      const dmg = Math.max(1, 10 - character.endurance);
      const newStamina = Math.max(0, character.stamina - dmg);
      await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
      setLog((prev) => [`You were defeated. Lost ${dmg} stamina.`, ...prev].slice(0, 20));
    }

    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const staminaPercent = (character.stamina / character.max_stamina) * 100;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>

      {showCombat && (
        <div className="card border-tribal-500 bg-tribal-900/90">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Combat!</h2>
          <p className="text-tribal-300 mb-4">{encounter}</p>
          <p className="text-tribal-400 text-sm mb-4">
            Your stats: STR {character.strength} | AGI {character.agility} | END {character.endurance}
          </p>
          <div className="flex gap-3">
            <button onClick={() => resolveCombat(true)} className="btn-primary">
              Fight
            </button>
            <button onClick={() => resolveCombat(false)} className="btn-secondary">
              Flee
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-tribal-200">
            Current Zone: <span className={zones[currentZone].color}>{zones[currentZone].name}</span>
          </h2>
          <div className="text-sm text-tribal-400">
            Steps: {20 - log.length}
          </div>
        </div>
        <div className="w-full bg-tribal-800 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all ${
              staminaPercent > 50 ? "bg-green-500" : staminaPercent > 25 ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${staminaPercent}%` }}
          />
        </div>
        <p className="text-tribal-400 text-sm mb-4">
          Stamina: {character.stamina} / {character.max_stamina}
        </p>
        <div className="flex gap-3">
          <button
            onClick={explore}
            className="btn-primary"
            disabled={exploring || character.stamina <= 0 || showCombat}
          >
            {exploring ? "Exploring..." : "Explore Forward"}
          </button>
          <button onClick={rest} className="btn-secondary" disabled={showCombat}>
            Rest (+20 stamina)
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-3">Event Log</h2>
        {log.length === 0 ? (
          <p className="text-tribal-400">No events yet. Start exploring!</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {log.map((entry, i) => (
              <p key={i} className="text-tribal-400 text-sm">
                {entry}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
