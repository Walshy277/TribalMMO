"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Zap, Swords, Axe, Hammer, Building2, Check, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const actionTypes = [
  { type: "training", label: "Train", description: "Hone your combat skills", duration: 300, skill: "Combat", icon: Swords },
  { type: "gathering", label: "Gather Resources", description: "Collect wood, stone, and herbs", duration: 300, skill: "Gathering", icon: Axe },
  { type: "crafting", label: "Craft Item", description: "Create tools and equipment", duration: 600, skill: "Crafting", icon: Hammer },
  { type: "building", label: "Build", description: "Construct settlement buildings", duration: 3600, skill: "Crafting", icon: Building2 },
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
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const now = Date.now();

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Actions</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Craft, train, and build</p>
      </div>

      {/* Active Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider">Active Actions</h2>
          <span className="text-tribal-500 text-xs font-medium bg-tribal-900 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Zap size={12} /> {actions.length} / {maxSlots}
          </span>
        </div>
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="text-tribal-700 mx-auto mb-2" />
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
              const Icon = actionInfo?.icon || Zap;

              return (
                <div key={action.id} className={`bg-tribal-900/50 p-4 rounded-lg border ${isComplete ? "border-green-700/40" : "border-tribal-800/50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-tribal-400" />
                      <span className="text-tribal-200 font-semibold capitalize text-sm">{action.type}</span>
                    </div>
                    {isComplete ? (
                      <Button variant="success" size="sm" icon={<Check size={14} />} onClick={() => completeAction(action.id, action.type)}>
                        Collect
                      </Button>
                    ) : (
                      <span className="text-tribal-500 text-sm font-mono">{remaining}s</span>
                    )}
                  </div>
                  <div className="w-full bg-tribal-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        isComplete ? "bg-green-500" : "bg-tribal-500"
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
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Start New Action</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actionTypes.map((action) => {
            const Icon = action.icon;
            return (
              <div key={action.type} className="bg-tribal-900/50 p-4 rounded-lg border border-tribal-800/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-tribal-800/50 flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-tribal-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-tribal-200">{action.label}</div>
                    <div className="text-sm text-tribal-500 mt-0.5">{action.description}</div>
                    <div className="text-xs text-tribal-600 mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      {action.duration >= 3600 ? `${action.duration / 3600} hour` : `${action.duration / 60} min`}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-3"
                      onClick={() => startAction(action.type, action.duration, action.skill)}
                      disabled={actions.length >= maxSlots}
                    >
                      {actions.length >= maxSlots ? "Slots Full" : "Start"}
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
