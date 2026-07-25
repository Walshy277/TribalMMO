"use client";

import { useGame } from "@/lib/game";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Hammer, Swords, Shield, FlaskConical, Lock, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const recipes = [
  { name: "Stone Axe", type: "weapon", tier: 1, materials: "3 Wood, 2 Stone", desc: "A basic axe for chopping" },
  { name: "Wooden Spear", type: "weapon", tier: 1, materials: "4 Wood, 1 Stone", desc: "A simple throwing spear" },
  { name: "Hide Armor", type: "armor", tier: 1, materials: "5 Hides, 2 Wood", desc: "Basic protection from attacks" },
  { name: "Bone Knife", type: "weapon", tier: 1, materials: "3 Bone, 1 Wood", desc: "A sharp knife for cutting" },
  { name: "Herb Poultice", type: "consumable", tier: 1, materials: "3 Herbs", desc: "Restores stamina" },
  { name: "Stone Hammer", type: "tool", tier: 2, materials: "5 Stone, 3 Wood", desc: "A heavy crafting tool" },
  { name: "Reinforced Armor", type: "armor", tier: 2, materials: "8 Hides, 4 Stone, 2 Wood", desc: "Sturdy protection" },
  { name: "Bow", type: "weapon", tier: 2, materials: "6 Wood, 2 Hides", desc: "A ranged weapon" },
];

const typeIcons: Record<string, LucideIcon> = { weapon: Swords, armor: Shield, consumable: FlaskConical, tool: Hammer };

export default function CraftingPage() {
  const { character } = useGame();
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
  const currentTier = craftingSkill?.tier || 1;
  const xp = craftingSkill?.experience || 0;
  const availableRecipes = recipes.filter((r) => r.tier <= currentTier);
  const lockedRecipes = recipes.filter((r) => r.tier > currentTier);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Crafting</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Create tools, weapons, and more</p>
      </div>

      {/* Skill */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-3">Crafting Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-tribal-100 font-bold text-xl">Tier {currentTier}</span>
          <span className="text-tribal-300 text-sm">{xp} XP</span>
        </div>
        <div className="w-full bg-tribal-800 rounded-full h-2">
          <div
            className="bg-tribal-500 h-2 rounded-full"
            style={{ width: `${Math.min(100, (xp / (currentTier * 100)) * 100)}%` }}
          />
        </div>
        <p className="text-tribal-600 text-xs mt-2">
          {currentTier < 2 ? `Next tier at ${currentTier === 1 ? "100" : "500"} XP` : "Max tier reached (MVP)"}
        </p>
      </div>

      {/* Available Recipes */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Available Recipes</h2>
        {availableRecipes.length === 0 ? (
          <p className="text-tribal-500">No recipes available.</p>
        ) : (
          <div className="space-y-2">
            {availableRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedRecipe === i
                      ? "bg-tribal-800 border-tribal-600/50"
                      : "bg-tribal-900/50 border-tribal-800/50 hover:border-tribal-700/50"
                  }`}
                  onClick={() => setSelectedRecipe(selectedRecipe === i ? null : i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-tribal-400 shrink-0" />
                      <div>
                        <span className="text-tribal-200 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-tribal-500 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <span className="text-tribal-600 text-xs bg-tribal-800 px-2 py-1 rounded">Tier {recipe.tier}</span>
                  </div>
                  {selectedRecipe === i && (
                    <div className="mt-3 pt-3 border-t border-tribal-700/30 animate-fade-in">
                      <p className="text-tribal-400 text-sm mb-2">Materials: {recipe.materials}</p>
                      <Button variant="primary" size="sm" icon={<Hammer size={14} />}>Craft (Start Action)</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Locked Recipes */}
      {lockedRecipes.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Locked Recipes</h2>
          <div className="space-y-2">
            {lockedRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              return (
                <div key={i} className="bg-tribal-900/30 p-4 rounded-lg border border-tribal-800/30 opacity-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-tribal-600 shrink-0" />
                      <div>
                        <span className="text-tribal-300 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-tribal-600 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <span className="text-tribal-600 text-xs bg-tribal-900 px-2 py-1 rounded flex items-center gap-1">
                      <Lock size={10} /> Tier {recipe.tier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
