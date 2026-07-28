import type { Database } from "@/types/database";

type Character = Database["public"]["Tables"]["characters"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type Pet = Database["public"]["Tables"]["pets"]["Row"];

export interface EffectiveStats {
  strength: number;
  defence: number;
  speed: number;
  vitality: number;
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
  let def = character.defence;
  let spd = character.speed;
  let vit = character.vitality;

  // Pet passive stat bonuses (identity + utility, no infinite scaling)
  const equippedPets = pets?.filter((p) => p.equipped) || [];
  for (const pet of equippedPets) {
    switch (pet.type) {
      case "wolf":
        str += 2;
        spd += 1;
        break;
      case "cat":
        spd += 2;
        vit += 1;
        break;
      case "hawk":
        spd += 3;
        break;
      case "boar":
        vit += 3;
        def += 1;
        break;
      case "dog":
        str += 1;
        vit += 2;
        break;
      case "snake":
        str += 2;
        spd += 1;
        break;
      case "dragon":
        str += 3;
        def += 2;
        break;
      case "goat":
        str += 1;
        def += 1;
        spd += 1;
        vit += 1;
        break;
    }
  }

  // Sum equipped item stat bonuses
  let atkBonus = 0;
  let defBonus = 0;

  const equipped = inventory.filter((inv) => inv.equipped && inv.item);
  for (const inv of equipped) {
    const stats = inv.item?.stats as Record<string, number> | undefined;
    if (!stats) continue;
    str += stats.strength || 0;
    def += stats.defence || 0;
    spd += stats.speed || 0;
    vit += stats.vitality || 0;
    atkBonus += stats.attack || 0;
    defBonus += stats.defense || 0;
  }

  // Apply clan philosophy passive bonuses
  if (clanBonuses?.philosophy === "warborn") {
    str += 2;
    atkBonus += 1;
  } else if (clanBonuses?.philosophy === "earthkeepers") {
    vit += 2;
    defBonus += 1;
  } else if (clanBonuses?.philosophy === "pathfinders") {
    spd += 2;
    atkBonus += 1;
  }

  return {
    strength: str,
    defence: def,
    speed: spd,
    vitality: vit,
    attack: str + atkBonus,
    defense: def + defBonus,
  };
}
