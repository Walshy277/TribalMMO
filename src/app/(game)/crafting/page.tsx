import { useEffect, useState, useCallback } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Hammer, Lock, Clock, AlertTriangle, Sparkles, Star, ChevronDown, ChevronUp } from "lucide-react";
import { typeIcons, xpForLevel, MAX_SKILL_LEVEL, rarityColors, rarityNames } from "@/lib/constants";
import { rollQuality, rollStat, rangeInt, chance, type QualityRoll } from "@/lib/rng";

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
  statVariance: number;
  bonusSlots: number;
}

const GOLD_COSTS: Record<number, number> = { 1: 1, 2: 3, 3: 8, 4: 15, 5: 25, 6: 40 };

const BONUS_EFFECTS = [
  { name: "Lifesteal", desc: "Heal 1-3 HP on hit", stat: "lifesteal", min: 1, max: 3 },
  { name: "Thorns", desc: "Reflect 1-3 damage", stat: "thorns", min: 1, max: 3 },
  { name: "Quickness", desc: "+1-3 Speed", stat: "speed", min: 1, max: 3 },
  { name: "Fortitude", desc: "+1-3 Vitality", stat: "vitality", min: 1, max: 3 },
  { name: "Precision", desc: "+1-3 Accuracy", stat: "accuracy", min: 1, max: 3 },
  { name: "Block", desc: "+1-3 Block chance", stat: "block", min: 1, max: 3 },
];

const recipes: Recipe[] = [
  { name: "Stone Axe", type: "weapon", level: 1, materials: [{ name: "Wood", quantity: 3 }, { name: "Stone", quantity: 2 }], desc: "A basic axe for chopping", duration: 600, resultStats: { attack: 3 }, statVariance: 2, bonusSlots: 0 },
  { name: "Wooden Spear", type: "weapon", level: 1, materials: [{ name: "Wood", quantity: 4 }, { name: "Stone", quantity: 1 }], desc: "A simple throwing spear", duration: 600, resultStats: { attack: 4 }, statVariance: 2, bonusSlots: 0 },
  { name: "Hide Armor", type: "armor", level: 1, materials: [{ name: "Hides", quantity: 5 }, { name: "Wood", quantity: 2 }], desc: "Basic protection from attacks", duration: 900, resultStats: { defense: 3 }, statVariance: 2, bonusSlots: 0 },
  { name: "Bone Knife", type: "weapon", level: 1, materials: [{ name: "Bone", quantity: 3 }, { name: "Wood", quantity: 1 }], desc: "A sharp knife for cutting", duration: 600, resultStats: { attack: 2 }, statVariance: 2, bonusSlots: 0 },
  { name: "Herb Poultice", type: "resources", level: 1, materials: [{ name: "Herbs", quantity: 3 }], desc: "Restores stamina when used", duration: 300, resultStats: { heal: 30 }, statVariance: 10, bonusSlots: 0 },
  { name: "Stone Hammer", type: "materials", level: 2, materials: [{ name: "Stone", quantity: 5 }, { name: "Wood", quantity: 3 }], desc: "A heavy crafting tool", duration: 900, resultStats: { strength: 2 }, statVariance: 2, bonusSlots: 0 },
  { name: "Reinforced Armor", type: "armor", level: 2, materials: [{ name: "Hides", quantity: 8 }, { name: "Stone", quantity: 4 }, { name: "Wood", quantity: 2 }], desc: "Sturdy protection", duration: 1800, resultStats: { defense: 7 }, statVariance: 3, bonusSlots: 0 },
  { name: "Bow", type: "weapon", level: 2, materials: [{ name: "Wood", quantity: 6 }, { name: "Hides", quantity: 2 }], desc: "A ranged weapon", duration: 1200, resultStats: { attack: 6 }, statVariance: 3, bonusSlots: 0 },
  { name: "Copper Pickaxe", type: "materials", level: 2, materials: [{ name: "Copper Ore", quantity: 5 }, { name: "Wood", quantity: 3 }], desc: "A sturdy pickaxe for mining", duration: 1200, resultStats: { strength: 3 }, statVariance: 2, bonusSlots: 0 },
  { name: "Iron Sword", type: "weapon", level: 3, materials: [{ name: "Iron Ore", quantity: 8 }, { name: "Coal", quantity: 3 }, { name: "Wood", quantity: 2 }], desc: "A sharp iron blade", duration: 1800, resultStats: { attack: 10 }, statVariance: 4, bonusSlots: 1 },
  { name: "Iron Shield", type: "armor", level: 3, materials: [{ name: "Iron Ore", quantity: 10 }, { name: "Coal", quantity: 4 }, { name: "Wood", quantity: 1 }], desc: "Heavy iron protection", duration: 2400, resultStats: { defence: 12 }, statVariance: 4, bonusSlots: 1 },
  { name: "Silver Amulet", type: "accessory", level: 3, materials: [{ name: "Silver Ore", quantity: 6 }, { name: "Gemstone", quantity: 1 }], desc: "A mystical silver amulet", duration: 2000, resultStats: { speed: 8, vitality: 4 }, statVariance: 3, bonusSlots: 1 },
  { name: "Steel Platebody", type: "armor", level: 4, materials: [{ name: "Iron Ore", quantity: 15 }, { name: "Coal", quantity: 8 }, { name: "Silver Ore", quantity: 3 }], desc: "Masterwork steel armor", duration: 3600, resultStats: { defence: 18, vitality: 6 }, statVariance: 5, bonusSlots: 1 },
  { name: "Gold Ring", type: "accessory", level: 4, materials: [{ name: "Gold Ore", quantity: 5 }, { name: "Silver Ore", quantity: 3 }, { name: "Gemstone", quantity: 2 }], desc: "A ring of pure gold", duration: 3000, resultStats: { speed: 10, vitality: 5 }, statVariance: 4, bonusSlots: 1 },
  { name: "Diamond Dagger", type: "weapon", level: 5, materials: [{ name: "Iron Ore", quantity: 10 }, { name: "Diamond", quantity: 1 }, { name: "Gold Ore", quantity: 3 }], desc: "A legendary diamond-tipped blade", duration: 4800, resultStats: { attack: 25, speed: 8 }, statVariance: 6, bonusSlots: 2 },
  { name: "Phoenix Amulet", type: "accessory", level: 5, materials: [{ name: "Gold Ore", quantity: 8 }, { name: "Diamond", quantity: 1 }, { name: "Gemstone", quantity: 3 }, { name: "Silver Ore", quantity: 4 }], desc: "An amulet of rebirth", duration: 6000, resultStats: { vitality: 12, speed: 8, defence: 4 }, statVariance: 5, bonusSlots: 2 },
  { name: "Berserker Axe", type: "weapon", level: 6, materials: [{ name: "Iron Ore", quantity: 20 }, { name: "Coal", quantity: 10 }, { name: "Gold Ore", quantity: 5 }, { name: "Diamond", quantity: 2 }], desc: "An axe that thirsts for battle", duration: 7200, resultStats: { attack: 35, strength: 8 }, statVariance: 8, bonusSlots: 2 },
  { name: "Guardian Plate", type: "armor", level: 6, materials: [{ name: "Iron Ore", quantity: 25 }, { name: "Coal", quantity: 12 }, { name: "Silver Ore", quantity: 8 }, { name: "Diamond", quantity: 1 }], desc: "Impenetrable plate armor", duration: 7200, resultStats: { defence: 28, vitality: 10 }, statVariance: 8, bonusSlots: 2 },
];

