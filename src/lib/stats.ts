import type { Database } from "@/types/database";

type Character = Database["public"]["Tables"]["characters"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];

export interface EffectiveStats {
  strength: number;
  agility: number;
  endurance: number;
  focus: number;
  cunning: number;
  attack: number;
  defense: number;
}

export function computeEffectiveStats(
  character: Character,
  inventory: (InventoryRow & { item: Item | null })[],
  clanBonuses?: { philosophy?: string }
): EffectiveStats {
  let strBonus = 0;
  let agiBonus = 0;
  let endBonus = 0;
  let focBonus = 0;
  let cunBonus = 0;
  let atkBonus = 0;
  let defBonus = 0;

  // Sum equipped item stat bonuses
  const equipped = inventory.filter((inv) => inv.equipped && inv.item);
  for (const inv of equipped) {
    const stats = inv.item?.stats as Record<string, number> | undefined;
    if (!stats) continue;
    atkBonus += stats.attack || 0;
    defBonus += stats.defense || 0;
    strBonus += stats.strength || 0;
    agiBonus += stats.agility || 0;
    endBonus += stats.endurance || 0;
    focBonus += stats.focus || 0;
    cunBonus += stats.cunning || 0;
  }

  // Apply clan philosophy passive bonuses to members
  if (clanBonuses?.philosophy === "warborn") {
    atkBonus += 1; // Warborn: innate +1 attack
  } else if (clanBonuses?.philosophy === "earthkeepers") {
    endBonus += 1; // Earthkeepers: innate +1 endurance
  } else if (clanBonuses?.philosophy === "pathfinders") {
    agiBonus += 1; // Pathfinders: innate +1 agility
  }

  return {
    strength: character.strength + strBonus,
    agility: character.agility + agiBonus,
    endurance: character.endurance + endBonus,
    focus: character.focus + focBonus,
    cunning: character.cunning + cunBonus,
    attack: character.strength + character.agility + atkBonus,
    defense: character.endurance + defBonus,
  };
}
