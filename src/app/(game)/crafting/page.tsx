import { useEffect, useState, useCallback } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Hammer, Lock, Clock, AlertTriangle } from "lucide-react";
import { typeIcons } from "@/lib/constants";

interface Material {
  name: string;
  quantity: number;
}

interface Recipe {
  name: string;
  type: string;
  level: number;
  materials: Material[];
  desc: string;
  duration: number;
  resultStats: Record<string, number>;
}

const recipes: Recipe[] = [
  { name: "Stone Axe", type: "weapon", level: 1, materials: [{ name: "Wood", quantity: 3 }, { name: "Stone", quantity: 2 }], desc: "A basic axe for chopping", duration: 600, resultStats: { attack: 3 } },
  { name: "Wooden Spear", type: "weapon", level: 1, materials: [{ name: "Wood", quantity: 4 }, { name: "Stone", quantity: 1 }], desc: "A simple throwing spear", duration: 600, resultStats: { attack: 4 } },
  { name: "Hide Armor", type: "armor", level: 1, materials: [{ name: "Hides", quantity: 5 }, { name: "Wood", quantity: 2 }], desc: "Basic protection from attacks", duration: 900, resultStats: { defense: 3 } },
  { name: "Bone Knife", type: "weapon", level: 1, materials: [{ name: "Bone", quantity: 3 }, { name: "Wood", quantity: 1 }], desc: "A sharp knife for cutting", duration: 600, resultStats: { attack: 2 } },
  { name: "Herb Poultice", type: "resources", level: 1, materials: [{ name: "Herbs", quantity: 3 }], desc: "Restores 30 stamina when used", duration: 300, resultStats: { heal: 30 } },
  { name: "Stone Hammer", type: "materials", level: 2, materials: [{ name: "Stone", quantity: 5 }, { name: "Wood", quantity: 3 }], desc: "A heavy crafting tool", duration: 900, resultStats: { strength: 2 } },
  { name: "Reinforced Armor", type: "armor", level: 2, materials: [{ name: "Hides", quantity: 8 }, { name: "Stone", quantity: 4 }, { name: "Wood", quantity: 2 }], desc: "Sturdy protection", duration: 1800, resultStats: { defense: 7 } },
  { name: "Bow", type: "weapon", level: 2, materials: [{ name: "Wood", quantity: 6 }, { name: "Hides", quantity: 2 }], desc: "A ranged weapon", duration: 1200, resultStats: { attack: 6 } },
  { name: "Copper Pickaxe", type: "materials", level: 2, materials: [{ name: "Copper Ore", quantity: 5 }, { name: "Wood", quantity: 3 }], desc: "A sturdy pickaxe for mining", duration: 1200, resultStats: { strength: 3 } },
  { name: "Iron Sword", type: "weapon", level: 3, materials: [{ name: "Iron Ore", quantity: 8 }, { name: "Coal", quantity: 3 }, { name: "Wood", quantity: 2 }], desc: "A sharp iron blade", duration: 1800, resultStats: { attack: 10 } },
  { name: "Iron Shield", type: "armor", level: 3, materials: [{ name: "Iron Ore", quantity: 10 }, { name: "Coal", quantity: 4 }, { name: "Wood", quantity: 1 }], desc: "Heavy iron protection", duration: 2400, resultStats: { defence: 12 } },
  { name: "Silver Amulet", type: "accessory", level: 3, materials: [{ name: "Silver Ore", quantity: 6 }, { name: "Gemstone", quantity: 1 }], desc: "A mystical silver amulet", duration: 2000, resultStats: { speed: 8, vitality: 4 } },
  { name: "Steel Platebody", type: "armor", level: 4, materials: [{ name: "Iron Ore", quantity: 15 }, { name: "Coal", quantity: 8 }, { name: "Silver Ore", quantity: 3 }], desc: "Masterwork steel armor", duration: 3600, resultStats: { defence: 18, vitality: 6 } },
  { name: "Gold Ring", type: "accessory", level: 4, materials: [{ name: "Gold Ore", quantity: 5 }, { name: "Silver Ore", quantity: 3 }, { name: "Gemstone", quantity: 2 }], desc: "A ring of pure gold", duration: 3000, resultStats: { speed: 10, vitality: 5 } },
  { name: "Diamond Dagger", type: "weapon", level: 5, materials: [{ name: "Iron Ore", quantity: 10 }, { name: "Diamond", quantity: 1 }, { name: "Gold Ore", quantity: 3 }], desc: "A legendary diamond-tipped blade", duration: 4800, resultStats: { attack: 25, speed: 8 } },
];