const QUALITY_GLOW: Record<string, string> = {
  "Crude": "rgba(110,101,108,0.15)",
  "Simple": "rgba(138,127,138,0.15)",
  "Standard": "rgba(160,208,160,0.12)",
  "Fine": "rgba(106,144,168,0.15)",
  "Superior": "rgba(138,106,170,0.2)",
  "Masterwork": "rgba(201,168,76,0.25)",
  "Legendary": "rgba(232,80,80,0.3)",
};

export default function CraftingPage() {
  const { character, refreshCharacter } = useGame();
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Map<string, number>>(new Map());
  const [lastCraftResult, setLastCraftResult] = useState<{ recipe: string; quality: QualityRoll; stats: Record<string, number>; bonusEffects: { name: string; desc: string }[] } | null>(null);

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
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
  const currentLevel = craftingSkill?.level || 1;
  const xp = craftingSkill?.experience || 0;
  const xpForCurrent = xpForLevel(currentLevel);
  const xpForNext = xpForLevel(Math.min(currentLevel + 1, MAX_SKILL_LEVEL));
  const xpIntoLevel = xp - xpForCurrent;
  const xpGap = xpForNext - xpForCurrent;
  const xpPercent = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
  const availableRecipes = recipes.filter((r) => r.level <= currentLevel);
  const lockedRecipes = recipes.filter((r) => r.level > currentLevel);
  const getGoldCost = (level: number) => GOLD_COSTS[level] || 0;

  const hasMaterials = (recipe: Recipe): boolean => {
    const staminaCost = 10 + recipe.level * 5;
    return recipe.materials.every((mat) => (inventoryItems.get(mat.name) || 0) >= mat.quantity)
      && character.computed_stamina >= staminaCost
      && character.gold >= getGoldCost(recipe.level);
  };

  const getMaterialStatus = (recipe: Recipe) => {
    return recipe.materials.map((mat) => ({
      ...mat,
      available: inventoryItems.get(mat.name) || 0,
      sufficient: (inventoryItems.get(mat.name) || 0) >= mat.quantity,
    }));
  };

  const rollBonusEffects = (slots: number, quality: QualityRoll): { name: string; desc: string; stat: string; value: number }[] => {
    if (slots <= 0) return [];
    const numEffects = Math.min(slots, quality.multiplier >= 2 ? 2 : quality.multiplier >= 1.25 ? 1 : 0);
    if (numEffects <= 0) return [];
    const shuffled = [...BONUS_EFFECTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numEffects).map((e) => ({
      name: e.name,
      desc: e.desc,
      stat: e.stat,
      value: rangeInt(e.min, e.max),
    }));
  };

  const craftItem = async (recipe: Recipe) => {
    if (crafting) return;
    if (!hasMaterials(recipe)) return;
    const staminaCost = 10 + recipe.level * 5;
    if (character.computed_stamina < staminaCost) return;

    setCrafting(true);
    setLastCraftResult(null);

    const quality = rollQuality(currentLevel);
    const rolledStats: Record<string, number> = {};
    for (const [key, val] of Object.entries(recipe.resultStats)) {
      rolledStats[key] = rollStat(val, quality);
    }
    const bonusEffects = rollBonusEffects(recipe.bonusSlots, quality);
    for (const effect of bonusEffects) {
      rolledStats[effect.stat] = (rolledStats[effect.stat] || 0) + effect.value;
    }

    const materials = recipe.materials.map((m) => ({ name: m.name, quantity: m.quantity }));
    const qualityLabel = quality.label;
    const itemName = `${qualityLabel} ${recipe.name}`;
    const itemRarity = Math.min(7, recipe.level + (quality.multiplier >= 2 ? 3 : quality.multiplier >= 1.25 ? 1 : 0));

    const { data, error } = await supabase.rpc("craft_item_rpc", {
      p_character_id: character.id,
      p_item_name: itemName,
      p_item_type: recipe.type,
      p_item_rarity: itemRarity,
      p_item_stats: rolledStats,
      p_duration: recipe.duration,
      p_materials: materials,
    });

    if (error || (data && typeof data === "object" && "error" in data)) {
      setCrafting(false);
      return;
    }

    setLastCraftResult({
      recipe: recipe.name,
      quality,
      stats: rolledStats,
      bonusEffects: bonusEffects.map((e) => ({ name: e.name, desc: e.desc })),
    });

    await refreshCharacter();
    setCrafting(false);
    setSelectedRecipe(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Crafting</h1>
        <p className="text-slate-500 text-sm mt-0.5">Create tools, weapons, and more — quality varies by skill and luck</p>
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Crafting Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-100 font-bold text-xl">Level {currentLevel}</span>
          <span className="text-slate-500 text-sm tabular-nums">{xpIntoLevel.toLocaleString()} / {xpGap.toLocaleString()} XP</span>
        </div>
        <div className="w-full bg-slate-900/60 rounded-full h-2.5 mb-2">
          <div className="bg-[#4a9e6a] h-2.5 rounded-full transition-all duration-300" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {lastCraftResult && (
        <div className="card animate-fade-in" style={{ background: QUALITY_GLOW[lastCraftResult.quality.label] || "rgba(18,42,27,0.3)", borderColor: lastCraftResult.quality.color + "40" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: lastCraftResult.quality.color }}>
              <Sparkles size={14} className="inline mr-1.5" />
              Crafted: {lastCraftResult.quality.label} {lastCraftResult.recipe}
            </h2>
            <button onClick={() => setLastCraftResult(null)} className="text-slate-600 hover:text-slate-400 text-xs">dismiss</button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider" style={{ background: lastCraftResult.quality.color + "20", color: lastCraftResult.quality.color }}>
              {lastCraftResult.quality.label}
            </span>
            <span className="text-slate-500 text-xs">Quality: {Math.floor(lastCraftResult.quality.multiplier * 100)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(lastCraftResult.stats).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between bg-slate-900/40 rounded px-2 py-1">
                <span className="text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                <span className="text-slate-100 font-semibold">+{val}</span>
              </div>
            ))}
          </div>
          {lastCraftResult.bonusEffects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {lastCraftResult.bonusEffects.map((e, i) => (
                <span key={i} className="text-[10px] text-[#c9a84c] bg-[#c9a84c]10 px-2 py-0.5 rounded-full border border-[#c9a84c]20">{e.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
          Available Recipes
          <span className="text-slate-600 font-normal ml-2 text-[10px]">(quality varies by level & luck)</span>
        </h2>
        {availableRecipes.length === 0 ? (
          <p className="text-slate-600">No recipes available.</p>
        ) : (
          <div className="space-y-2">
            {availableRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              const isSelected = selectedRecipe === i;
              const canCraft = hasMaterials(recipe);
              const matStatus = getMaterialStatus(recipe);
              return (
                <div key={i} className="p-4 rounded-lg border border-slate-800/20 bg-slate-900/30 hover:bg-slate-900/50 transition-all">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedRecipe(isSelected ? null : i)}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={canCraft ? "text-slate-500" : "text-slate-700"} />
                      <div>
                        <span className="text-slate-200 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-slate-600 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 text-xs flex items-center gap-1 tabular-nums">
                        <Clock size={10} /> {recipe.duration >= 3600 ? (recipe.duration / 3600).toFixed(1) + "h" : recipe.duration / 60 + "m"}
                      </span>
                      <span className="text-slate-700 text-xs bg-slate-900/60 px-2 py-1 rounded border border-slate-800/20">Level {recipe.level}</span>
                      {!canCraft && <AlertTriangle size={14} className="text-slate-400/70" />}
                      {isSelected ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-slate-800/20 animate-fade-in">
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Materials Required</p>
                        {matStatus.map((mat, mi) => (
                          <div key={mi} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">{mat.name}</span>
                            <span className="font-mono tabular-nums">{mat.available} / {mat.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mb-4 p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gold Cost</span>
                        <span className={character.gold >= getGoldCost(recipe.level) ? "text-slate-100 font-semibold text-sm" : "text-red-400 font-semibold text-sm"}>
                          {getGoldCost(recipe.level)}g {character.gold < getGoldCost(recipe.level) && "(not enough)"}
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Base Stats <span className="text-slate-600 font-normal">(final values vary by quality roll)</span></p>
                        {Object.entries(recipe.resultStats).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300 capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-slate-100 font-semibold">+{val} ±{recipe.statVariance}</span>
                          </div>
                        ))}
                      </div>
                      {recipe.bonusSlots > 0 && (
                        <div className="mb-4 p-2 rounded-lg bg-slate-900/40 border border-slate-800/20">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Bonus Effect Slots: {recipe.bonusSlots}
                          </p>
                          <p className="text-slate-600 text-[10px]">Fine+ quality items may gain random bonus effects</p>
                        </div>
                      )}
                      <Button
                        variant={canCraft ? "primary" : "secondary"}
                        size="sm"
                        icon={<Hammer size={14} />}
                        onClick={(e) => { e.stopPropagation(); craftItem(recipe); }}
                        loading={crafting}
                        disabled={!canCraft}
                      >
                        {canCraft ? `Craft (${10 + recipe.level * 5} stam, ${getGoldCost(recipe.level)}g)` :
                         character.computed_stamina < 10 + recipe.level * 5 ? "Not enough stamina" :
                         character.gold < getGoldCost(recipe.level) ? "Not enough gold" : "Missing Materials"}
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Locked Recipes</h2>
          <div className="space-y-2">
            {lockedRecipes.map((recipe, i) => {
              const Icon = typeIcons[recipe.type] || Hammer;
              return (
                <div key={i} className="bg-slate-900/20 p-4 rounded-lg border border-slate-800/10 opacity-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-slate-700 shrink-0" />
                      <div>
                        <span className="text-slate-400 font-semibold text-sm">{recipe.name}</span>
                        <p className="text-slate-700 text-xs">{recipe.desc}</p>
                      </div>
                    </div>
                    <span className="text-slate-700 text-xs bg-slate-900/40 px-2 py-1 rounded flex items-center gap-1 border border-slate-800/10">
                      <Lock size={10} /> Level {recipe.level}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quality Tiers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Crude", mult: "0.5x", color: "#6e656c" },
            { label: "Simple", mult: "0.75x", color: "#8a7f8a" },
            { label: "Standard", mult: "1.0x", color: "#a0d0a0" },
            { label: "Fine", mult: "1.25x", color: "#6a90a8" },
            { label: "Superior", mult: "1.5x", color: "#8a6aaa" },
            { label: "Masterwork", mult: "2.0x", color: "#c9a84c" },
            { label: "Legendary", mult: "3.0x", color: "#e85050" },
          ].map((t) => (
            <div key={t.label} className="text-center bg-slate-900/40 rounded-lg p-2 border border-slate-800/20">
              <div className="text-xs font-bold" style={{ color: t.color }}>{t.label}</div>
              <div className="text-slate-600 text-[10px]">{t.mult} stats</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
