"use client";

import { useGame } from "@/lib/game";
import { useState } from "react";

const recipes = [
  { name: "Stone Axe", type: "weapon", tier: 1, materials: "3 Wood, 2 Stone", skill: "Crafting" },
  { name: "Wooden Spear", type: "weapon", tier: 1, materials: "4 Wood, 1 Stone", skill: "Crafting" },
  { name: "Hide Armor", type: "armor", tier: 1, materials: "5 Hides, 2 Wood", skill: "Crafting" },
  { name: "Bone Knife", type: "weapon", tier: 1, materials: "3 Bone, 1 Wood", skill: "Crafting" },
  { name: "Herb Poultice", type: "consumable", tier: 1, materials: "3 Herbs", skill: "Crafting" },
  { name: "Stone Hammer", type: "tool", tier: 2, materials: "5 Stone, 3 Wood", skill: "Crafting" },
  { name: "Reinforced Armor", type: "armor", tier: 2, materials: "8 Hides, 4 Stone, 2 Wood", skill: "Crafting" },
  { name: "Bow", type: "weapon", tier: 2, materials: "6 Wood, 2 Hides", skill: "Crafting" },
];

export default function CraftingPage() {
  const { character } = useGame();
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
  const currentTier = craftingSkill?.tier || 1;
  const availableRecipes = recipes.filter((r) => r.tier <= currentTier);
  const lockedRecipes = recipes.filter((r) => r.tier > currentTier);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Crafting</h1>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-2">Crafting Skill</h2>
        <div className="flex justify-between">
          <span className="text-tribal-300">Tier {currentTier}</span>
          <span className="text-tribal-100">{craftingSkill?.experience || 0} XP</span>
        </div>
        <p className="text-tribal-400 text-sm mt-1">
          {currentTier < 2
            ? `Next tier at ${currentTier === 1 ? "100" : "500"} XP`
            : "Max tier reached (MVP)"}
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Available Recipes</h2>
        {availableRecipes.length === 0 ? (
          <p className="text-tribal-400">No recipes available.</p>
        ) : (
          <div className="space-y-2">
            {availableRecipes.map((recipe, i) => (
              <div
                key={i}
                className={`bg-tribal-800 p-3 rounded cursor-pointer transition-colors ${
                  selectedRecipe === i ? "border border-tribal-500" : ""
                }`}
                onClick={() => setSelectedRecipe(selectedRecipe === i ? null : i)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-tribal-200 font-semibold">{recipe.name}</span>
                    <span className="text-tribal-500 text-xs ml-2 capitalize">{recipe.type}</span>
                  </div>
                  <span className="text-tribal-400 text-sm">Tier {recipe.tier}</span>
                </div>
                {selectedRecipe === i && (
                  <div className="mt-2 pt-2 border-t border-tribal-700">
                    <p className="text-tribal-400 text-sm">Materials: {recipe.materials}</p>
                    <button className="btn-primary text-sm mt-2">Craft (Start Action)</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lockedRecipes.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-4">Locked Recipes</h2>
          <div className="space-y-2">
            {lockedRecipes.map((recipe, i) => (
              <div key={i} className="bg-tribal-800 p-3 rounded opacity-50">
                <div className="flex items-center justify-between">
                  <span className="text-tribal-200 font-semibold">{recipe.name}</span>
                  <span className="text-tribal-500 text-sm">Tier {recipe.tier} required</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