export default function CraftingPage() {
  const { character, refreshCharacter } = useGame();
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    document.title = "Crafting — TribalMMO";
  }, []);

  const buildInventoryMap = useCallback(() => {
    if (!character?.inventory) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const inv of character.inventory) {
      if (inv.item) {
        const current = map.get(inv.item.name) || 0;
        map.set(inv.item.name, current + inv.quantity);
      }
    }
    return map;
  }, [character?.inventory]);

  useEffect(() => {
    setInventoryItems(buildInventoryMap());
  }, [buildInventoryMap]);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
  const currentLevel = craftingSkill?.level || 1;
  const xp = craftingSkill?.experience || 0;
  const availableRecipes = recipes.filter((r) => r.level <= currentLevel);
  const lockedRecipes = recipes.filter((r) => r.level > currentLevel);

  const hasMaterials = (recipe: Recipe): boolean => {
    const staminaCost = 10 + recipe.level * 5;
    return recipe.materials.every((mat) => (inventoryItems.get(mat.name) || 0) >= mat.quantity) && character.computed_stamina >= staminaCost;
  };

  const getMaterialStatus = (recipe: Recipe) => {
    return recipe.materials.map((mat) => ({
      ...mat,
      available: inventoryItems.get(mat.name) || 0,
      sufficient: (inventoryItems.get(mat.name) || 0) >= mat.quantity,
    }));
  };

  const craftItem = async (recipe: Recipe) => {
    if (!craftingSkill || crafting) return;
    if (!hasMaterials(recipe)) return;

    const staminaCost = 10 + recipe.level * 5;
    if (character.computed_stamina < staminaCost) return;

    setCrafting(true);

    const { error: staminaError } = await supabase
      .from("characters")
      .update({ stamina: Math.max(0, character.computed_stamina - staminaCost), stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (staminaError) { setCrafting(false); return; }

    for (const mat of recipe.materials) {
      const item = character.inventory.find((inv) => inv.item?.name === mat.name);
      if (!item) continue;

      const newQty = item.quantity - mat.quantity;
      if (newQty <= 0) {
        await supabase.from("inventory").delete().eq("id", item.id);
      } else {
        await supabase.from("inventory").update({ quantity: newQty }).eq("id", item.id);
      }
    }

    const completesAt = new Date(Date.now() + recipe.duration * 1000).toISOString();
    await supabase.from("actions").insert({
      character_id: character.id,
      type: "crafting",
      duration: recipe.duration,
      completes_at: completesAt,
      result: { item_name: recipe.name, item_type: recipe.type, item_stats: recipe.resultStats, level: recipe.level },
    });

    const xpGain = Math.floor(recipe.duration / 30);
    const newXp = craftingSkill.experience + xpGain;
    const maxXP = craftingSkill.level * 100;
    const newLevel = newXp >= maxXP && craftingSkill.level < 100 ? craftingSkill.level + 1 : craftingSkill.level;

    await supabase
      .from("skills")
      .update({ experience: newXp, level: newLevel })
      .eq("id", craftingSkill.id);

    await refreshCharacter();
    setCrafting(false);
    setSelectedRecipe(null);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Crafting</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Create tools, weapons, and more</p>
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Crafting Skill</h2>
        <div className="flex items-center justify-between">
          <span className="text-tribal-100 font-bold text-xl">Level {currentLevel}</span>
          <span className="text-tribal-500 text-sm">Crafting</span>
        </div>
        <p className="text-tribal-600 text-xs mt-2">
          {currentLevel < 100 ? "Complete actions to improve your skill" : "Max level reached"}
        </p>
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Available Recipes</h2>
        {availableRecipes.length === 0 ? (
          <p className="text-tribal-600">No recipes available.</p>
        ) : (
          <div className="space-y-2">
            {availableRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              const isSelected = selectedRecipe === i;
              const canCraft = hasMaterials(recipe);
              const matStatus = getMaterialStatus(recipe);

              return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-tribal-800/40 border-tribal-600/30"
                      : "bg-tribal-900/30 border-tribal-800/20 hover:border-tribal-700/30"
                  }`}
                  onClick={() => setSelectedRecipe(isSelected ? null : i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={canCraft ? "text-tribal-500" : "text-tribal-700"} />
                      <div>
                        <span className="text-tribal-200 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-tribal-600 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-tribal-700 text-xs flex items-center gap-1 tabular-nums">
                        <Clock size={10} /> {recipe.duration >= 3600 ? `${recipe.duration / 3600}h` : `${recipe.duration / 60}m`}
                      </span>
                      <span className="text-tribal-700 text-xs bg-tribal-900/60 px-2 py-1 rounded border border-tribal-800/20">Level {recipe.level}</span>
                      {!canCraft && (
                        <AlertTriangle size={14} className="text-tribal-400/70" />
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-tribal-800/20 animate-fade-in">
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs font-bold text-tribal-400 uppercase tracking-wider">Materials Required</p>
                        {matStatus.map((mat, mi) => (
                          <div key={mi} className="flex items-center justify-between text-sm">
                            <span className="text-tribal-300">{mat.name}</span>
                            <span className={`font-mono tabular-nums ${mat.sufficient ? "text-[#4a9e6a]" : "text-[#b83a3a]"}`}>
                              {mat.available} / {mat.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs font-bold text-tribal-400 uppercase tracking-wider">Result Stats</p>
                        {Object.entries(recipe.resultStats).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-tribal-300 capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-tribal-100 font-semibold">+{val}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant={canCraft ? "primary" : "secondary"}
                        size="sm"
                        icon={<Hammer size={14} />}
                        onClick={(e) => { e.stopPropagation(); craftItem(recipe); }}
                        loading={crafting}
                        disabled={!canCraft}
                      >
                        {canCraft ? `Craft (-${10 + recipe.level * 5} stamina)` : character.computed_stamina < 10 + recipe.level * 5 ? "Not enough stamina" : "Missing Materials"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lockedRecipes.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Locked Recipes</h2>
          <div className="space-y-2">
            {lockedRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              return (
                <div key={i} className="bg-tribal-900/20 p-4 rounded-lg border border-tribal-800/10 opacity-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-tribal-700 shrink-0" />
                      <div>
                        <span className="text-tribal-400 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-tribal-700 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <span className="text-tribal-700 text-xs bg-tribal-900/40 px-2 py-1 rounded flex items-center gap-1 border border-tribal-800/10">
                       <Lock size={10} /> Level {recipe.level}
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
