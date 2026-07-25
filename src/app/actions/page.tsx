"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const actionTypes = [
  { type: "training", label: "Train", description: "Hone your combat skills", duration: 300, skill: "Combat", icon: "🏋️", color: "hover:border-red-500/40" },
  { type: "gathering", label: "Gather Resources", description: "Collect wood, stone, and herbs", duration: 300, skill: "Gathering", icon: "🪓", color: "hover:border-green-500/40" },
  { type: "crafting", label: "Craft Item", description: "Create tools and equipment", duration: 600, skill: "Crafting", icon: "🔨", color: "hover:border-yellow-500/40" },
  { type: "building", label: "Build", description: "Construct settlement buildings", duration: 3600, skill: "Crafting", icon: "🏗️", color: "hover:border-orange-500/40" },
];

export default function ActionsPage() {
  const { character, refreshCharacter } = useGame();
  const [actions, setActions] = useState<any[]>([]);
  const [maxSlots, setMaxSlots] = useState(1);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (character) {
      fetchActions();
      const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
      setMaxSlots(craftingSkill && craftingSkill.tier >= 2 ? 2 : 1);
    }
  }, [character]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">⚡</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Actions</h1>
          <p className="text-tribal-500 text-sm">Craft, train, and build</p>
        </div>
      </div>

      {/* Active Actions */}
      <div className="card border-tribal-600/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-tribal-200">Active Actions</h2>
          <span className="bg-tribal-800 px-3 py-1 rounded-full text-tribal-300 text-sm">
            {actions.length} / {maxSlots} slots
          </span>
        </div>
        {actions.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">💤</div>
            <p className="text-tribal-500">No active actions. Start one below.</p>
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

              return (
                <div key={action.id} className={`bg-tribal-800/50 p-4 rounded-lg border ${isComplete ? "border-green-600/40" : "border-tribal-700/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{actionInfo?.icon || "⚡"}</span>
                      <span className="text-tribal-200 font-semibold capitalize">{action.type}</span>
                    </div>
                    {isComplete ? (
                      <button
                        onClick={() => completeAction(action.id, action.type)}
                        className="bg-green-700 hover:bg-green-600 text-white font-semibold py-1.5 px-4 rounded-lg transition-colors text-sm"
                      >
                        ✅ Collect
                      </button>
                    ) : (
                      <span className="text-tribal-400 text-sm font-mono">{remaining}s</span>
                    )}
                  </div>
                  <div className="w-full bg-tribal-700/50 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-1000 ${
                        isComplete ? "bg-gradient-to-r from-green-600 to-green-400" : "bg-gradient-to-r from-tribal-600 to-tribal-400"
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

      {/* Available Actions */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Start New Action</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actionTypes.map((action) => (
            <div key={action.type} className={`bg-tribal-800/40 p-4 rounded-lg border border-tribal-700/20 ${action.color} transition-all group`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl group-hover:scale-110 transition-transform">{action.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-tribal-200">{action.label}</div>
                  <div className="text-sm text-tribal-400 mt-0.5">{action.description}</div>
                  <div className="text-xs text-tribal-600 mt-1">
                    {action.duration >= 3600 ? `${action.duration / 3600} hour` : `${action.duration / 60} minutes`}
                  </div>
                  <button
                    onClick={() => startAction(action.type, action.duration, action.skill)}
                    className="btn-primary text-sm mt-3"
                    disabled={actions.length >= maxSlots}
                  >
                    {actions.length >= maxSlots ? "Slots Full" : "Start"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
