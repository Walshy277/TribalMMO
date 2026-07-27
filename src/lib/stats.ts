import type { Database } from "@/types/database";

type Character = Database["public"]["Tables"]["characters"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type Pet = Database["public"]["Tables"]["pets"]["Row"];

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
  clanBonuses?: { philosophy?: string },
  pets?: Pet[]
): EffectiveStats {
  let str = character.strength;
  let agi = character.agility;
  let end = character.endurance;
  let foc = character.focus;
  let cun = character.cunning;

  // Goat pet: x1.5 base stats (legendary, 1 in 1B)
  const hasEquippedGoat = pets?.some((p) => p.equipped && p.type === "goat");
  if (hasEquippedGoat) {
    str = Math.floor(str * 1.5);
    agi = Math.floor(agi * 1.5);
    end = Math.floor(end * 1.5);
    foc = Math.floor(foc * 1.5);
    cun = Math.floor(cun * 1.5);
  }

  let atkBonus = 0;
  let defBonus = 0;
  let strBonus = 0;
  let agiBonus = 0;
  let endBonus = 0;
  let focBonus = 0;
  let cunBonus = 0;

  // Dragon pet: +5 attack, +3 defense (mythical, 1 in 1M)
  const hasEquippedDragon = pets?.some((p) => p.equipped && p.type === "dragon");
  if (hasEquippedDragon) {
    atkBonus += 5;
    defBonus += 3;
  }

  // Wolf pet: +2 attack, +1 agility
  const hasEquippedWolf = pets?.some((p) => p.equipped && p.type === "wolf");
  if (hasEquippedWolf) {
    atkBonus += 2;
    agiBonus += 1;
  }

  // Boar pet: +3 endurance, +1 defense
  const hasEquippedBoar = pets?.some((p) => p.equipped && p.type === "boar");
  if (hasEquippedBoar) {
    endBonus += 3;
    defBonus += 1;
  }

  // Hawk pet: +2 agility, +1 cunning (rare)
  const hasEquippedHawk = pets?.some((p) => p.equipped && p.type === "hawk");
  if (hasEquippedHawk) {
    agiBonus += 2;
    cunBonus += 1;
  }

  // Snake pet: +2 cunning, +1 attack (rare)
  const hasEquippedSnake = pets?.some((p) => p.equipped && p.type === "snake");
  if (hasEquippedSnake) {
    cunBonus += 2;
    atkBonus += 1;
  }

  // Cat pet: +1 agility, +1 focus, +1 cunning (uncommon)
  const hasEquippedCat = pets?.some((p) => p.equipped && p.type === "cat");
  if (hasEquippedCat) {
    agiBonus += 1;
    focBonus += 1;
    cunBonus += 1;
  }

  // Dog pet: +1 strength, +1 endurance, +1 attack (uncommon)
  const hasEquippedDog = pets?.some((p) => p.equipped && p.type === "dog");
  if (hasEquippedDog) {
    strBonus += 1;
    endBonus += 1;
    atkBonus += 1;
  }

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
    atkBonus += 2;
    strBonus += 1;
  } else if (clanBonuses?.philosophy === "earthkeepers") {
    endBonus += 2;
    defBonus += 1;
  } else if (clanBonuses?.philosophy === "pathfinders") {
    agiBonus += 2;
    cunBonus += 1;
  }

  return {
    strength: str + strBonus,
    agility: agi + agiBonus,
    endurance: end + endBonus,
    focus: foc + focBonus,
    cunning: cun + cunBonus,
    attack: str + agi + atkBonus,
    defense: end + defBonus,
  };
}
