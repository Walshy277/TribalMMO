"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const actionTypes = [
  { type: "training", label: "Train", description: "Improve your skills", duration: 300, skill: "Combat" },
  { type: "gathering", label: "Gather Resources", description: "Collect wood, stone, and herbs", duration: 300, skill: "Gathering" },
  { type: "crafting", label: "Craft Item", description: "Create tools and equipment", duration: 600, skill: "Crafting" },
  { type: "building", label: "Build", description: "Construct settlement buildings", duration: 3600, skill: "Crafting" },
];

export default function ActionsPage() {
  const { character, refreshCharacter } = useGame();
  const [actions, setActions] = useState<any[]>([]);
  const [maxSlots, setMaxSlots] = useState(1);

  useEffect(() => {
    if (character) {
      fetchActions();
      const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
      setMaxSlots(craftingSkill && craftingSkill.tier >= 2 ? 2 : 1);
    }
  }, [character]);

  const fetchActions = async () => {
    if (!character) return;
    const { data } = await supabase
      .from("actions")
      .select("*")
      .eq("character_id", character.id)
      .order("completes_at", { ascending: true });
    setActions(data || []);
  };

  const startAction = async (type: string, duration: number, skillName: string) => {
    if (!character || actions.length >= maxSlots) return;

    const completesAt = new Date(Date.now() + duration * 1000).toISOString();

    await supabase.from("actions").insert({
      character_id: character.id,
      type,
      duration,
      completes_at: completesAt,
    });

    // Grant XP for the related skill
    const skill = character.skills?.find((s: any) => s.name === skillName);
    if (skill) {
      const xp = Math.floor(duration / 30);
      await supabase
        .from("skills")
        .update({ experience: skill.experience + xp })
        .eq("id", skill.id);
    }

    await fetchActions();
    await refreshCharacter();
  };

  const completeAction = async (actionId: string, type: string) => {
    if (!character) return;

    await supabase.from("actions").delete().eq("id", actionId);

    if (type === "gathering") {
      const resources = ["Wood", "Stone", "Herbs"];
      const resource = resources[Math.floor(Math.random() * resources.length)];
      const qty = 5 + Math.floor(Math.random() * 10);

      const { data: existing } = await supabase
        .from("inventory")
        .select("*")
        .eq("character_id", character.id)
        .limit(1);

      // For simplicity, add to stamina recovery
      const newStamina = Math.min(character.max_stamina, character.stamina + 10);
      await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
    }

    await fetchActions();
    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Actions</h1>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-tribal-200">Active Actions</h2>
          <span className="text-tribal-400 text-sm">
            {actions.length} / {maxSlots} slots
          </span>
        </div>
        {actions.length === 0 ? (
          <p className="text-tribal-400">No active actions. Start one below.</p>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => {
              const completesAt = new Date(action.completes_at).getTime();
              const progress = Math.min(100, ((now - new Date(action.started_at).getTime()) / (completesAt - new Date(action.started_at).getTime())) * 100);
              const isComplete = now >= completesAt;

              return (
                <div key={action.id} className="bg-tribal-800 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-tribal-200 font-semibold capitalize">{action.type}</span>
                    {isComplete ? (
                      <button
                        onClick={() => completeAction(action.id, action.type)}
                        className="text-sm btn-primary"
                      >
                        Collect
                      </button>
                    ) : (
                      <span className="text-tribal-400 text-sm">
                        {Math.ceil((completesAt - now) / 1000)}s remaining
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-tribal-700 rounded-full h-2 mt-2">
                    <div
                      className="bg-tribal-500 h-2 rounded-full transition-all"
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
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Available Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actionTypes.map((action) => (
            <div key={action.type} className="bg-tribal-800 p-3 rounded">
              <div className="font-semibold text-tribal-200">{action.label}</div>
              <div className="text-sm text-tribal-400">{action.description}</div>
              <div className="text-xs text-tribal-500 mt-1">
                Duration: {action.duration >= 3600 ? `${action.duration / 3600}h` : `${action.duration / 60}m`}
              </div>
              <button
                onClick={() => startAction(action.type, action.duration, action.skill)}
                className="btn-primary text-sm mt-2"
                disabled={actions.length >= maxSlots}
              >
                Start
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
