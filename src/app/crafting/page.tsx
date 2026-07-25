"use client";

import { useGame } from "@/lib/game";
import { useState } from "react";

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

const typeColors: Record<string, string> = {
  weapon: "bg-red-900/30 border-red-700/30",
  armor: "bg-blue-900/30 border-blue-700/30",
  consumable: "bg-green-900/30 border-green-700/30",
  tool: "bg-yellow-900/30 border-yellow-700/30",
};

const typeIcons: Record<string, string> = {
  weapon: "⚔️",
  armor: "🛡️",
  consumable: "🧪",
  tool: "🔨",
};

export default function CraftingPage() {
  const { character } = useGame();
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
  const currentTier = craftingSkill?.tier || 1;
  const xp = craftingSkill?.experience || 0;
  const availableRecipes = recipes.filter((r) => r.tier <= currentTier);
  const lockedRecipes = recipes.filter((r) => r.tier > currentTier);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔨</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Crafting</h1>
          <p className="text-tribal-500 text-sm">Create tools, weapons, and more</p>
        </div>
      </div>

      {/* Skill */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-2">Crafting Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-tribal-100 font-bold text-xl">Tier {currentTier}</span>
          <span className="text-tribal-300">{xp} XP</span>
        </div>
        <div className="w-full bg-tribal-800 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-tribal-600 to-tribal-400 h-2.5 rounded-full"
            style={{ width: `${Math.min(100, (xp / (currentTier * 100)) * 100)}%` }}
          />
        </div>
        <p className="text-tribal-500 text-xs mt-2">
          {currentTier < 2 ? `Next tier at ${currentTier === 1 ? "100" : "500"} XP` : "Max tier reached (MVP)"}
        </p>
      </div>

      {/* Available Recipes */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Available Recipes</h2>
        {availableRecipes.length === 0 ? (
          <p className="text-tribal-500">No recipes available.</p>
        ) : (
          <div className="space-y-2">
            {availableRecipes.map((recipe, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedRecipe === i
                    ? `${typeColors[recipe.type]} border-opacity-100`
                    : "bg-tribal-800/40 border-tribal-700/20 hover:border-tribal-500/40"
                }`}
                onClick={() => setSelectedRecipe(selectedRecipe === i ? null : i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeIcons[recipe.type]}</span>
                    <div>
                      <span className="text-tribal-200 font-semibold">{recipe.name}</span>
                      <p className="text-tribal-500 text-xs">{recipe.desc}</p>
                    </div>
                  </div>
                  <span className="text-tribal-500 text-sm bg-tribal-800 px-2 py-1 rounded">Tier {recipe.tier}</span>
                </div>
                {selectedRecipe === i && (
                  <div className="mt-3 pt-3 border-t border-tribal-700/30 animate-fade-in">
                    <p className="text-tribal-400 text-sm mb-2">📋 Materials: {recipe.materials}</p>
                    <button className="btn-primary text-sm">🔨 Craft (Start Action)</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Locked Recipes */}
      {lockedRecipes.length > 0 && (
        <div className="card border-tribal-600/20">
          <h2 className="text-lg font-semibold text-tribal-200 mb-4">Locked Recipes</h2>
          <div className="space-y-2">
            {lockedRecipes.map((recipe, i) => (
              <div key={i} className="bg-tribal-800/30 p-4 rounded-lg border border-tribal-800/30 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl grayscale">{typeIcons[recipe.type]}</span>
                    <div>
                      <span className="text-tribal-300 font-semibold">{recipe.name}</span>
                      <p className="text-tribal-600 text-xs">{recipe.desc}</p>
                    </div>
                  </div>
                  <span className="text-tribal-600 text-sm bg-tribal-900 px-2 py-1 rounded">Tier {recipe.tier}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
